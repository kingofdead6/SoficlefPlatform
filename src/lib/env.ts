import { z } from 'zod';

/**
 * Environment is parsed once, at the server boundary, like every other input
 * (ADR-014). A missing or malformed variable fails at startup with a readable
 * message rather than as `undefined` somewhere downstream.
 *
 * Never import this from a client component: it would leak server-only values into
 * the browser bundle.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a connection URL')
    // `new URL()` happily accepts "localhost:5432" (scheme "localhost:"), so the
    // protocol is checked explicitly rather than assumed.
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      'DATABASE_URL must start with postgres:// or postgresql://',
    ),
  APP_URL: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value), 'APP_URL must be an http(s) URL')
    .default('http://localhost:3000'),

  // ── Authentication (Part 3) ────────────────────────────────────────────────
  // Secrets and policy values are configuration, never constants in code
  // (ADR-012, ADR-023).
  AUTH_SESSION_SECRET: z
    .string()
    .min(
      32,
      'AUTH_SESSION_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`',
    ),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43_200),
  AUTH_SESSION_RENEW_WINDOW_SECONDS: z.coerce.number().int().positive().default(3_600),
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(12),
  AUTH_ARGON2_MEMORY_KIB: z.coerce.number().int().min(8_192).default(19_456),
  AUTH_ARGON2_ITERATIONS: z.coerce.number().int().min(2).default(2),
  AUTH_ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Counted per source address, and only against *failed* attempts. A whole plant can
  // sit behind one VPN egress, so this guards automated abuse without locking out
  // everyone who shares an IP with someone who mistyped their password.
  AUTH_LOGIN_IP_MAX_FAILURES: z.coerce.number().int().positive().default(50),
  AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  cached = parsed.data;
  return cached;
}

/** Exposed for tests, which construct their own environments. */
export const __serverSchema = serverSchema;
