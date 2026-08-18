import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL from here rather than from schema.prisma, and the
 * runtime client connects through a driver adapter (see src/infrastructure/db/client.ts).
 *
 * No credential lives in this file — `DATABASE_URL` comes from the environment (ADR-023).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Used by `prisma migrate dev` and by the CI migration check, which replays
    // prisma/migrations into a throwaway database and compares the result with
    // schema.prisma (ADR-017). Optional in normal development.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
