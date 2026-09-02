import { Router } from 'express';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { upload } from '../infrastructure/middleware/upload.js';
import { uploadBuffer, isStorageConfigured } from '../infrastructure/storage/cloudinary.js';

/**
 * Generic Cloudinary upload endpoint, for callers that just need a `storageKey`/`url`
 * back without being tied to a specific domain resource (documents and personal-files
 * have their own dedicated upload flows — see documents.routes.js / personal-files.routes.js).
 */

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ storageConfigured: isStorageConfigured() });
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'bad_request', detail: 'file is required' });

    const stored = await uploadBuffer({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    res.status(201).json({ data: stored });
  } catch (error) {
    if (error?.status === 501) return res.status(501).json({ error: 'storage_not_configured' });
    next(error);
  }
});

export default router;
