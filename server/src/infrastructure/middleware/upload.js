import multer from 'multer';

/**
 * multer with in-memory storage — files are buffered then streamed to Cloudinary by the
 * route handler (see infrastructure/storage/cloudinary.js#uploadBuffer). Avoids writing
 * to local disk, which would not survive across instances/deploys anyway.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
