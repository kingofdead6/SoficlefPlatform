import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config file — connection URL for `prisma migrate` / `prisma generate` CLI
 * commands lives here now (schema.prisma datasource.url is no longer supported).
 * The runtime PrismaClient itself connects via the `@prisma/adapter-pg` driver adapter,
 * see src/infrastructure/db/client.js.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  /*
   * Required by `prisma migrate` in Prisma 7: without it every migrate command exits with
   * "The datasource.url property is required in your Prisma config file", which is how a
   * set of migrations came to exist on disk without ever reaching the database.
   */
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
