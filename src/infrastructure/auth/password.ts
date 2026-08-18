import 'server-only';

import { hash, verify } from '@node-rs/argon2';

import { serverEnv } from '@/lib/env';
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from '@/domain/auth/password-policy';

/**
 * Argon2id hashing (ADR-012). Parameters come from configuration so they can be raised
 * as hardware improves, without a code change.
 */
/**
 * `Algorithm.Argon2id` is a const enum, which `isolatedModules` cannot inline, so the
 * variant is written as its numeric value. 2 is Argon2id — the memory-hard, side-channel
 * resistant variant OWASP recommends for password storage.
 */
const ARGON2ID = 2;

function options() {
  const env = serverEnv();
  return {
    algorithm: ARGON2ID,
    memoryCost: env.AUTH_ARGON2_MEMORY_KIB,
    timeCost: env.AUTH_ARGON2_ITERATIONS,
    parallelism: env.AUTH_ARGON2_PARALLELISM,
  };
}

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, options());
}

export async function verifyPassword(digest: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(digest, plaintext);
  } catch {
    // A malformed or truncated hash must read as "wrong password", not as a crash that
    // tells an attacker something about the stored value.
    return false;
  }
}

/**
 * A hash of a value nobody knows, verified against every failed login for an unknown
 * e-mail. Without it, "user does not exist" returns measurably faster than "wrong
 * password" and the login endpoint becomes an account-enumeration oracle.
 */
let dummyHash: Promise<string> | undefined;

export function dummyVerify(plaintext: string): Promise<boolean> {
  dummyHash ??= hashPassword(`unused-${crypto.randomUUID()}`);
  return dummyHash.then((digest) => verifyPassword(digest, plaintext));
}

export function passwordPolicy(): PasswordPolicy {
  return { ...DEFAULT_PASSWORD_POLICY, minLength: serverEnv().AUTH_PASSWORD_MIN_LENGTH };
}
