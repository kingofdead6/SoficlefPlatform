import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCan } from '../domain/auth/authorization.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { prisma } from '../infrastructure/db/client.js';
import { serverEnv } from '../config/env.js';
import { connectorStatuses } from '../domain/admin/connectors.js';
import { AGENT_IDS } from '../domain/assistant/agents.js';

const router = Router();
router.use(requireAuth);

function requireSettingRead(req, res, next) {
  try {
    assertCan(req.user, 'read', 'setting');
    next();
  } catch {
    res.status(403).json({ error: 'forbidden' });
  }
}

function requireSettingUpdate(req, res, next) {
  try {
    assertCan(req.user, 'update', 'setting');
    next();
  } catch {
    res.status(403).json({ error: 'forbidden' });
  }
}

router.use(requireSettingRead);

/**
 * These five screens (/admin/integrations, /ai, /security, /backups, /gdpr) are ported
 * from SoficlefPlatform's admin pages. In the source app every one of them is a *report*,
 * not a control panel — none exposes a form that mutates production behaviour, because
 * (per each page's own comments) an on/off switch here would either be theatre (no real
 * endpoint to test), a way to point production at a mock from a browser, or a promise
 * (backups, GDPR erasure) the application cannot honestly keep. This port preserves that:
 * everything below is GET-only except /settings, which is the one screen in the source
 * app that edits real `AppSetting` rows (org-chart visibility depths).
 */

// ---------------------------------------------------------------------------------------
// GET /api/v1/admin/integrations — connector status report.
// ---------------------------------------------------------------------------------------
router.get('/integrations', (req, res) => {
  const connectors = connectorStatuses(process.env);
  res.json({
    data: connectors,
    summary: {
      production: connectors.filter((c) => c.mode === 'production').length,
      mock: connectors.filter((c) => c.mode === 'mock').length,
      unconfigured: connectors.filter((c) => c.mode === 'unconfigured').length,
    },
  });
});

// ---------------------------------------------------------------------------------------
// GET /api/v1/admin/ai — what each assistant may read, and whether a provider is wired.
// No LLM call happens here or anywhere else in this port (ADR-003).
// ---------------------------------------------------------------------------------------
router.get('/ai', (req, res) => {
  const ai = connectorStatuses(process.env).find((status) => status.definition.id === 'ai');
  res.json({
    agentsDeclared: AGENT_IDS.length,
    agentsOperational: 1,
    providerConnected: ai?.mode === 'production',
    connector: ai,
  });
});

