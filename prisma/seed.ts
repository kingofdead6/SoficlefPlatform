/**
 * Seeds the security model and the organizational skeleton.
 *
 *   npm run db:seed
 *
 * Idempotent: it upserts by business code, so it can be re-run after a schema change or
 * against a partially seeded database.
 *
 * No password is hardcoded. Demo accounts take their password from SEED_DEMO_PASSWORD;
 * if it is unset, one is generated and printed once, and never written anywhere else
 * (ADR-023).
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { hash } from '@node-rs/argon2';

import { PrismaClient } from '../src/infrastructure/db/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { ALL_PERMISSIONS, ROLE_PERMISSIONS, parsePermission } from '../src/domain/auth/permissions';
import { ROLES, type RoleCode } from '../src/domain/auth/roles';
import { OrganizationFile } from '../seed/schemas/organization';
import { WelcomeFile } from '../seed/schemas/welcome';

const ARGON2ID = 2;

const WELCOME = WelcomeFile.parse(
  JSON.parse(readFileSync(new URL('../seed/data/welcome.json', import.meta.url), 'utf8')),
).data;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Organizational skeleton, derived from the extracted prototype data (Part 1). */
function organizationSkeleton() {
  const organization = OrganizationFile.parse(
    JSON.parse(readFileSync(new URL('../seed/data/organization.json', import.meta.url), 'utf8')),
  ).data;

  const units: { code: string; nameFr: string; type: string; parentCode: string | null }[] = [
    { code: 'DPR', nameFr: 'Direction de Production', type: 'DIRECTION', parentCode: null },
  ];

  const codeOf = (nameFr: string) =>
    nameFr
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .slice(0, 3)
      .join('-');

  for (const structure of organization.structures) {
    units.push({
      code: `DPR-${codeOf(structure.nameFr.replace(/^Structure\s+/i, ''))}`,
      nameFr: structure.nameFr,
      type: 'STRUCTURE',
      parentCode: 'DPR',
    });
  }
  for (const unit of organization.units) {
    const parent = organization.structures.find((s) => s.id === unit.parentStructureId);
    units.push({
      code: `DPR-${codeOf(unit.nameFr)}`,
      nameFr: unit.nameFr,
      type: 'UNITE_PRODUCTION',
      parentCode: parent ? `DPR-${codeOf(parent.nameFr.replace(/^Structure\s+/i, ''))}` : 'DPR',
    });
  }
  for (const cell of organization.cells) {
    units.push({
      code: `DPR-${codeOf(cell.nameFr.replace(/^Cellule\s+/i, ''))}`,
      nameFr: cell.nameFr,
      type: 'CELLULE',
      parentCode: 'DPR',
    });
  }

  return units;
}

async function seedPermissionsAndRoles(): Promise<void> {
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

    // Re-derive the links so a permission removed from the catalogue is removed here too.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }
}

async function seedOrganization(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const unit of organizationSkeleton()) {
    const parentId = unit.parentCode ? (ids.get(unit.parentCode) ?? null) : null;
    const record = await prisma.organizationUnit.upsert({
      where: { code: unit.code },
      create: { code: unit.code, nameFr: unit.nameFr, type: unit.type, parentId },
      update: { nameFr: unit.nameFr, type: unit.type, parentId },
      select: { id: true },
    });
    ids.set(unit.code, record.id);
  }
  return ids;
}

async function scopeFor(unitId: string | null): Promise<string | null> {
  if (!unitId) return null;
  const scope = await prisma.scope.upsert({
    where: { type_organizationUnitId: { type: 'ORGANIZATION_UNIT', organizationUnitId: unitId } },
    create: { type: 'ORGANIZATION_UNIT', organizationUnitId: unitId },
    update: {},
    select: { id: true },
  });
  return scope.id;
}

interface DemoUser {
  email: string;
  displayName: string;
  locale: string;
  roles: { code: RoleCode; unitCode?: string }[];
  /** ISO date, for the people who have an onboarding journey. */
  onboardingStartDate?: string;
}

