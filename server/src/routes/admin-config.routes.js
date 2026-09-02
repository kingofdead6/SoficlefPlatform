import { Router } from 'express';
import { z } from 'zod';
import dns from 'node:dns/promises';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { prisma } from '../infrastructure/db/client.js';
import { ALL_PERMISSIONS, parsePermission } from '../domain/auth/permissions.js';
import { CONNECTOR_IDS, CONNECTORS, connectorStatuses } from '../domain/admin/connectors.js';
import { AGENT_IDS } from '../domain/assistant/agents.js';

const router = Router();
router.use(requireAuth);

/**
 * The administration portal's configuration endpoints (route guide §2.4).
 *
 * Mounted under /api/v1/admin alongside admin.routes.js, which stays what it was: the
 * read-only reports. This file holds everything that *writes* — custom roles, connector
 * modes, the AI configuration, the security policy, backup schedules and the GDPR register
 * — against the tables added in prisma/migrations/20260903090000_admin_config.
 *
 * It is a separate router rather than more handlers in admin.routes.js because that file
 * gates its whole surface on `setting:read`, and these endpoints must each be gated on the
 * narrowest permission that actually fits: `role:*` for the RBAC matrix, `audit_log:read`
 * for the register listings, `setting:update` for platform configuration. ADMIN holds all
 * of them, so nothing an administrator can reach changes; what changes is that a future
 * role granted only `role:read` gets the RBAC screen and nothing else.
 *
 * Three honesty rules, enforced here rather than only written on the pages:
 *   - A connector test never reports success it did not observe (see /integrations/:key/test).
 *   - No endpoint creates a BackupRun. Nothing in this codebase executes a backup, so the
 *     history stays empty until a worker writes to it.
 *   - No endpoint calls an LLM. /ai stores configuration that ADR-003 keeps unconsumed.
 */

/* ========================================================================================
 * Custom roles — the editable half of the RBAC matrix (/admin/roles).
 * ======================================================================================== */

const PermissionList = z
  .array(z.string().trim().min(3))
  .max(200)
  .refine((codes) => codes.every((code) => parsePermission(code) !== null), {
    message: 'Permission inconnue : chaque entrée doit être « ressource:action ».',
  });

router.get('/roles', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'role');

    const roles = await prisma.customRole.findMany({ orderBy: [{ isSystem: 'desc' }, { code: 'asc' }] });

    res.json({
      data: roles,
      // The catalogue the matrix is drawn from: the UI must not invent a column the
      // authorization layer would not recognise.
      catalogue: ALL_PERMISSIONS,
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const CreateCustomRole = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Le code doit être en majuscules, sans espaces.'),
  nameFr: z.string().trim().min(2).max(120),
  descriptionFr: z.string().trim().max(600).nullable().optional(),
  permissions: PermissionList,
});

