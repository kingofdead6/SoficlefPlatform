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
