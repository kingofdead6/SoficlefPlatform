import { Router } from 'express';
import { z } from 'zod';

import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { assertCan } from '../domain/auth/authorization.js';
import { listSettings, setSetting } from '../infrastructure/settings/app-settings.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Administrable parameters (setting:read / setting:update), exposed over
 * infrastructure/settings/app-settings.js's CRUD. Admin-only, per the source app's
 * `/admin/settings` screen.
 */

router.get('/', async (req, res, next) => {
  try {
    assertCan(req.user, 'read', 'setting');
    const settings = await listSettings();
    res.json({ data: settings });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateSetting = z.object({ value: z.unknown() });

router.patch('/:key', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateSetting,
    requires: { resource: 'setting', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.appSetting.findUnique({ where: { key: req.params.key } });
      const after = await setSetting(req.params.key, value.value);

      await context.audit({
        action: 'entity.updated',
        entityType: 'app_setting',
        entityId: after.id,
        before: before ?? null,
        after,
      });

      return { key: after.key, value: after.value };
    },
  });
  sendActionResult(res, result);
});

export default router;