router.post('/roles', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateCustomRole,
    requires: { resource: 'role', action: 'create' },
    run: async (value, context) => {
      const clash = await context.tx.customRole.findUnique({
        where: { code: value.code },
        select: { id: true },
      });
      if (clash) throw Object.assign(new Error('Ce code de rôle est déjà utilisé.'), { status: 409 });

      // The four built-in codes are resolved by can() from code, not from this table.
      // Letting a row shadow one would make the same name mean two different permission
      // sets depending on which layer you asked.
      if (['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(value.code)) {
        throw Object.assign(
          new Error('Ce code appartient à un rôle intégré : choisissez un autre code.'),
          { status: 409 },
        );
      }

      const created = await context.tx.customRole.create({
        data: {
          code: value.code,
          nameFr: value.nameFr,
          descriptionFr: value.descriptionFr ?? null,
          permissions: [...new Set(value.permissions)].sort(),
          isSystem: false,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'custom_role',
        entityId: created.id,
        after: created,
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const UpdateCustomRole = z.object({
  nameFr: z.string().trim().min(2).max(120).optional(),
  descriptionFr: z.string().trim().max(600).nullable().optional(),
  permissions: PermissionList.optional(),
});

router.patch('/roles/:id', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateCustomRole,
    requires: { resource: 'role', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.customRole.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown role'), { status: 404 });
      if (before.isSystem) {
        throw Object.assign(
          new Error(
            'Ce rôle est intégré à la plateforme : ses permissions sont définies dans le code, pas en base.',
          ),
          { status: 409 },
        );
      }

      const after = await context.tx.customRole.update({
        where: { id: req.params.id },
        data: {
          ...(value.nameFr !== undefined ? { nameFr: value.nameFr } : {}),
          ...(value.descriptionFr !== undefined ? { descriptionFr: value.descriptionFr } : {}),
          ...(value.permissions !== undefined
            ? { permissions: [...new Set(value.permissions)].sort() }
            : {}),
        },
      });

      await context.audit({
        action: 'role.permission_changed',
        entityType: 'custom_role',
        entityId: after.id,
        before,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

router.delete('/roles/:id', async (req, res) => {
  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'role', action: 'delete' },
    run: async (_value, context) => {
      const before = await context.tx.customRole.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown role'), { status: 404 });
      if (before.isSystem) {
        throw Object.assign(new Error('Un rôle intégré ne peut pas être supprimé.'), { status: 409 });
      }

      await context.tx.customRole.delete({ where: { id: req.params.id } });

      await context.audit({
        action: 'entity.deleted',
        entityType: 'custom_role',
        entityId: before.id,
        before,
        after: null,
      });

      return { id: before.id };
    },
  });

  sendActionResult(res, result);
});

/* ========================================================================================
 * Connectors — the Plug & Play switch (/admin/integrations).
 *
 * A connector has two states that must not be conflated: the mode declared in the database
 * (what an administrator asked for) and the deployment's environment variable (what the
 * running server actually has). Both are returned, because the interesting case is when
 * they disagree — a connector set to PRODUCTION with no endpoint configured is the exact
 * situation the console exists to surface.
 * ======================================================================================== */

const CONNECTOR_KEYS = CONNECTOR_IDS;

router.get('/connectors', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const [rows, envStatuses] = await Promise.all([
      prisma.connector.findMany({ orderBy: { key: 'asc' } }).catch(() => []),
      Promise.resolve(connectorStatuses(process.env)),
    ]);

    const byKey = new Map(rows.map((row) => [row.key, row]));

    const data = CONNECTOR_KEYS.map((key) => {
      const definition = CONNECTORS[key];
      const stored = byKey.get(key) ?? null;
      const envMode = envStatuses.find((status) => status.definition.id === key)?.mode ?? 'unconfigured';

      return {
        key,
        definition,
        // Never configured in the database yet: the declared mode falls back to MOCK, which
        // is the safe default — a connector nobody has decided about must not be treated
        // as production.
        mode: stored?.mode ?? 'MOCK',
        config: stored?.config ?? {},
        lastTestedAt: stored?.lastTestedAt ?? null,
        lastTestOk: stored?.lastTestOk ?? null,
        envMode,
        // The disagreement worth showing on screen.
        envMismatch: (stored?.mode ?? 'MOCK') === 'PRODUCTION' && envMode !== 'production',
      };
    });

    res.json({
      data,
      summary: {
        production: data.filter((row) => row.mode === 'PRODUCTION').length,
        mock: data.filter((row) => row.mode === 'MOCK').length,
        mismatched: data.filter((row) => row.envMismatch).length,
      },
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateConnector = z.object({
  mode: z.enum(['MOCK', 'PRODUCTION']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

router.patch('/connectors/:key', async (req, res) => {
  const key = req.params.key;

  const result = await mutate(req, req.body, {
    schema: UpdateConnector,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      if (!CONNECTOR_KEYS.includes(key)) {
        throw Object.assign(new Error('unknown connector'), { status: 404 });
      }

      const definition = CONNECTORS[key];
      const before = await context.tx.connector.findUnique({ where: { key } });

      const after = await context.tx.connector.upsert({
        where: { key },
        create: {
          key,
          labelFr: definition.labelFr,
          mode: value.mode ?? 'MOCK',
          config: value.config ?? {},
        },
        update: {
          ...(value.mode !== undefined ? { mode: value.mode } : {}),
          ...(value.config !== undefined ? { config: value.config } : {}),
        },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'connector',
        entityId: after.id,
        before: before ? { mode: before.mode, config: before.config } : null,
        after: { mode: after.mode, config: after.config },
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

/**
 * POST /connectors/:key/test — attempts a real check and reports what it observed.
 *
 * The only connector with something genuinely checkable from this process is SMTP: if a
 * host has been configured, its name can be resolved, and a failure to resolve is a real
 * failure an administrator needs to know about. That check is honest but narrow — DNS
 * resolution proves a name exists, not that a mail server will accept a message — and the
 * response says so in `checkedFr` so nobody reads a green result as "e-mail works".
 *
 * Every other connector has no address to reach in this deployment and returns
 * `{ ok: false, reason: 'not_configured' }`. That is the point: a test button that always
 * answers "connexion réussie" tests only itself.
 */
router.post('/connectors/:key/test', async (req, res) => {
  const key = req.params.key;

  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'setting', action: 'update' },
    run: async (_value, context) => {
      if (!CONNECTOR_KEYS.includes(key)) {
        throw Object.assign(new Error('unknown connector'), { status: 404 });
      }

      const definition = CONNECTORS[key];
      const stored = await context.tx.connector.findUnique({ where: { key } });
      const config = stored?.config ?? {};

      let outcome;

      if (key === 'smtp') {
        const host = typeof config.host === 'string' ? config.host.trim() : '';
        if (!host) {
          outcome = {
            ok: false,
            reason: 'not_configured',
            detailFr:
              'Aucun hôte SMTP n’est enregistré. Renseignez « host » dans la configuration pour que la résolution puisse être tentée.',
            checkedFr: 'Aucun test effectué.',
          };
        } else {
          try {
            const addresses = await dns.lookup(host, { all: true });
            outcome = {
              ok: true,
              reason: 'resolved',
              detailFr: `L’hôte « ${host} » se résout (${addresses.length} adresse(s)).`,
              checkedFr:
                'Vérification limitée à la résolution DNS du nom d’hôte : elle prouve que le nom existe, pas qu’un serveur de messagerie acceptera un envoi.',
            };
          } catch {
            outcome = {
              ok: false,
              reason: 'unreachable',
              detailFr: `L’hôte « ${host} » ne se résout pas depuis ce serveur.`,
              checkedFr: 'Résolution DNS du nom d’hôte.',
            };
          }
        }
      } else {
        outcome = {
          ok: false,
          reason: 'not_configured',
          detailFr: `Aucune cible n’est raccordée pour « ${definition.labelFr} » dans ce déploiement : il n’y a rien à interroger.`,
          checkedFr:
            'Aucun test effectué. Un test qui répondrait « réussi » sans avoir joint quoi que ce soit ne testerait que lui-même.',
        };
      }

      const saved = await context.tx.connector.upsert({
        where: { key },
        create: {
          key,
          labelFr: definition.labelFr,
          mode: 'MOCK',
          config: {},
          lastTestedAt: new Date(),
          lastTestOk: outcome.ok,
        },
        update: { lastTestedAt: new Date(), lastTestOk: outcome.ok },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'connector',
        entityId: saved.id,
        before: stored ? { lastTestOk: stored.lastTestOk } : null,
        after: { lastTestOk: outcome.ok, reason: outcome.reason },
      });

      return { key, ...outcome, lastTestedAt: saved.lastTestedAt };
    },
  });

  sendActionResult(res, result);
});

/* ========================================================================================
 * AI configuration (/admin/ai). Stored, never consumed — ADR-003.
 * ======================================================================================== */

const AI_CONFIG_ROW = 'singleton';

async function readAiConfig() {
  const row = await prisma.aiConfig.findFirst().catch(() => null);
  return {
    provider: row?.provider ?? null,
    endpoint: row?.endpoint ?? null,
    model: row?.model ?? null,
    monthlyQuota: row?.monthlyQuota ?? null,
    agentsEnabled: row?.agentsEnabled ?? {},
    promptTemplates: row?.promptTemplates ?? {},
    updatedAt: row?.updatedAt ?? null,
  };
}

router.get('/ai/config', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const config = await readAiConfig();
    const aiConnector = connectorStatuses(process.env).find((status) => status.definition.id === 'ai');

    res.json({
      data: config,
      agents: AGENT_IDS,
      // The deployment's own view, so the page can show that a saved endpoint is not the
      // same thing as a wired one.
      providerConnected: aiConnector?.mode === 'production',
      envVar: aiConnector?.definition.envVar ?? 'AI_PROVIDER_ENDPOINT',
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateAi = z.object({
  provider: z.string().trim().max(80).nullable().optional(),
  endpoint: z.string().trim().max(400).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  monthlyQuota: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  agentsEnabled: z.record(z.enum(AGENT_IDS), z.boolean()).optional(),
  promptTemplates: z.record(z.enum(AGENT_IDS), z.string().max(4000)).optional(),
});

router.patch('/ai', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateAi,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const existing = await context.tx.aiConfig.findFirst();

      const data = {
        ...(value.provider !== undefined ? { provider: value.provider } : {}),
        ...(value.endpoint !== undefined ? { endpoint: value.endpoint } : {}),
        ...(value.model !== undefined ? { model: value.model } : {}),
        ...(value.monthlyQuota !== undefined ? { monthlyQuota: value.monthlyQuota } : {}),
        // Merged rather than replaced: the page toggles one agent at a time, and a PATCH
        // carrying a single key must not silently disable the other four.
        ...(value.agentsEnabled !== undefined
          ? { agentsEnabled: { ...(existing?.agentsEnabled ?? {}), ...value.agentsEnabled } }
          : {}),
        ...(value.promptTemplates !== undefined
          ? { promptTemplates: { ...(existing?.promptTemplates ?? {}), ...value.promptTemplates } }
          : {}),
      };

      const after = existing
        ? await context.tx.aiConfig.update({ where: { id: existing.id }, data })
        : await context.tx.aiConfig.create({ data });

      await context.audit({
        action: 'entity.updated',
        entityType: 'ai_config',
        entityId: after.id,
        before: existing,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

/* ========================================================================================
 * Security policy (/admin/security).
 *
 * The policy is stored, but the values in force today are still the environment's — the
 * auth layer reads serverEnv(), not this table. admin.routes.js's GET /security reports
 * what is in force; this pair records what has been decided. The page shows both and names
 * the gap rather than letting a saved value look applied.
 * ======================================================================================== */

router.get('/security/policy', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const row = await prisma.securityPolicy.findFirst().catch(() => null);

    res.json({
      data: {
        passwordMinLength: row?.passwordMinLength ?? 12,
        mfaRequired: row?.mfaRequired ?? false,
        sessionTtlSeconds: row?.sessionTtlSeconds ?? 28_800,
        ipAllowlist: Array.isArray(row?.ipAllowlist) ? row.ipAllowlist : [],
        updatedAt: row?.updatedAt ?? null,
      },
      stored: Boolean(row),
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateSecurityPolicy = z.object({
  passwordMinLength: z.coerce.number().int().min(8).max(128).optional(),
  mfaRequired: z.boolean().optional(),
  sessionTtlSeconds: z.coerce.number().int().min(300).max(2_592_000).optional(),
  ipAllowlist: z.array(z.string().trim().min(3).max(64)).max(200).optional(),
});

router.patch('/security/policy', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateSecurityPolicy,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const existing = await context.tx.securityPolicy.findFirst();

      const data = {
        ...(value.passwordMinLength !== undefined
          ? { passwordMinLength: value.passwordMinLength }
          : {}),
        ...(value.mfaRequired !== undefined ? { mfaRequired: value.mfaRequired } : {}),
        ...(value.sessionTtlSeconds !== undefined
          ? { sessionTtlSeconds: value.sessionTtlSeconds }
          : {}),
        ...(value.ipAllowlist !== undefined ? { ipAllowlist: value.ipAllowlist } : {}),
      };

      const after = existing
        ? await context.tx.securityPolicy.update({ where: { id: existing.id }, data })
        : await context.tx.securityPolicy.create({ data });

      await context.audit({
        action: 'entity.updated',
        entityType: 'security_policy',
        entityId: after.id,
        before: existing,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

/* ========================================================================================
 * Backup schedules and run history (/admin/backups).
 *
 * The schedules are real rows an administrator owns. The runs are not: no process in this
 * repository executes a backup, so nothing writes to backup_run and no endpoint here
 * fabricates one. GET /backups/runs therefore returns an empty list with the reason
 * attached, which is a different answer from "no backups have failed".
 * ======================================================================================== */

router.get('/backups/schedules', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const schedules = await prisma.backupSchedule
      .findMany({ orderBy: [{ isActive: 'desc' }, { labelFr: 'asc' }] })
      .catch(() => []);

    res.json({ data: schedules, executorAvailable: false });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/backups/runs', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const limit = req.query.limit ? Math.min(Number(req.query.limit) || 50, 200) : 50;
    const runs = await prisma.backupRun
      .findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: { schedule: { select: { id: true, labelFr: true } } },
      })
      .catch(() => []);

    res.json({
      // BigInt is not JSON-serialisable; the size is sent as a string so a very large
      // backup does not silently lose precision through a Number.
      data: runs.map((run) => ({ ...run, sizeBytes: run.sizeBytes === null ? null : String(run.sizeBytes) })),
      executorAvailable: false,
      emptyReasonFr:
        'Aucun processus de sauvegarde ne tourne dans cette application : cet historique est vide parce que rien ne l’alimente, et non parce qu’aucune sauvegarde n’a échoué.',
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const ScheduleShape = {
  labelFr: z.string().trim().min(2).max(160),
  cronFr: z.string().trim().min(3).max(120),
  retentionDays: z.coerce.number().int().min(1).max(3650),
  isActive: z.boolean(),
};

router.post('/backups/schedules', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: z.object({ ...ScheduleShape, isActive: ScheduleShape.isActive.default(true) }),
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const created = await context.tx.backupSchedule.create({
        data: {
          labelFr: value.labelFr,
          cronFr: value.cronFr,
          retentionDays: value.retentionDays,
          isActive: value.isActive,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'backup_schedule',
        entityId: created.id,
        after: created,
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

router.patch('/backups/schedules/:id', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: z.object({
      labelFr: ScheduleShape.labelFr.optional(),
      cronFr: ScheduleShape.cronFr.optional(),
      retentionDays: ScheduleShape.retentionDays.optional(),
      isActive: ScheduleShape.isActive.optional(),
    }),
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.backupSchedule.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown schedule'), { status: 404 });

      const after = await context.tx.backupSchedule.update({
        where: { id: req.params.id },
        data: {
          ...(value.labelFr !== undefined ? { labelFr: value.labelFr } : {}),
          ...(value.cronFr !== undefined ? { cronFr: value.cronFr } : {}),
          ...(value.retentionDays !== undefined ? { retentionDays: value.retentionDays } : {}),
          ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
        },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'backup_schedule',
        entityId: after.id,
        before,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

router.delete('/backups/schedules/:id', async (req, res) => {
  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'setting', action: 'update' },
    run: async (_value, context) => {
      const before = await context.tx.backupSchedule.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown schedule'), { status: 404 });

      // backup_run.scheduleId is ON DELETE SET NULL, so past runs survive the schedule
      // that produced them.
      await context.tx.backupSchedule.delete({ where: { id: req.params.id } });

      await context.audit({
        action: 'entity.deleted',
        entityType: 'backup_schedule',
        entityId: before.id,
        before,
        after: null,
      });

      return { id: before.id };
    },
  });

  sendActionResult(res, result);
});

/* ========================================================================================
 * GDPR register (/admin/gdpr).
 *
 * A request is a tracked obligation, not a trigger. Erasure has a different correct answer
 * per data category (admin.routes.js GET /gdpr lists them), so resolving a row here records
 * that a human dealt with it — it deletes nothing on its own, and the page says so.
 * ======================================================================================== */

const GDPR_KINDS = ['ERASURE', 'EXPORT', 'CONSENT'];
const GDPR_STATUSES = ['OPEN', 'DONE', 'REJECTED'];

router.get('/gdpr/requests', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'setting');

    const requests = await prisma.gdprRequest
      .findMany({
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
        take: 300,
        include: { subject: { select: { id: true, displayName: true, email: true } } },
      })
      .catch(() => []);

    res.json({
      data: requests,
      kinds: GDPR_KINDS,
      statuses: GDPR_STATUSES,
      erasureAutomated: false,
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const CreateGdprRequest = z.object({
  subjectUserId: z.string().uuid().nullable().optional(),
  kind: z.enum(GDPR_KINDS),
  noteFr: z.string().trim().max(2000).nullable().optional(),
});

router.post('/gdpr/requests', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateGdprRequest,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      if (value.subjectUserId) {
        const subject = await context.tx.user.findUnique({
          where: { id: value.subjectUserId },
          select: { id: true },
        });
        if (!subject) throw Object.assign(new Error('unknown subject'), { status: 404 });
      }

      const created = await context.tx.gdprRequest.create({
        data: {
          subjectUserId: value.subjectUserId ?? null,
          kind: value.kind,
          noteFr: value.noteFr ?? null,
          status: 'OPEN',
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'gdpr_request',
        entityId: created.id,
        after: created,
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const UpdateGdprRequest = z.object({
  status: z.enum(GDPR_STATUSES).optional(),
  noteFr: z.string().trim().max(2000).nullable().optional(),
});

router.patch('/gdpr/requests/:id', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateGdprRequest,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.gdprRequest.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown request'), { status: 404 });

      const closing = value.status !== undefined && value.status !== 'OPEN';

      const after = await context.tx.gdprRequest.update({
        where: { id: req.params.id },
        data: {
          ...(value.status !== undefined ? { status: value.status } : {}),
          ...(value.noteFr !== undefined ? { noteFr: value.noteFr } : {}),
          // Reopening clears the resolution date rather than leaving a stale one behind.
          ...(value.status !== undefined ? { resolvedAt: closing ? new Date() : null } : {}),
        },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'gdpr_request',
        entityId: after.id,
        before,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

export default router;
