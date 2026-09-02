import { Router } from 'express';

import { listAuditTrail } from '../application/admin/directory.js';
import { loadAdminConsole, listActiveSessions, loadProvisioningQueue } from '../application/admin/console.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * The audit trail (audit_log:read), paginated, plus the admin console's live figures.
 * Ported from src/application/admin/directory.ts's listAuditTrail and
 * src/application/admin/console.ts.
 */

router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const rows = await listAuditTrail(req.user, limit, {
      search: req.query.search,
      action: req.query.action,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ data: rows });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/console', async (req, res, next) => {
  try {
    const data = await loadAdminConsole(req.user);
    res.json({ data });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/console/sessions', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const rows = await listActiveSessions(req.user, limit);
    res.json({ data: rows });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/console/provisioning', async (req, res, next) => {
  try {
    const queue = await loadProvisioningQueue(req.user);
    res.json({ data: queue });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

export default router;
