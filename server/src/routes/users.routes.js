import { Router } from 'express';
import { z } from 'zod';

import { assignRole } from '../application/auth/assign-role.js';
import { listUsers } from '../application/admin/directory.js';
import { directoryFacets, listEmployees, loadEmployee } from '../application/hr/directory.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { assertCan } from '../domain/auth/authorization.js';
import { hashPassword } from '../infrastructure/auth/password.js';
import { prisma } from '../infrastructure/db/client.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';
import { upload } from '../infrastructure/middleware/upload.js';
import { isStorageConfigured, uploadBuffer } from '../infrastructure/storage/cloudinary.js';

const router = Router();
router.use(requireAuth);

function ipFromReq(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null;
}

/**
 * Users — the administration directory (user:read) and the HR employee directory
 * (assignment:read, scoped). Ported from src/application/admin/directory.ts +
 * src/application/hr/directory.ts, and the account-creation / role / status mutations
 * from src/app/actions/admin.ts.
 */

/** GET /users — the administration list (user:read). Falls back to the HR directory
 * (assignment:read, scoped) for callers who hold that instead, e.g. a MANAGER. */
router.get('/', async (req, res, next) => {
  try {
    if (req.query.view === 'directory') {
      const rows = await listEmployees(req.user, {
        search: req.query.search,
        unitCode: req.query.unitCode,
        managerId: req.query.managerId,
        lifecycleState: req.query.lifecycleState,
      });
      return res.json({ data: rows });
    }

    const rows = await listUsers(req.user);
    res.json({ data: rows });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/directory/facets', async (req, res, next) => {
  try {
    const facets = await directoryFacets(req.user);
    res.json({ data: facets });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/**
 * GET /users/me/team — backs /app/me/team (route guide §2.1): "manager card, peers, key
 * contacts (HR, IT, HSE, Quality)".
 *
 * Everything is resolved from the caller's own id, never from a query parameter, so this
 * endpoint has no way to return somebody else's team. "Peers" is defined structurally — the
 * holders of the other posts sharing the caller's parent post — which is the same sibling
 * rule getVisibleTree uses, so this page and the organigram agree on who a peer is. The
 * caller is excluded from their own peer list.
 *
 * Declared above `GET /:id` so "me" is not read as a user id.
 */
router.get('/me/team', async (req, res, next) => {
  try {
    assertCan(req.user, 'read', 'organization_unit', { ownerUserId: req.user.id });

    const HOLDER = {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      avatarUrl: true,
    };

    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        manager: {
          select: {
            ...HOLDER,
            assignments: {
              where: { endDate: null },
              take: 1,
              select: { position: { select: { titleFr: true } } },
            },
          },
        },
        assignments: {
          where: { endDate: null },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            position: {
              select: {
                id: true,
                titleFr: true,
                parentPositionId: true,
                organizationUnit: { select: { nameFr: true } },
              },
            },
          },
        },
      },
    });

    const myPosition = me?.assignments[0]?.position ?? null;

    /*
     * With no parent post there is no sibling set to speak of, and falling back to "everyone
     * in the unit" would widen the answer past what was asked for. An empty list is correct.
     */
    const peerAssignments = myPosition?.parentPositionId
      ? await prisma.assignment.findMany({
          where: {
            endDate: null,
            userId: { not: req.user.id },
            position: {
              archivedAt: null,
              parentPositionId: myPosition.parentPositionId,
            },
          },
          select: {
            position: { select: { id: true, titleFr: true, organizationUnit: { select: { nameFr: true } } } },
            user: { select: HOLDER },
          },
        })
      : [];

    const contacts = await prisma.contact.findMany({
      orderBy: [{ priorityRank: 'asc' }, { order: 'asc' }],
      select: { id: true, nameFr: true, roleFr: true, extension: true, priorityFr: true, initials: true },
    });

    res.json({
      data: {
        manager: me?.manager
          ? {
              id: me.manager.id,
              displayName: me.manager.displayName,
              email: me.manager.email,
              phone: me.manager.phone,
              avatarUrl: me.manager.avatarUrl,
              positionTitleFr: me.manager.assignments[0]?.position.titleFr ?? null,
            }
          : null,
        myPosition: myPosition
          ? {
              id: myPosition.id,
              titleFr: myPosition.titleFr,
              organizationUnitNameFr: myPosition.organizationUnit?.nameFr ?? null,
            }
          : null,
        peers: peerAssignments
          .map((row) => ({
            id: row.user.id,
            displayName: row.user.displayName,
            email: row.user.email,
            phone: row.user.phone,
            avatarUrl: row.user.avatarUrl,
            positionTitleFr: row.position.titleFr,
            organizationUnitNameFr: row.position.organizationUnit?.nameFr ?? null,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')),
        contacts,
      },
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/**
 * POST /users/me/avatar — the caller's own profile photo, for the org-chart cards of §2.1.
 *
 * The target is resolved as the caller's own id and the row written is `context.user.id`;
 * nothing in the body names a user. That is deliberate: the alternative — accepting a
 * userId and checking `user:update` — would let anyone holding that permission overwrite
 * somebody's photo, which no screen in the product asks for.
 *
 * With no Cloudinary credentials, uploadBuffer throws StorageNotConfiguredError (status
 * 501); it is re-thrown with that status so the response says "no storage is configured"
 * rather than a generic failure.
 */
router.post('/me/avatar', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'invalid', message: 'Aucun fichier reçu.' });

    if (!isStorageConfigured()) {
      return res.status(501).json({
        error: 'not-implemented',
        message:
          "Aucun espace de stockage n'est configuré : la photo de profil ne peut pas être enregistrée pour l'instant.",
      });
    }

    const result = await mutate(req, {}, {
      schema: z.object({}),
      requires: { resource: 'dashboard', action: 'read' },
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (_value, context) => {
        const before = await context.tx.user.findUnique({
          where: { id: context.user.id },
          select: { avatarUrl: true },
        });

        let stored;
        try {
          stored = await uploadBuffer({
            buffer: req.file.buffer,
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            folder: 'soficlef/avatars',
          });
        } catch (error) {
          throw Object.assign(error, { status: error.status ?? 500 });
        }

        const after = await context.tx.user.update({
          where: { id: context.user.id },
          data: { avatarUrl: stored.url },
          select: { id: true, avatarUrl: true },
        });

        await context.audit({
          action: 'entity.updated',
          entityType: 'user',
          entityId: after.id,
          before: { avatarUrl: before?.avatarUrl ?? null },
          after: { avatarUrl: after.avatarUrl },
        });

        return { avatarUrl: after.avatarUrl };
      },
    });

    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await loadEmployee(req.user, req.params.id);
    if (!employee) return res.status(404).json({ error: 'not-found' });
    res.json({ data: employee });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const CreateUser = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).nullable().optional(),
});

/** POST /users — account creation (SI's half of the provisioning chain). */
router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateUser,
    requires: { resource: 'user', action: 'create' },
    run: async (value, context) => {
      const clash = await context.tx.user.findUnique({ where: { email: value.email.trim().toLowerCase() }, select: { id: true } });
      if (clash) throw Object.assign(new Error('Un compte existe déjà avec cet e-mail.'), { status: 409 });

      const passwordHash = await hashPassword(value.password);

      const created = await context.tx.user.create({
        data: {
          email: value.email.trim().toLowerCase(),
          passwordHash,
          displayName: value.displayName,
          phone: value.phone ?? null,
        },
        select: { id: true, email: true, displayName: true, status: true, lifecycleState: true },
      });

      await context.audit({
        action: 'user.created',
        entityType: 'user',
        entityId: created.id,
        after: created,
      });

      return { id: created.id };
    },
  });
  sendActionResult(res, result, 201);
});

