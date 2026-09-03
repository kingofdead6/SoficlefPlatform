import { PrismaPg } from '@prisma/adapter-pg';
/*
 * Destructured off the default export rather than `import { PrismaClient } from
 * '@prisma/client'`: the generated CJS shim re-exports via `module.exports = { ...require() }`,
 * a spread pattern Node's cjs-module-lexer cannot statically analyze for named exports. Some
 * Node versions tolerate it; Node 24 (Render's default image, ahead of what this app is
 * developed against) does not, and throws "does not provide an export named 'PrismaClient'"
 * at the ESM import site. The default import always carries the full module.exports object
 * regardless of what the lexer could detect, so it works on every Node version.
 */
import prismaClientPkg from '@prisma/client';

import { serverEnv } from '../../config/env.js';

const { PrismaClient } = prismaClientPkg;

/**
 * The single Prisma client for the process. Prisma 7 connects through a driver adapter
 * (ported from infrastructure/db/client.ts). Cached on globalThis so `node --watch`
 * restarts do not open a new pool on every reload in development.
 */
function createClient() {
  const adapter = new PrismaPg({ connectionString: serverEnv().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: serverEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? createClient();

if (serverEnv().NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
