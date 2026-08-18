import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { serverEnv } from '@/lib/env';

import { PrismaClient } from './generated/client';

/**
 * The single Prisma client for the process.
 *
 * Prisma 7 connects through a driver adapter; the connection URL comes from the
 * validated environment (ADR-014, ADR-023). In development the client is cached on
 * `globalThis` so hot reload does not open a new pool on every edit.
 *
 * Repositories in `src/infrastructure/` are the only modules that import this. The
 * domain layer never sees Prisma (ADR-019), and scope filtering happens here in the
 * query, not in the UI (ADR-021).
 */
function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: serverEnv().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: serverEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (serverEnv().NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
