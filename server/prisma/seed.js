/**
 * Minimal seed for the migrated backend: RBAC scaffolding (permissions + roles) and a
 * handful of demo accounts, so the app is logins-testable end to end.
 *
 * This is a SCOPED-DOWN port of SoficlefPlatform/prisma/seed.ts — the source seed also
 * builds the full organizational skeleton and every content domain (company, strategy,
 * kaizen, QMS, HSE, contacts, documents, recruitment, onboarding templates, welcome
 * content) from 14 zod-validated JSON files under SoficlefPlatform/seed/data/. That
 * content pipeline was NOT ported (out of scope for this pass) — only the security
 * model and demo accounts are seeded here. See the migration report for what's missing.
 *
 * Idempotent: upserts by code/email, safe to re-run.
 *
 *   node prisma/seed.js
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
// Default import, not `import { PrismaClient }` — see the comment in
// src/infrastructure/db/client.js for why the named import breaks on some Node versions.
import prismaClientPkg from '@prisma/client';

import { ALL_PERMISSIONS, ROLE_PERMISSIONS, parsePermission } from '../src/domain/auth/permissions.js';
import { ROLES } from '../src/domain/auth/roles.js';

const { PrismaClient } = prismaClientPkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Soficlef#2026Demo';

const DEMO_USERS = [
  { email: 'admin@soficlef.local', displayName: 'Admin Soficlef', role: 'ADMIN' },
  { email: 'rh@soficlef.local', displayName: 'RH Soficlef', role: 'HR' },
  { email: 'manager@soficlef.local', displayName: 'Manager Soficlef', role: 'MANAGER' },
  { email: 'employe@soficlef.local', displayName: 'Employé Soficlef', role: 'EMPLOYEE' },
];

async function seedPermissionsAndRoles() {
  for (const code of ALL_PERMISSIONS) {
    const parsed = parsePermission(code);
    if (!parsed) throw new Error(`malformed permission code: ${code}`);
    await prisma.permission.upsert({
      where: { code },
      create: { code, resource: parsed.resource, action: parsed.action },
      update: { resource: parsed.resource, action: parsed.action },
    });
  }

  for (const definition of Object.values(ROLES)) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      create: {
        code: definition.code,
        nameFr: definition.nameFr,
        nameEn: definition.nameEn,
        description: definition.descriptionFr,
      },
      update: { nameFr: definition.nameFr, nameEn: definition.nameEn },
      select: { id: true },
    });

    const codes = ROLE_PERMISSIONS[definition.code];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }
}

async function seedDemoUsers() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        displayName: demo.displayName,
        passwordHash,
        status: 'ACTIVE',
        // Demo accounts are pre-assigned so they can exercise the whole app immediately.
        lifecycleState: 'ASSIGNED',
      },
      update: { displayName: demo.displayName },
      select: { id: true },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: demo.role },
      select: { id: true },
    });

    let scopeId = null;
    if (ROLES[demo.role].naturalScope === 'ORGANIZATION_UNIT') {
      // No organizational skeleton seeded in this minimal pass, so a MANAGER demo
      // account is granted GLOBAL for now rather than an unscoped (and therefore
      // empty) ORGANIZATION_UNIT assignment. Note in the report: revisit once real
      // org units exist.
      const scope = await prisma.scope.upsert({
        where: { type_organizationUnitId: { type: 'GLOBAL', organizationUnitId: null } },
        create: { type: 'GLOBAL' },
        update: {},
        select: { id: true },
      });
      scopeId = scope.id;
    } else {
      const scope = await prisma.scope.upsert({
        where: { type_organizationUnitId: { type: ROLES[demo.role].naturalScope, organizationUnitId: null } },
        create: { type: ROLES[demo.role].naturalScope },
        update: {},
        select: { id: true },
      });
      scopeId = scope.id;
    }

    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, scopeId } });
    }
  }
}

async function main() {
  await seedPermissionsAndRoles();
  await seedDemoUsers();

  console.log('Seed complete.');
  console.log(`Demo accounts (password: ${process.env.SEED_DEMO_PASSWORD ? '<from SEED_DEMO_PASSWORD>' : DEMO_PASSWORD}):`);
  for (const demo of DEMO_USERS) console.log(`  ${demo.email} — ${demo.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
