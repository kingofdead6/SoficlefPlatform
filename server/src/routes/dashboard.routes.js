import { Router } from 'express';

import { loadDashboard } from '../application/dashboard/kpis.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /dashboard — the role-aware KPI figures (CDC v0.1 §10), ported from
 * src/application/dashboard/kpis.ts. Every block is scoped internally and null when the
 * caller holds none of the relevant permission.
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await loadDashboard(req.user);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
