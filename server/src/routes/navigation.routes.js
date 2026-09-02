import { Router } from 'express';

import { can } from '../domain/auth/authorization.js';
import { NAV_ITEMS } from '../domain/navigation/navigation.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /navigation — the nav tree filtered to what the current user may see. The sidebar
 * uses this as a courtesy; every route it links to re-checks the same permission via
 * can()/assertCan() server-side.
 */
router.get('/', (req, res) => {
  const items = NAV_ITEMS.filter((item) => can(req.user, item.requires.action, item.requires.resource));
  res.json({ data: items });
});

export default router;
