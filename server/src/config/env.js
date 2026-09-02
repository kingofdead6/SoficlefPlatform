import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer`);
  return parsed;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: int('PORT', 4000),
  APP_URL: process.env.APP_URL ?? 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL ?? '',

  AUTH_SESSION_SECRET: required('AUTH_SESSION_SECRET', 'dev-only-insecure-secret-change-me'),
  AUTH_SESSION_TTL_SECONDS: int('AUTH_SESSION_TTL_SECONDS', 12 * 60 * 60),
  AUTH_SESSION_RENEW_WINDOW_SECONDS: int('AUTH_SESSION_RENEW_WINDOW_SECONDS', 60 * 60),

  AUTH_ARGON2_MEMORY_KIB: int('AUTH_ARGON2_MEMORY_KIB', 19456),
  AUTH_ARGON2_ITERATIONS: int('AUTH_ARGON2_ITERATIONS', 2),
  AUTH_ARGON2_PARALLELISM: int('AUTH_ARGON2_PARALLELISM', 1),
  AUTH_PASSWORD_MIN_LENGTH: int('AUTH_PASSWORD_MIN_LENGTH', 12),

  AUTH_LOGIN_MAX_ATTEMPTS: int('AUTH_LOGIN_MAX_ATTEMPTS', 5),
  AUTH_LOGIN_WINDOW_SECONDS: int('AUTH_LOGIN_WINDOW_SECONDS', 15 * 60),
  AUTH_LOGIN_IP_MAX_FAILURES: int('AUTH_LOGIN_IP_MAX_FAILURES', 20),

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // Hugging Face Inference (OpenAI-compatible router). Blank HF_API_KEY is a supported
  // state, not a misconfiguration: the assistant then answers by retrieval alone.
  HF_API_KEY: process.env.HF_API_KEY ?? '',
  HF_MODEL: process.env.HF_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
  HF_BASE_URL: process.env.HF_BASE_URL ?? 'https://router.huggingface.co/v1',
  HF_TIMEOUT_MS: int('HF_TIMEOUT_MS', 20000),
  HF_MAX_TOKENS: int('HF_MAX_TOKENS', 400),
};

export function serverEnv() {
  return env;
}