/**
 * Demo accounts mirroring the real cast, so the role model can be walked through with
 * the client. Real accounts are created through the administration screens.
 */
const DEMO_USERS: DemoUser[] = [
  {
    email: 'tech.admin@soficlef.local',
    displayName: 'Administrateur technique',
    locale: 'fr',
    roles: [{ code: 'TECH_ADMIN' }],
  },
  {
    email: 'mostafa@soficlef.local',
    displayName: 'M. Mostafa — Responsable Compétences & Emplois',
    locale: 'fr',
    roles: [{ code: 'HEAD_CE' }],
  },
  {
    email: 'chanane@soficlef.local',
    displayName: 'CHANANE Mohamed Rafik — Emploi & Compétences',
    locale: 'fr',
    roles: [{ code: 'BIZ_ADMIN_CE' }],
  },
  {
    email: 'drh@soficlef.local',
    displayName: 'Direction des Ressources Humaines',
    locale: 'fr',
    roles: [{ code: 'HR' }],
  },
  {
    // The pilot user is both the subject of an onboarding journey and the head of a
    // structure — two assignments, which is exactly why CDC v1's DIR_PROD maps onto two
    // of CDC v0.1's profiles (ADR-005).
    email: 'djaoudi@soficlef.local',
    displayName: 'DJAOUDI Farid — Directeur de Production',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }, { code: 'MANAGER', unitCode: 'DPR' }],
    // Taken from the extracted prototype data, not retyped.
    onboardingStartDate: WELCOME.startDate,
  },
  {
    // A collaborator with no managerial breadth: their rights end at their own records,
    // which is what CDC v0.1 §3's "Collaborateur" profile means.
    email: 'boubenia@soficlef.local',
    displayName: 'BOUBENIA Ahmed — Référent Production',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
  },
  {
    email: 'oudni@soficlef.local',
    displayName: 'OUDNI Yassine — Responsable Fabrication',
    locale: 'fr',
    roles: [{ code: 'MANAGER', unitCode: 'DPR-FABRICATION' }],
  },
  {
    email: 'charikhi@soficlef.local',
    displayName: 'M. CHARIKHI Sofiane — Directeur Général',
    locale: 'fr',
    roles: [{ code: 'VIEWER' }],
  },
];

async function seedDemoUsers(unitIds: Map<string, string>, password: string): Promise<void> {
  const passwordHash = await hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        displayName: demo.displayName,
        locale: demo.locale,
        passwordHash,
        onboardingStartDate: demo.onboardingStartDate ? new Date(demo.onboardingStartDate) : null,
      },
      update: {
        displayName: demo.displayName,
        passwordHash,
        onboardingStartDate: demo.onboardingStartDate ? new Date(demo.onboardingStartDate) : null,
      },
      select: { id: true },
    });

    for (const assignment of demo.roles) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: assignment.code },
        select: { id: true },
      });
      const unitId = assignment.unitCode ? (unitIds.get(assignment.unitCode) ?? null) : null;
      if (assignment.unitCode && !unitId) {
        throw new Error(`unknown organization unit code in demo data: ${assignment.unitCode}`);
      }
      const scopeId = await scopeFor(unitId);

      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, scopeId },
        select: { id: true },
      });
      if (!existing) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, scopeId } });
      }
    }
  }
}

async function main(): Promise<void> {
  const generated = !process.env.SEED_DEMO_PASSWORD;
  const password =
    process.env.SEED_DEMO_PASSWORD ?? `Soficlef-${randomBytes(9).toString('base64url')}`;

  await seedPermissionsAndRoles();
  const unitIds = await seedOrganization();
  await seedDemoUsers(unitIds, password);

  console.log(`✔ ${ALL_PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles`);
  console.log(`✔ ${unitIds.size} organization units`);
  console.log(`✔ ${DEMO_USERS.length} demo users`);
  if (generated) {
    console.log(`\n  Demo password (shown once, not stored anywhere): ${password}`);
    console.log('  Set SEED_DEMO_PASSWORD to choose your own.\n');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