const ImportRow = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  roleCode: z.enum(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']).nullable().optional(),
});

const ImportUsers = z.object({
  rows: z.array(ImportRow).min(1).max(200),
  // A temporary password shared by the batch. The accounts are created suspended-free but
  // with no session, and `/users/:id/reset-access` is the way to force a re-issue later.
  password: z.string().min(8),
});

/**
 * POST /users/import — bulk account creation (route guide §2.4, "import en masse").
 *
 * All-or-nothing: mutate() runs the whole batch in one transaction, so a file with one bad
 * row creates nothing rather than half a promotion. The per-row result the caller gets back
 * says which row failed and why, which is what makes the file fixable — a bare 422 would
 * not. Duplicate e-mails are detected against the database *and* within the batch itself,
 * since two identical rows in one file would otherwise fail on a unique-constraint error
 * the administrator cannot read.
 */
router.post('/import', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: ImportUsers,
    requires: { resource: 'user', action: 'create' },
    run: async (value, context) => {
      const normalized = value.rows.map((row) => ({ ...row, email: row.email.trim().toLowerCase() }));

      const existing = await context.tx.user.findMany({
        where: { email: { in: normalized.map((row) => row.email) } },
        select: { email: true },
      });
      const taken = new Set(existing.map((row) => row.email));

      const seen = new Set();
      const rejected = [];
      normalized.forEach((row, index) => {
        if (taken.has(row.email)) {
          rejected.push({ index, email: row.email, reasonFr: 'Un compte existe déjà avec cet e-mail.' });
        } else if (seen.has(row.email)) {
          rejected.push({ index, email: row.email, reasonFr: 'E-mail présent deux fois dans le fichier.' });
        }
        seen.add(row.email);
      });

      if (rejected.length > 0) {
        throw Object.assign(
          new Error(
            `${rejected.length} ligne(s) refusée(s) : ${rejected
              .map((row) => `ligne ${row.index + 1} — ${row.reasonFr}`)
              .join(' ; ')}`,
          ),
          { status: 409 },
        );
      }

      const passwordHash = await hashPassword(value.password);
      const roles = await context.tx.role.findMany({ select: { id: true, code: true } });
      const roleByCode = new Map(roles.map((role) => [role.code, role.id]));

      const globalScope = await context.tx.scope.findFirst({
        where: { type: 'GLOBAL' },
        select: { id: true },
      });

      const created = [];
      for (const row of normalized) {
        const user = await context.tx.user.create({
          data: {
            email: row.email,
            passwordHash,
            displayName: row.displayName,
            phone: row.phone ?? null,
          },
          select: { id: true, email: true, displayName: true },
        });

        // A role is granted only when the catalogue holds it and a global scope row exists
        // to hang it on; otherwise the account is created without one and the row says so,
        // rather than the import failing over a reference table it does not own.
        let roleGranted = null;
        const roleId = row.roleCode ? roleByCode.get(row.roleCode) : null;
        if (roleId && globalScope) {
          await context.tx.userRole.create({
            data: { userId: user.id, roleId, scopeId: globalScope.id },
          });
          roleGranted = row.roleCode;
        }

        await context.audit({
          action: 'user.created',
          entityType: 'user',
          entityId: user.id,
          after: { ...user, importedBatch: true, roleGranted },
        });

        created.push({ ...user, roleGranted, roleRequested: row.roleCode ?? null });
      }

      return { createdCount: created.length, created };
    },
  });

  sendActionResult(res, result, 201);
});

