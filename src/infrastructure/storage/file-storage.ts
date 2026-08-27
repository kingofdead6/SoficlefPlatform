import 'server-only';

/**
 * Where uploaded files go.
 *
 * **Deliberately unwired.** The storage backend is an open question (OQ-14/OQ-15): the
 * client has not said whether files live on the application server, in Azure Blob Storage
 * alongside the Entra tenant, or on an existing internal share. Choosing one here would be
 * inventing a decision, and the wrong choice is expensive to reverse once files exist.
 *
 * What *is* built is everything around it: the obligations, the statuses, the HR review,
 * the audit trail. `PersonalFile.storageKey` stays null until a backend is configured, and
 * the workflow works without it — somebody can be asked for their diploma, hand it over in
 * person, and have HR mark it accepted, which is how the process runs today anyway.
 *
 * Wiring a backend means implementing this interface and returning it from `fileStorage()`.
 * No call site changes (ADR-011's pattern, applied to storage instead of auth).
 */

export interface StoredFile {
  /** Opaque handle written to `storageKey`; its shape is the backend's business. */
  key: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface FileStorage {
  put(input: {
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<StoredFile>;
  /** A short-lived URL, or null when the backend cannot mint one. */
  urlFor(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  readonly status = 501;

  constructor() {
    super(
      'Aucun espace de stockage n’est configuré. Les pièces peuvent être transmises aux RH ' +
        'par un autre canal en attendant.',
    );
    this.name = 'StorageNotConfiguredError';
  }
}

/**
 * The null backend: refuses every write, clearly and in the user's language.
 *
 * It throws rather than silently accepting and discarding — a file the user believes they
 * submitted, that does not exist, is the worst outcome available here.
 */
const unconfigured: FileStorage = {
  put() {
    return Promise.reject(new StorageNotConfiguredError());
  },
  urlFor() {
    return Promise.resolve(null);
  },
  remove() {
    return Promise.resolve();
  },
};

export function fileStorage(): FileStorage {
  return unconfigured;
}

/** Whether uploads are possible at all, so the UI can say so instead of failing on submit. */
export function isStorageConfigured(): boolean {
  return false;
}
