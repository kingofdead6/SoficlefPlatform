import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { serverEnv } from '../../config/env.js';

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
