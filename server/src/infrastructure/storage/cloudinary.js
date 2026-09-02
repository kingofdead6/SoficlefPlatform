import { v2 as cloudinary } from 'cloudinary';

import { serverEnv } from '../../config/env.js';

/**
 * Real Cloudinary integration, replacing the source app's intentionally-unwired
 * `file-storage.ts` abstraction (which threw `StorageNotConfiguredError` on every write —
 * OQ-14/OQ-15 were left open there). Wired here per the migration brief: Cloudinary +
 * multer, credentials from env.
 */
export function isStorageConfigured() {
  const env = serverEnv();
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const env = serverEnv();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export class StorageNotConfiguredError extends Error {
  status = 501;
  constructor() {
    super(
      "Aucun espace de stockage n'est configuré. Les pièces peuvent être transmises aux RH par un autre canal en attendant.",
    );
    this.name = 'StorageNotConfiguredError';
  }
}

/**
 * Uploads a buffer (from multer's memoryStorage) to Cloudinary and returns a stored-file
 * descriptor whose `key` (the Cloudinary `public_id`) is what gets written to
 * `PersonalFile.storageKey` / `Document.storageKey`.
 */
export async function uploadBuffer({ buffer, fileName, contentType, folder = 'soficlef' }) {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        filename_override: fileName,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({
          key: result.public_id,
          fileName,
          sizeBytes: result.bytes,
          contentType,
          url: result.secure_url,
          resourceType: result.resource_type,
        });
      },
    );
    stream.end(buffer);
  });
}

export async function urlFor(key, resourceType = 'auto') {
  if (!isStorageConfigured() || !key) return null;
  ensureConfigured();
  return cloudinary.url(key, { resource_type: resourceType, secure: true });
}

export async function remove(key, resourceType = 'auto') {
  if (!isStorageConfigured() || !key) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(key, { resource_type: resourceType });
}