// ---------------------------------------------------------------------------------------
// GET /api/v1/admin/security — the security values actually in force, read from the
// parsed/validated environment. Nothing here is editable at runtime, same as the source.
// ---------------------------------------------------------------------------------------
router.get('/security', async (req, res, next) => {
  try {
    const env = serverEnv();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);

    const [failedLogins, revokedSessions, activeSessions] = await Promise.all([
      prisma.auditLog
        .count({ where: { action: 'auth.login_failed', createdAt: { gte: dayAgo } } })
        .catch(() => 0),
      prisma.session.count({ where: { revokedAt: { not: null } } }).catch(() => 0),
      prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }).catch(() => 0),
    ]);

    res.json({
      activeSessions,
      revokedSessions,
      failedLogins24h: failedLogins,
      sessionTtlHours: Math.round(env.AUTH_SESSION_TTL_SECONDS / 3600),
      sessionRenewWindowMinutes: Math.round(env.AUTH_SESSION_RENEW_WINDOW_SECONDS / 60),
      passwordMinLength: env.AUTH_PASSWORD_MIN_LENGTH,
      argon2: {
        memoryKib: env.AUTH_ARGON2_MEMORY_KIB,
        iterations: env.AUTH_ARGON2_ITERATIONS,
        parallelism: env.AUTH_ARGON2_PARALLELISM,
      },
      mfaAvailable: false,
      ipRestrictionsAvailable: false,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------------------
// GET /api/v1/admin/backups — the platform takes no backups itself; this reports what
// would need restoring and says so, rather than showing a schedule it cannot keep.
// ---------------------------------------------------------------------------------------
router.get('/backups', async (req, res, next) => {
  try {
    const [users, assignments, journeys, auditRows, documents] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.assignment.count().catch(() => 0),
      prisma.onboardingInstance.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.document.count().catch(() => 0),
    ]);

    res.json({
      applicationBackupsAvailable: false,
      counts: { users, assignments, journeys, auditRows, documents },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------------------
// GET /api/v1/admin/gdpr — inventory of personal data held, category by category, and
// what an erasure request would imply for each. Not automated — see the source page's
// own reasoning: one button cannot apply five different erasure rules correctly.
// ---------------------------------------------------------------------------------------
router.get('/gdpr', async (req, res, next) => {
  try {
    const [users, responses, acknowledgements, personalFiles, auditRows, assessments] =
      await Promise.all([
        prisma.user.count().catch(() => 0),
        prisma.surveyResponse.count().catch(() => 0),
        prisma.documentAcknowledgement.count().catch(() => 0),
        prisma.personalFile.count().catch(() => 0),
        prisma.auditLog.count().catch(() => 0),
        prisma.assessment.count().catch(() => 0),
      ]);

    const categories = [
      {
        titleFr: 'Identité et coordonnées',
        count: users,
        holdsFr: 'Nom, e-mail professionnel, téléphone, date d’embauche, rattachement.',
        erasureFr:
          'Anonymisation plutôt que suppression : le compte est référencé par des affectations et des parcours dont l’historique doit rester cohérent.',
      },
      {
        titleFr: 'Réponses aux enquêtes',
        count: responses,
        holdsFr:
          'Les réponses individuelles, déjà inaccessibles à tous — y compris aux RH et au responsable.',
        erasureFr:
          'Suppression possible sans effet de bord : seuls les agrégats sont exploités, et ils se recalculent.',
      },
      {
        titleFr: 'Évaluations et compétences',
        count: assessments,
        holdsFr: 'Niveaux évalués, auteur de l’évaluation, commentaires.',
        erasureFr:
          'À arbitrer : ce sont aussi des actes de gestion, dont la conservation peut être requise par le droit du travail.',
      },
      {
        titleFr: 'Acceptations de documents',
        count: acknowledgements,
        holdsFr: 'Qui a accepté quel document, et quand.',
        erasureFr:
          'Conservation probable : c’est la preuve qu’un règlement intérieur a été porté à la connaissance de la personne.',
      },
      {
        titleFr: 'Pièces administratives',
        count: personalFiles,
        holdsFr:
          'Aujourd’hui uniquement l’état (demandée, transmise, validée) : aucun fichier n’est stocké tant que le connecteur ne l’est pas.',
        erasureFr: 'Suppression simple aujourd’hui ; à revoir quand les fichiers seront stockés.',
      },
      {
        titleFr: 'Journal d’audit',
        count: auditRows,
        holdsFr: 'Auteur, action, horodatage, adresse IP.',
        erasureFr:
          'Doit survivre : c’est ce qui rend une suppression prouvable. L’auteur y est écrit tel qu’il était au moment des faits, ce qui limite déjà la donnée conservée.',
      },
    ];

    res.json({
      peopleConcerned: users,
      categories,
      erasureAutomated: false,
      retentionPurgeAutomated: false,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------------------
// GET/PATCH /api/v1/admin/settings — the org-chart visibility depths, the only genuinely
// administrable AppSetting rows in the source app (ported from
// infrastructure/settings/app-settings.ts + app/admin/settings/page.tsx).
// ---------------------------------------------------------------------------------------

const SETTING_KEYS = {
  orgTreeDepthUp: 'org.tree.depth.up',
  orgTreeDepthDown: 'org.tree.depth.down',
  orgTreeShowPeers: 'org.tree.showPeers',
  brandNameFr: 'brand.name.fr',
  brandTaglineFr: 'brand.tagline.fr',
  defaultLocale: 'i18n.defaultLocale',
  emailWelcomeSubjectFr: 'email.welcome.subject.fr',
  emailWelcomeBodyFr: 'email.welcome.body.fr',
  milestonesFr: 'onboarding.milestones.fr',
  featureAssistant: 'feature.assistant',
  featureSurveys: 'feature.surveys',
  featureTraining: 'feature.training',
};

const DEFAULTS = {
  [SETTING_KEYS.orgTreeDepthUp]: 2,
  [SETTING_KEYS.orgTreeDepthDown]: 1,
  [SETTING_KEYS.orgTreeShowPeers]: true,
  [SETTING_KEYS.brandNameFr]: 'Soficlef',
  [SETTING_KEYS.brandTaglineFr]: '',
  [SETTING_KEYS.defaultLocale]: 'fr',
  [SETTING_KEYS.emailWelcomeSubjectFr]: 'Bienvenue chez Soficlef',
  [SETTING_KEYS.emailWelcomeBodyFr]: '',
  // The onboarding milestones the journey pages label their days with, as an ordered list
  // of { dayNumber, labelFr }.
  [SETTING_KEYS.milestonesFr]: [
    { dayNumber: 1, labelFr: 'Premier jour' },
    { dayNumber: 30, labelFr: 'Point à 30 jours' },
    { dayNumber: 90, labelFr: 'Bilan de fin de période d’essai' },
  ],
  [SETTING_KEYS.featureAssistant]: true,
  [SETTING_KEYS.featureSurveys]: true,
  [SETTING_KEYS.featureTraining]: true,
};

const LABELS_FR = {
  [SETTING_KEYS.orgTreeDepthUp]: 'Niveaux visibles vers le haut',
  [SETTING_KEYS.orgTreeDepthDown]: 'Niveaux visibles vers le bas',
  [SETTING_KEYS.orgTreeShowPeers]: 'Afficher les collègues',
  [SETTING_KEYS.brandNameFr]: 'Nom affiché de la plateforme',
  [SETTING_KEYS.brandTaglineFr]: 'Accroche affichée sous le nom',
  [SETTING_KEYS.defaultLocale]: 'Langue par défaut',
  [SETTING_KEYS.emailWelcomeSubjectFr]: 'Objet du message de bienvenue',
  [SETTING_KEYS.emailWelcomeBodyFr]: 'Corps du message de bienvenue',
  [SETTING_KEYS.milestonesFr]: 'Jalons du parcours d’intégration',
  [SETTING_KEYS.featureAssistant]: 'Module assistant',
  [SETTING_KEYS.featureSurveys]: 'Module enquêtes',
  [SETTING_KEYS.featureTraining]: 'Module formation',
};

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value ?? undefined;
}

async function numberSetting(key, { max = 32 } = {}) {
  const fallback = Number(DEFAULTS[key] ?? 0);
  const raw = await readSetting(key);
  const value = typeof raw === 'number' ? raw : fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(Math.floor(value), max));
}

async function booleanSetting(key) {
  const raw = await readSetting(key);
  return typeof raw === 'boolean' ? raw : Boolean(DEFAULTS[key]);
}

async function valueSetting(key) {
  const raw = await readSetting(key);
  return raw === undefined ? DEFAULTS[key] : raw;
}

router.get('/settings', async (req, res, next) => {
  try {
    const [depthUp, depthDown, showPeers] = await Promise.all([
      numberSetting(SETTING_KEYS.orgTreeDepthUp, { max: 12 }),
      numberSetting(SETTING_KEYS.orgTreeDepthDown, { max: 12 }),
      booleanSetting(SETTING_KEYS.orgTreeShowPeers),
    ]);

    // Branding, languages, e-mail templates, milestones and feature flags (route guide
    // §2.4). Each is read with its default so a key nobody has ever set reads as its
    // documented value rather than as null, and `defaults` lets the page mark which is
    // still untouched.
    const wideKeys = [
      SETTING_KEYS.brandNameFr,
      SETTING_KEYS.brandTaglineFr,
      SETTING_KEYS.defaultLocale,
      SETTING_KEYS.emailWelcomeSubjectFr,
      SETTING_KEYS.emailWelcomeBodyFr,
      SETTING_KEYS.milestonesFr,
      SETTING_KEYS.featureAssistant,
      SETTING_KEYS.featureSurveys,
      SETTING_KEYS.featureTraining,
    ];

    const stored = await prisma.appSetting.findMany({
      where: { key: { in: wideKeys } },
      select: { key: true },
    });
    const storedKeys = new Set(stored.map((row) => row.key));

    const values = Object.fromEntries(
      await Promise.all(wideKeys.map(async (key) => [key, await valueSetting(key)])),
    );

    res.json({
      orgTree: { depthUp, depthDown, showPeers },
      values,
      defaults: DEFAULTS,
      labels: LABELS_FR,
      isDefault: Object.fromEntries(wideKeys.map((key) => [key, !storedKeys.has(key)])),
      keys: SETTING_KEYS,
    });
  } catch (error) {
    next(error);
  }
});

const EDITABLE_KEYS = Object.values(SETTING_KEYS);

/**
 * The value shape allowed per key. A single permissive `z.unknown()` would let a boolean
 * flag be set to a string and the consuming page would then have to defend itself; keeping
 * the constraint here means a bad write is refused at the boundary, once.
 */
const VALUE_SCHEMAS = {
  [SETTING_KEYS.orgTreeDepthUp]: z.number().int().min(0).max(12),
  [SETTING_KEYS.orgTreeDepthDown]: z.number().int().min(0).max(12),
  [SETTING_KEYS.orgTreeShowPeers]: z.boolean(),
  [SETTING_KEYS.brandNameFr]: z.string().trim().min(1).max(120),
  [SETTING_KEYS.brandTaglineFr]: z.string().trim().max(240),
  [SETTING_KEYS.defaultLocale]: z.enum(['fr', 'ar', 'en']),
  [SETTING_KEYS.emailWelcomeSubjectFr]: z.string().trim().max(240),
  [SETTING_KEYS.emailWelcomeBodyFr]: z.string().trim().max(8000),
  [SETTING_KEYS.milestonesFr]: z
    .array(z.object({ dayNumber: z.number().int().min(0).max(3650), labelFr: z.string().trim().min(1).max(160) }))
    .max(40),
  [SETTING_KEYS.featureAssistant]: z.boolean(),
  [SETTING_KEYS.featureSurveys]: z.boolean(),
  [SETTING_KEYS.featureTraining]: z.boolean(),
};

const UpdateSetting = z
  .object({
    key: z.enum(EDITABLE_KEYS),
    value: z.unknown(),
  })
  .superRefine((input, ctx) => {
    const schema = VALUE_SCHEMAS[input.key];
    const parsed = schema.safeParse(input.value);
    if (!parsed.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Valeur invalide pour « ${LABELS_FR[input.key] ?? input.key} ».`,
      });
    }
  });

/**
 * PATCH /api/v1/admin/settings — updates one administrable AppSetting row.
 *
 * The org-chart visibility depths were the only keys the source app let an administrator
 * change at runtime; §2.4 adds branding, default language, the welcome e-mail template, the
 * onboarding milestone definitions and the module feature flags. They share this one
 * endpoint and the existing `app_setting` table rather than each acquiring a table of its
 * own — a settings row is a key and a value, and that is already modelled.
 *
 * Note on the e-mail template: it is stored and editable, but no SMTP connector is wired in
 * this deployment, so nothing sends it. /admin/settings says so beside the field.
 */
router.patch('/settings', requireSettingUpdate, async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateSetting,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.appSetting.findUnique({ where: { key: value.key } });

      const labelFr = LABELS_FR[value.key] ?? value.key;

      const after = await context.tx.appSetting.upsert({
        where: { key: value.key },
        create: { key: value.key, value: value.value, labelFr },
        update: { value: value.value },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'app_setting',
        entityId: after.id,
        before: before ? { value: before.value } : null,
        after: { value: after.value },
      });

      return { key: after.key, value: after.value };
    },
  });

  sendActionResult(res, result);
});

export default router;
