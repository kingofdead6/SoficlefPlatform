import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import { serverEnv } from '../../config/env.js';
import { DEFAULT_PASSWORD_POLICY } from '../../domain/auth/password-policy.js';

/**
 * Argon2id hashing, using the `argon2` npm package (native binding), the plain-JS/Node
 * equivalent of the source app's `@node-rs/argon2`. Parameters come from configuration.
 */
function options() {
  const env = serverEnv();
  return {
    type: argon2.argon2id,
    memoryCost: env.AUTH_ARGON2_MEMORY_KIB,
    timeCost: env.AUTH_ARGON2_ITERATIONS,
    parallelism: env.AUTH_ARGON2_PARALLELISM,
  };
}

export async function hashPassword(plaintext) {
  return argon2.hash(plaintext, options());
}

export async function verifyPassword(digest, plaintext) {
  try {
    return await argon2.verify(digest, plaintext);
  } catch {
    return false;
  }
}

let dummyHash;

export function dummyVerify(plaintext) {
  dummyHash ??= hashPassword(`unused-${randomUUID()}`);
  return dummyHash.then((digest) => verifyPassword(digest, plaintext));
}

export function passwordPolicy() {
  return { ...DEFAULT_PASSWORD_POLICY, minLength: serverEnv().AUTH_PASSWORD_MIN_LENGTH };
}