const SetStatus = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']) });

/**
 * PATCH /users/:id/status — suspend or re-enable an account. `can()` inside mutate()
 * checks user:update; the self-protection check happens in run().
 */
router.patch('/:id/status', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: SetStatus,
    requires: { resource: 'user', action: 'update' },
    run: async (value, context) => {
      if (req.params.id === context.user.id) {
        throw Object.assign(new Error('cannot change your own status'), { status: 409 });
      }

      const before = await context.tx.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, status: true },
      });
      if (!before) throw Object.assign(new Error('unknown user'), { status: 404 });

      const after = await context.tx.user.update({
        where: { id: req.params.id },
        data: { status: value.status },
        select: { id: true, email: true, status: true },
      });

      if (value.status !== 'ACTIVE') {
        await context.tx.session.deleteMany({ where: { userId: req.params.id } });
      }

      await context.audit({
        action: 'user.status_changed',
        entityType: 'user',
        entityId: after.id,
        before,
        after,
      });

      return { status: after.status };
    },
  });
  sendActionResult(res, result);
});

/**
 * POST /users/:id/reset-access — revokes every live session of an account (route guide
 * §2.4, "réinitialiser les accès").
 *
 * Sessions are revoked rather than deleted: `revokedAt` keeps the row, so the audit trail
 * and /admin/security's "sessions révoquées" count still show that the access existed and
 * was withdrawn. Deleting them would erase that evidence.
 *
 * What this does *not* do is issue a new password. There is no SMTP connector in this
 * deployment (domain/admin/connectors.js), so a generated password could not be delivered
 * to the person, and printing one into an HTTP response would put a live credential in a
 * browser log. The account keeps its password and loses its sessions; the /admin/users page
 * states that plainly.
 */
router.post('/:id/reset-access', async (req, res) => {
  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'user', action: 'update' },
    run: async (_value, context) => {
      const target = await context.tx.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, displayName: true },
      });
      if (!target) throw Object.assign(new Error('unknown user'), { status: 404 });

      const now = new Date();
      const revoked = await context.tx.session.updateMany({
        where: { userId: req.params.id, revokedAt: null },
        data: { revokedAt: now },
      });

      await context.audit({
        action: 'auth.session_revoked',
        entityType: 'user',
        entityId: target.id,
        before: null,
        after: { revokedSessions: revoked.count, revokedAt: now, reason: 'admin.reset_access' },
      });

      return { revokedSessions: revoked.count };
    },
  });

  sendActionResult(res, result);
});

/**
 * POST /users/:id/roles — grants a role. Delegates to assignRole(), which carries the
 * privilege-escalation guard (holding user:assign_role never lets you widen your own
 * access). Ported from src/app/api/v1/users/[id]/roles/route.ts.
 */
router.post('/:id/roles', async (req, res, next) => {
  try {
    const context = { ip: ipFromReq(req), userAgent: req.headers['user-agent'] ?? null };
    const result = await assignRole(req.user, { ...req.body, userId: req.params.id }, context);

    if (result.ok) return res.status(201).json({ data: { userRoleId: result.userRoleId } });

    switch (result.reason) {
      case 'forbidden':
        return res.status(403).json({ error: 'forbidden' });
      case 'self-assignment':
        return res.status(403).json({ error: 'self_assignment_refused' });
      case 'unknown-user':
        return res.status(404).json({ error: 'not_found' });
      default:
        return res.status(422).json({ error: 'invalid_input' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
