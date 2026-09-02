-- Documents can now carry an uploaded file: the Cloudinary public_id, mirroring
-- personal_file.storageKey. Null when the row is still reference content with no
-- attached upload (titleFr/detailFr only) or storage is not configured yet.
ALTER TABLE "document" ADD COLUMN "storageKey" TEXT;
