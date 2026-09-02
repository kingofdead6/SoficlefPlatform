import { Router } from 'express';

import { listRoles, listUnitsForScope } from '../application/admin/directory.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Roles — the permission matrix screen (role:read), ported from
 * src/application/admin/directory.ts's listRoles/listUnitsForScope. Role *assignment* is
 * exposed as POST /users/:id/roles (see users.routes.js), matching the source app's
 * [id]/roles endpoint shape.
 */

router.get('/', async (req, res, next) => {
  try {
    const roles = await listRoles(req.user);
    res.json({ data: roles });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/scopes', async (req, res, next) => {
  try {
    const units = await listUnitsForScope(req.user);
    res.json({ data: units });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

export default router;
