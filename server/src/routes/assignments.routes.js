import { Router } from 'express';

import {
  assignToPosition,
  endAssignment,
  listAccountRequests,
  listAssignments,
  listPendingAccounts,
  listVacantPositions,
} from '../application/organization/assignments.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';
import { sendActionResult } from '../application/shared/mutate.js';

const router = Router();
router.use(requireAuth);

/**
 * The provisioning chain's second step (CDC-2026 Module 1), ported from
 * app/actions/assignments.ts. Authorization happens inside assignToPosition/endAssignment
 * via mutate(); reads apply scopeFilterFor/assertCanAnyScope inside their own functions.
 */

router.get('/', async (req, res, next) => {
  try {
    const rows = await listAssignments(req.user);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-accounts', async (req, res, next) => {
  try {
    const rows = await listPendingAccounts(req.user);
    res.json({ data: rows });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/account-requests', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await listAccountRequests(req.user, limit);
    res.json({ data: rows });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/vacant-positions', async (req, res, next) => {
  try {
    const rows = await listVacantPositions(req.user);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res) => {
  const result = await assignToPosition(req, req.body);
  sendActionResult(res, result, 201);
});

router.patch('/:id/end', async (req, res) => {
  const result = await endAssignment(req, { ...req.body, assignmentId: req.params.id });
  sendActionResult(res, result);
});

export default router;
