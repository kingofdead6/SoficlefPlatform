/**
 * Seeds the security model, the organizational skeleton, and every content domain.
 *
 *   npm run db:seed
 *
 * Idempotent: it upserts by business code / slug, so it can be re-run after a schema
 * change or against a partially seeded database.
 *
 * No password is hardcoded. Demo accounts take their password from SEED_DEMO_PASSWORD;
 * if it is unset, one is generated and printed once, and never written anywhere else
 * (ADR-023).
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The seed runs as a plain script, outside Next's runtime, so nothing has loaded .env
// for it. `prisma.config.ts` does the same for the CLI.
import 'dotenv/config';

import { hash } from '@node-rs/argon2';

import { PrismaClient } from '../src/infrastructure/db/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { ALL_PERMISSIONS, ROLE_PERMISSIONS, parsePermission } from '../src/domain/auth/permissions';
import { ROLES, type RoleCode } from '../src/domain/auth/roles';

import { CompanyFile } from '../seed/schemas/company';
import { ContactsFile } from '../seed/schemas/contacts';
import { DocumentsFile } from '../seed/schemas/documents';
import { HseFile } from '../seed/schemas/hse';
import { JobDescriptionFile } from '../seed/schemas/job-description';
import { KaizenFile } from '../seed/schemas/kaizen';
import { ManagementTeamFile } from '../seed/schemas/management-team';
import { OnboardingFile } from '../seed/schemas/onboarding';
import { OrganizationFile } from '../seed/schemas/organization';
import { QmsFile } from '../seed/schemas/qms';
import { RecruitmentFile } from '../seed/schemas/recruitment';
import { StrategyFile } from '../seed/schemas/strategy';
import { ValuesFile } from '../seed/schemas/values';
import { WelcomeFile } from '../seed/schemas/welcome';

const ARGON2ID = 2;

const readSeed = <T>(fileName: string): T =>
  JSON.parse(readFileSync(new URL(`../seed/data/${fileName}`, import.meta.url), 'utf8')) as T;

const COMPANY = CompanyFile.parse(readSeed('company.json')).data;
const VALUES = ValuesFile.parse(readSeed('values.json')).data;
const STRATEGY = StrategyFile.parse(readSeed('strategy.json')).data;
const JOB_DESCRIPTION = JobDescriptionFile.parse(readSeed('job-description.json')).data;
const ORGANIZATION = OrganizationFile.parse(readSeed('organization.json')).data;
const MANAGEMENT_TEAM = ManagementTeamFile.parse(readSeed('management-team.json')).data;
const KAIZEN = KaizenFile.parse(readSeed('kaizen.json')).data;
const QMS = QmsFile.parse(readSeed('qms.json')).data;
const HSE = HseFile.parse(readSeed('hse.json')).data;
const CONTACTS = ContactsFile.parse(readSeed('contacts.json')).data;
const DOCUMENTS = DocumentsFile.parse(readSeed('documents.json')).data;
const RECRUITMENT = RecruitmentFile.parse(readSeed('recruitment.json')).data;
const ONBOARDING_MILESTONES = OnboardingFile.parse(readSeed('onboarding-checklist.json')).data;
const WELCOME = WelcomeFile.parse(readSeed('welcome.json')).data;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Organizational skeleton, derived from the extracted prototype data (Part 1). */
function organizationSkeleton() {
  const units: {
    code: string;
    nameFr: string;
    type: string;
    parentCode: string | null;
    icon?: string | null;
    descriptionFr?: string | null;
    headOccupancy?: 'VACANT' | 'TO_FILL' | 'OCCUPIED' | null;
    headLabelFr?: string | null;
    criticalNoteFr?: string | null;
    staffingFr?: string | null;
  }[] = [{ code: 'DPR', nameFr: 'Direction de Production', type: 'DIRECTION', parentCode: null }];

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

  for (const structure of ORGANIZATION.structures) {
    units.push({
      code: `DPR-${codeOf(structure.nameFr.replace(/^Structure\s+/i, ''))}`,
      nameFr: structure.nameFr,
      type: 'STRUCTURE',
      parentCode: 'DPR',
      icon: structure.icon,
      descriptionFr: structure.descriptionFr,
      headOccupancy: structure.headOccupancy,
      headLabelFr: structure.headLabelFr,
      criticalNoteFr: structure.criticalNoteFr,
    });
  }
  for (const unit of ORGANIZATION.units) {
    const parent = ORGANIZATION.structures.find((s) => s.id === unit.parentStructureId);
    units.push({
      code: `DPR-${codeOf(unit.nameFr)}`,
      nameFr: unit.nameFr,
      type: 'UNITE_PRODUCTION',
      parentCode: parent ? `DPR-${codeOf(parent.nameFr.replace(/^Structure\s+/i, ''))}` : 'DPR',
      descriptionFr: unit.descriptionFr,
    });
  }
  for (const cell of ORGANIZATION.cells) {
    units.push({
      code: `DPR-${codeOf(cell.nameFr.replace(/^Cellule\s+/i, ''))}`,
      nameFr: cell.nameFr,
      type: 'CELLULE',
      parentCode: 'DPR',
      icon: cell.icon,
      descriptionFr: cell.descriptionFr,
      staffingFr: cell.staffingFr,
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

/**
 * Removes accounts and roles that the code no longer knows about.
 *
 * Upserts create and update but never delete, so an earlier cast survives every reseed —
 * and after the seven-role model collapsed to four, those leftovers held role rows that no
 * longer exist in `ROLES`. An account carrying a role the permission table cannot resolve
 * is worse than no account: it signs in and then behaves unpredictably.
 *
 * Only seeded, fictional accounts are touched. A row created through the administration
 * screens is left alone: this function exists to keep the demonstration data honest, not to
 * prune real users.
 */
async function pruneRetiredSeedData(): Promise<{ users: number; roles: number }> {
  const keep = [...DEMO_USERS, ...TEST_USERS].map((demo) => demo.email);

  const stale = await prisma.user.findMany({
    where: {
      email: { notIn: keep, endsWith: '@soficlef.local' },
    },
    select: { id: true, email: true },
  });

  const staleTestAccounts = await prisma.user.findMany({
    where: { email: { endsWith: '@test.soficlef.local' } },
    select: { id: true, email: true },
  });

  const doomed = [...stale, ...staleTestAccounts];

  if (doomed.length > 0) {
    const ids = doomed.map((user) => user.id);

    /*
     * Assignments and journeys are removed first: `Assignment.position` is `Restrict`, so
     * the user delete would fail against them, and an audit row referencing a deleted
     * actor is set null rather than cascaded — the trail outlives the account by design.
     */
    await prisma.assignment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.onboardingInstance.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });


  }

  /*
   * Seats the departed held. A post created *for* a retired seed account has no reason
   * to survive it, so the unreferenced ones go; anything still carrying a job
   * description, competencies, a template or children stays, because those are business
   * content rather than leftovers.
   */
  const orphans = await prisma.position.findMany({
    where: {
      code: { startsWith: 'poste-' },
      // No holder now and none ever: a seat somebody merely vacated keeps its history and
      // must survive, so `none: {}` rather than `none: { endDate: null }`.
      assignments: { none: {} },
      childPositions: { none: {} },
      jobCompetencies: { none: {} },
      onboardingTemplates: { none: {} },
      jobDescription: null,
    },
    select: { id: true },
  });
  if (orphans.length > 0) {
    await prisma.position.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }

  await prisma.position.updateMany({
    where: { assignments: { none: { endDate: null } }, archivedAt: null },
    data: { isVacant: true, occupancy: 'VACANT' },
  });

  const liveRoles = Object.keys(ROLES);
  const retired = await prisma.role.findMany({
    where: { code: { notIn: liveRoles } },
    select: { id: true, code: true },
  });

  if (retired.length > 0) {
    const ids = retired.map((role) => role.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: ids } } });
    await prisma.userRole.deleteMany({ where: { roleId: { in: ids } } });
    await prisma.role.deleteMany({ where: { id: { in: ids } } });
  }

  return { users: doomed.length, roles: retired.length };
}

async function seedOrganization(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const unit of organizationSkeleton()) {
    const parentId = unit.parentCode ? (ids.get(unit.parentCode) ?? null) : null;
    const record = await prisma.organizationUnit.upsert({
      where: { code: unit.code },
      create: {
        code: unit.code,
        nameFr: unit.nameFr,
        type: unit.type,
        parentId,
        icon: unit.icon ?? null,
        descriptionFr: unit.descriptionFr ?? null,
        headOccupancy: unit.headOccupancy ?? null,
        headLabelFr: unit.headLabelFr ?? null,
        criticalNoteFr: unit.criticalNoteFr ?? null,
        staffingFr: unit.staffingFr ?? null,
      },
      update: {
        nameFr: unit.nameFr,
        type: unit.type,
        parentId,
        icon: unit.icon ?? null,
        descriptionFr: unit.descriptionFr ?? null,
        headOccupancy: unit.headOccupancy ?? null,
        headLabelFr: unit.headLabelFr ?? null,
        criticalNoteFr: unit.criticalNoteFr ?? null,
        staffingFr: unit.staffingFr ?? null,
      },
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

/**
 * The test collaborator's journey starts a fortnight before the seed runs.
 *
 * A journey starting today would have every deadline in the future and every survey
 * closed, so the pages that matter most — lateness, an open survey, a blocked step —
 * would all render their empty state. Fourteen days back puts J+7 open and one milestone
 * overdue, which is what somebody testing actually needs to see.
 */
interface DemoUser {
  email: string;
  displayName: string;
  locale: string;
  roles: { code: RoleCode; unitCode?: string }[];
  /** ISO date, for the people who have an onboarding journey. */
  onboardingStartDate?: string;

  /** CDC-2026 Module 1's employee record. Optional: the original cast predates it. */
  hireDate?: string;
  phone?: string;
  directionFr?: string;
  serviceFr?: string;
  positionTitleFr?: string;
  /** E-mail of this person's manager, resolved to an id after every account exists. */
  managerEmail?: string;
  /**
   * Left deliberately unplaced, to demonstrate the provisioning chain's resting state:
   * SI has created the account, HR has not yet given it a post.
   */
  pendingAssignment?: boolean;
  /**
   * Whose post this person's post reports to. The org chart is a tree of seats, so the
   * reporting line belongs on the position; this says which one, by the e-mail of whoever
   * holds it. Absent means a root of the chart.
   */
  reportsToEmail?: string;
}

/**
 * Journey start dates for the four recruits, staggered so every screen has something real
 * to show: one just arrived, one mid-checklist, one past the J+30 survey, and one whose
 * probation is effectively over.
 *
 * Computed from today rather than written as fixed dates, because a seed with hardcoded
 * dates renders correctly the week it is written and progressively wronger afterwards.
 */
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

/**
 * The cast: one account per role, plus the several new hires the onboarding module exists
 * to serve.
 *
 * Deliberately fictional and visibly so, at `@soficlef.local`, so a demonstration action is
 * never one careless click from a real person's record. Real accounts are created through
 * the administration screens.
 *
 * They share one password, set by SEED_DEMO_PASSWORD; nothing is hardcoded here (ADR-023).
 */
const DEMO_USERS: DemoUser[] = [
  {
    email: 'admin@soficlef.local',
    displayName: 'Administrateur',
    locale: 'fr',
    roles: [{ code: 'ADMIN' }],
    hireDate: '2019-01-07',
    phone: '150',
    directionFr: 'Direction Générale',
    serviceFr: 'Systèmes d’Information',
    positionTitleFr: 'Administrateur de la plateforme',
  },
  {
    email: 'rh@soficlef.local',
    displayName: 'Responsable RH',
    locale: 'fr',
    roles: [{ code: 'HR' }],
    hireDate: '2021-03-15',
    phone: '434',
    directionFr: 'Direction des Ressources Humaines',
    serviceFr: 'Administration du personnel',
    positionTitleFr: 'Responsable des Ressources Humaines',
    reportsToEmail: 'admin@soficlef.local',
  },
  {
    /*
     * Scoped to Fabrication, which has two units beneath it — so this account also
     * demonstrates that a manager's perimeter includes what hangs under it, rather than
     * stopping at their own structure.
     */
    email: 'manager@soficlef.local',
    displayName: 'Responsable Fabrication',
    locale: 'fr',
    roles: [{ code: 'MANAGER', unitCode: 'DPR-FABRICATION' }],
    hireDate: '2020-09-01',
    phone: '210',
    directionFr: 'Direction de Production',
    serviceFr: 'Structure Fabrication',
    positionTitleFr: 'Responsable Fabrication',
    reportsToEmail: 'admin@soficlef.local',
  },

  /*
   * The new hires. Four rather than one, staggered across the 90-day journey: a single
   * recruit would leave the checklist, the survey rounds and the probation reporting each
   * showing one row in one state, which demonstrates none of them.
   */
  {
    email: 'nouveau.1@soficlef.local',
    displayName: 'AMRANI Sofiane — Technicien de fabrication',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
    hireDate: daysAgo(5),
    onboardingStartDate: daysAgo(5),
    phone: '211',
    directionFr: 'Direction de Production',
    serviceFr: 'Structure Fabrication',
    positionTitleFr: 'Technicien de fabrication',
    managerEmail: 'manager@soficlef.local',
    reportsToEmail: 'manager@soficlef.local',
  },
  {
    email: 'nouveau.2@soficlef.local',
    displayName: 'BENALI Yacine — Agent de maintenance',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
    hireDate: daysAgo(20),
    onboardingStartDate: daysAgo(20),
    phone: '212',
    directionFr: 'Direction de Production',
    serviceFr: 'Structure Fabrication',
    positionTitleFr: 'Agent de maintenance',
    managerEmail: 'manager@soficlef.local',
    reportsToEmail: 'manager@soficlef.local',
  },
  {
    email: 'nouveau.3@soficlef.local',
    displayName: 'CHERIF Amina — Contrôleuse qualité',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
    hireDate: daysAgo(45),
    onboardingStartDate: daysAgo(45),
    phone: '213',
    directionFr: 'Direction de Production',
    serviceFr: 'Structure Fabrication',
    positionTitleFr: 'Contrôleuse qualité',
    managerEmail: 'manager@soficlef.local',
    reportsToEmail: 'manager@soficlef.local',
  },
  {
    email: 'nouveau.4@soficlef.local',
    displayName: 'DAHMANI Karim — Magasinier',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
    hireDate: daysAgo(95),
    onboardingStartDate: daysAgo(95),
    phone: '214',
    directionFr: 'Direction de Production',
    serviceFr: 'Structure Fabrication',
    positionTitleFr: 'Magasinier',
    managerEmail: 'manager@soficlef.local',
    reportsToEmail: 'manager@soficlef.local',
  },
  {
    /*
     * Left unplaced on purpose: the provisioning chain's resting state. The account exists
     * and can sign in, but reaches `/pending` and nothing else until it is given a post.
     */
    email: 'attente@soficlef.local',
    displayName: 'Compte en attente d’affectation',
    locale: 'fr',
    roles: [{ code: 'EMPLOYEE' }],
    hireDate: daysAgo(2),
    pendingAssignment: true,
  },
];

/**
 * Kept as an empty list rather than removed: the seeding code walks
 * `[...DEMO_USERS, ...TEST_USERS]` in four places, and a separate test cast may return.
 */
const TEST_USERS: DemoUser[] = [];

/**
 * The administrative pieces every new arrival is asked for.
 *
 * The list is the standard Algerian hiring file — identity, qualifications, bank details
 * for payroll, and the occupational-medicine certificate. Requested for recruits only:
 * asking a five-year employee for their diploma again would be noise.
 *
 * Statuses are staggered with the journeys, so the page shows all four states rather than
 * four identical rows.
 */
async function seedPersonalFiles(): Promise<number> {
  const REQUIRED: { kind: 'ID_CARD' | 'DIPLOMA' | 'BANK_DETAILS' | 'MEDICAL_CERTIFICATE'; labelFr: string }[] = [
    { kind: 'ID_CARD', labelFr: 'Pièce d’identité (CNI ou passeport)' },
    { kind: 'DIPLOMA', labelFr: 'Diplômes et attestations de formation' },
    { kind: 'BANK_DETAILS', labelFr: 'RIB pour la paie' },
    { kind: 'MEDICAL_CERTIFICATE', labelFr: 'Certificat de visite médicale d’embauche' },
  ];

  let created = 0;

  for (const demo of DEMO_USERS) {
    if (!demo.onboardingStartDate) continue;

    const recruit = await prisma.user.findUnique({
      where: { email: demo.email },
      select: { id: true },
    });
    if (!recruit) continue;

    // How far along this recruit is decides how much of their file is done.
    const daysIn = Math.round(
      (Date.now() - new Date(demo.onboardingStartDate).getTime()) / 86_400_000,
    );

    for (const [index, required] of REQUIRED.entries()) {
      const status =
        daysIn > 90
          ? ('ACCEPTED' as const)
          : daysIn > 40
            ? index < 3
              ? ('ACCEPTED' as const)
              : ('SUBMITTED' as const)
            : daysIn > 15
              ? index < 2
                ? ('ACCEPTED' as const)
                : ('REQUESTED' as const)
              : ('REQUESTED' as const);

      const submitted = status === 'SUBMITTED' || status === 'ACCEPTED';

      await prisma.personalFile.upsert({
        where: { userId_kind: { userId: recruit.id, kind: required.kind } },
        create: {
          userId: recruit.id,
          kind: required.kind,
          labelFr: required.labelFr,
          status,
          noteFr: submitted ? 'Remise en main propre au service RH.' : null,
          submittedAt: submitted ? new Date() : null,
          reviewedAt: status === 'ACCEPTED' ? new Date() : null,
        },
        // Status is not overwritten on reseed: it is the one field somebody may have
        // changed through the app, and the seed must not undo their work.
        update: { labelFr: required.labelFr },
      });
      created += 1;
    }
  }

  return created;
}

/**
 * Administrable parameters, seeded with the documented defaults.
 *
 * They exist as rows so the administration screen has something to edit; the code reads
 * them through `app-settings.ts`, which falls back to the same values when a row is
 * missing. Seeding them is a convenience, not a dependency.
 */
async function seedAppSettings(): Promise<number> {
  const settings = [
    {
      key: 'org.tree.depth.up',
      value: 2,
      labelFr: "Organigramme — niveaux visibles vers le haut (collaborateur)",
    },
    {
      key: 'org.tree.depth.down',
      value: 1,
      labelFr: "Organigramme — niveaux visibles vers le bas (collaborateur)",
    },
    {
      key: 'org.tree.showPeers',
      value: true,
      labelFr: "Organigramme — afficher les collègues du même responsable",
    },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      create: setting,
      // The value is deliberately NOT overwritten: re-seeding must not undo a change the
      // business made through the administration screen.
      update: { labelFr: setting.labelFr },
    });
  }

  return settings.length;
}

/**
 * Places every seeded person into a post.
 *
 * The posts are derived from the employee records already in `DEMO_USERS` / `TEST_USERS`
 * rather than invented: one position per distinct (title, unit) pair, code slugified from
 * the title. Nothing here is business data the client has not already supplied -- it is
 * the same directory, expressed as the seat rather than as free text on the person.
 *
 * The assignment is what makes the account `ASSIGNED`; an account with no open assignment
 * stays `PENDING_ASSIGNMENT`, which is the provisioning chain's resting state and is
 * demonstrated deliberately by `attente.affectation@test.soficlef.local`.
 */
async function seedAssignments(unitIds: Map<string, string>): Promise<number> {
  const slug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  /** e-mail -> the seat that person now holds, for the reporting-line pass below. */
  const seatOf = new Map<string, string>();
  let placed = 0;

  for (const demo of [...DEMO_USERS, ...TEST_USERS]) {
    if (!demo.positionTitleFr || demo.pendingAssignment) continue;

    const user = await prisma.user.findUnique({
      where: { email: demo.email },
      select: { id: true, hireDate: true },
    });
    if (!user) continue;

    /*
     * Which structure this seat belongs to.
     *
     * A scoped role names it outright. Most people have no scoped role, though — a
     * collaborator's EMPLOYEE grant is SELF, not unit-anchored — so fall back to whoever
     * they report to. A recruit sits in their manager's structure, which is both true and
     * the only thing the source data actually says.
     */
    const ownUnitCode = demo.roles.find((role) => role.unitCode)?.unitCode;
    const bossUnitCode = demo.reportsToEmail
      ? [...DEMO_USERS, ...TEST_USERS]
          .find((candidate) => candidate.email === demo.reportsToEmail)
          ?.roles.find((role) => role.unitCode)?.unitCode
      : undefined;

    const unitCode = ownUnitCode ?? bossUnitCode;
    const organizationUnitId = unitCode ? (unitIds.get(unitCode) ?? null) : null;

    /*
     * Reuse a post that already carries this title before minting a new one.
     *
     * The org chart and the employee records describe the same seats from two source
     * files, so "Directeur de Production" arrives twice. Keying only on a slugified code
     * made a second, empty copy of every such seat -- three of them for the DP alone.
     * Title is the only identity the two sources share, so it is what they are matched on.
     */
    const existing = await prisma.position.findFirst({
      where: { titleFr: demo.positionTitleFr, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const position = existing
      ? await prisma.position.update({
          where: { id: existing.id },
          data: { isVacant: false, occupancy: 'OCCUPIED', occupancyFr: null, organizationUnitId },
          select: { id: true },
        })
      : await prisma.position.create({
          data: {
            code: `poste-${slug(demo.positionTitleFr)}`,
            titleFr: demo.positionTitleFr,
            organizationUnitId,
            isVacant: false,
            occupancy: 'OCCUPIED',
          },
          select: { id: true },
        });

    const startDate = demo.hireDate ? new Date(demo.hireDate) : new Date();

    // At most one *open* assignment per person, enforced by a partial unique index. The
    // upsert is keyed on the existing open row so re-running the seed reassigns rather
    // than colliding.
    const open = await prisma.assignment.findFirst({
      where: { userId: user.id, endDate: null },
      select: { id: true },
    });

    if (open) {
      await prisma.assignment.update({
        where: { id: open.id },
        data: { positionId: position.id, startDate },
      });
    } else {
      await prisma.assignment.create({
        data: { userId: user.id, positionId: position.id, startDate },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lifecycleState: 'ASSIGNED' },
    });
    seatOf.set(demo.email, position.id);
    placed += 1;
  }

  /*
   * The reporting line, in a second pass: a parent seat must exist as a row before a
   * child can point at it, and the order of the arrays above should not have to encode
   * that. Without this the chart is flat, and a flat chart makes every unparented post a
   * sibling of every other -- which is how a collaborator ends up "seeing" the whole
   * company through the peers clause.
   */
  for (const demo of [...DEMO_USERS, ...TEST_USERS]) {
    if (!demo.reportsToEmail) continue;
    const child = seatOf.get(demo.email);
    const parent = seatOf.get(demo.reportsToEmail);
    if (!child || !parent || child === parent) continue;
    await prisma.position.update({
      where: { id: child },
      data: { parentPositionId: parent },
    });
  }

  return placed;
}

async function seedDemoUsers(unitIds: Map<string, string>, password: string): Promise<void> {
  const passwordHash = await hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  for (const demo of [...DEMO_USERS, ...TEST_USERS]) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        displayName: demo.displayName,
        locale: demo.locale,
        passwordHash,
        onboardingStartDate: demo.onboardingStartDate ? new Date(demo.onboardingStartDate) : null,
        ...employeeRecordOf(demo),
      },
      update: {
        displayName: demo.displayName,
        passwordHash,
        onboardingStartDate: demo.onboardingStartDate ? new Date(demo.onboardingStartDate) : null,
        ...employeeRecordOf(demo),
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

  // Manager links are resolved in a second pass: a manager must already exist as a row
  // before somebody can point at it, and the order of the arrays above should not have
  // to encode that.
  for (const demo of [...DEMO_USERS, ...TEST_USERS]) {
    if (!demo.managerEmail) continue;
    const manager = await prisma.user.findUnique({
      where: { email: demo.managerEmail },
      select: { id: true },
    });
    if (!manager) throw new Error(`unknown manager e-mail in demo data: ${demo.managerEmail}`);
    await prisma.user.update({
      where: { email: demo.email },
      data: { managerId: manager.id },
    });
  }
}

/** The CDC-2026 Module 1 columns, omitted entirely when a demo account declares none. */
function employeeRecordOf(demo: DemoUser) {
  return {
    hireDate: demo.hireDate ? new Date(demo.hireDate) : null,
    phone: demo.phone ?? null,
    directionFr: demo.directionFr ?? null,
    serviceFr: demo.serviceFr ?? null,
    positionTitleFr: demo.positionTitleFr ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content domains — one function per prototype page, upserting by business code/slug
// so the script stays idempotent (see file header).
// ─────────────────────────────────────────────────────────────────────────────

async function seedCompanyAndValues(): Promise<void> {
  const company = await prisma.company.upsert({
    where: { slug: COMPANY.id },
    create: {
      slug: COMPANY.id,
      legalName: COMPANY.legalName,
      legalForm: COMPANY.legalForm,
      foundedYear: COMPANY.foundedYear,
      foundedCity: COMPANY.foundedCity,
      headquarters: COMPANY.headquarters,
      generalManager: COMPANY.generalManager,
      certification: COMPANY.certification,
      status: COMPANY.status,
      website: COMPANY.website,
      visionFr: COMPANY.visionFr,
      missionFr: COMPANY.missionFr,
    },
    update: {
      legalName: COMPANY.legalName,
      legalForm: COMPANY.legalForm,
      foundedYear: COMPANY.foundedYear,
      foundedCity: COMPANY.foundedCity,
      headquarters: COMPANY.headquarters,
      generalManager: COMPANY.generalManager,
      certification: COMPANY.certification,
      status: COMPANY.status,
      website: COMPANY.website,
      visionFr: COMPANY.visionFr,
      missionFr: COMPANY.missionFr,
    },
    select: { id: true },
  });

  for (const [order, activity] of COMPANY.activities.entries()) {
    await prisma.companyActivity.upsert({
      where: { slug: activity.id },
      create: {
        slug: activity.id,
        companyId: company.id,
        labelFr: activity.labelFr,
        contentFr: activity.contentFr,
        order,
      },
      update: { labelFr: activity.labelFr, contentFr: activity.contentFr, order },
    });
  }

  for (const value of VALUES) {
    await prisma.companyValue.upsert({
      where: { slug: value.id },
      create: {
        slug: value.id,
        rank: value.rank,
        nameFr: value.nameFr,
        nameAr: value.nameAr,
        nameEn: value.nameEn,
      },
      update: {
        rank: value.rank,
        nameFr: value.nameFr,
        nameAr: value.nameAr,
        nameEn: value.nameEn,
      },
    });
  }
}

async function seedStrategy(): Promise<void> {
  const strategy = await prisma.strategy.upsert({
    where: { slug: 'plan-2024-2026' },
    create: {
      slug: 'plan-2024-2026',
      planFr: STRATEGY.planFr,
      globalObjectiveFr: STRATEGY.globalObjectiveFr,
    },
    update: { planFr: STRATEGY.planFr, globalObjectiveFr: STRATEGY.globalObjectiveFr },
    select: { id: true },
  });

  for (const [order, market] of STRATEGY.markets.entries()) {
    await prisma.marketObjective.upsert({
      where: { slug: market.id },
      create: {
        slug: market.id,
        strategyId: strategy.id,
        marketFr: market.marketFr,
        strategyFr: market.strategyFr,
        marketShareTargetFr: market.marketShareTargetFr,
        revenueTargetFr: market.revenueTargetFr,
        order,
      },
      update: {
        marketFr: market.marketFr,
        strategyFr: market.strategyFr,
        marketShareTargetFr: market.marketShareTargetFr,
        revenueTargetFr: market.revenueTargetFr,
        order,
      },
    });
  }

  for (const [order, project] of STRATEGY.projects.entries()) {
    await prisma.strategicProject.upsert({
      where: { code: project.code },
      create: {
        code: project.code,
        strategyId: strategy.id,
        titleFr: project.titleFr,
        descriptionFr: project.descriptionFr,
        order,
      },
      update: { titleFr: project.titleFr, descriptionFr: project.descriptionFr, order },
    });
  }

  for (const [order, contribution] of STRATEGY.contributions.entries()) {
    await prisma.strategyContribution.upsert({
      where: { slug: contribution.id },
      create: {
        slug: contribution.id,
        strategyId: strategy.id,
        labelFr: contribution.labelFr,
        targetFr: contribution.targetFr,
        progressPercent: contribution.progressPercent,
        order,
      },
      update: {
        labelFr: contribution.labelFr,
        targetFr: contribution.targetFr,
        progressPercent: contribution.progressPercent,
        order,
      },
    });
  }
}

/** Creates the Directeur de Production post and its job description. Returns the position id. */
async function seedPositionAndDescription(unitIds: Map<string, string>): Promise<string> {
  const job = await prisma.position.upsert({
    where: { code: 'directeur-production' },
    create: {
      code: 'directeur-production',
      titleFr: JOB_DESCRIPTION.jobTitleFr,
      organizationUnitId: unitIds.get('DPR') ?? null,
      isVacant: false,
      occupancy: 'OCCUPIED',
    },
    update: { titleFr: JOB_DESCRIPTION.jobTitleFr, organizationUnitId: unitIds.get('DPR') ?? null },
    select: { id: true },
  });

  const jobDescription = await prisma.jobDescription.upsert({
    where: { code: JOB_DESCRIPTION.code },
    create: {
      code: JOB_DESCRIPTION.code,
      positionId: job.id,
      jobTitleFr: JOB_DESCRIPTION.jobTitleFr,
      applicationDate: new Date(JOB_DESCRIPTION.applicationDate),
      applicationDateSourceFr: JOB_DESCRIPTION.applicationDateSourceFr,
      positioningStructureFr: JOB_DESCRIPTION.positioning.structureFr,
      positioningProcessFr: JOB_DESCRIPTION.positioning.processFr,
      positioningReportsToFr: JOB_DESCRIPTION.positioning.reportsToFr,
      positioningSubordinatesFr: JOB_DESCRIPTION.positioning.subordinatesFr,
      requirementEducationFr: JOB_DESCRIPTION.requirements.educationFr,
      requirementAdditionalEducationFr: JOB_DESCRIPTION.requirements.additionalEducationFr,
      requirementExperienceFr: JOB_DESCRIPTION.requirements.experienceFr,
      requirementWorkPatternFr: JOB_DESCRIPTION.requirements.workPatternFr,
    },
    update: {
      positionId: job.id,
      jobTitleFr: JOB_DESCRIPTION.jobTitleFr,
      applicationDate: new Date(JOB_DESCRIPTION.applicationDate),
      applicationDateSourceFr: JOB_DESCRIPTION.applicationDateSourceFr,
      positioningStructureFr: JOB_DESCRIPTION.positioning.structureFr,
      positioningProcessFr: JOB_DESCRIPTION.positioning.processFr,
      positioningReportsToFr: JOB_DESCRIPTION.positioning.reportsToFr,
      positioningSubordinatesFr: JOB_DESCRIPTION.positioning.subordinatesFr,
      requirementEducationFr: JOB_DESCRIPTION.requirements.educationFr,
      requirementAdditionalEducationFr: JOB_DESCRIPTION.requirements.additionalEducationFr,
      requirementExperienceFr: JOB_DESCRIPTION.requirements.experienceFr,
      requirementWorkPatternFr: JOB_DESCRIPTION.requirements.workPatternFr,
    },
    select: { id: true },
  });

  for (const [order, mission] of JOB_DESCRIPTION.missions.entries()) {
    await prisma.jobDescriptionMission.upsert({
      where: { slug: mission.id },
      create: {
        slug: mission.id,
        jobDescriptionId: jobDescription.id,
        textFr: mission.textFr,
        order,
      },
      update: { textFr: mission.textFr, order },
    });
  }
  for (const [order, task] of JOB_DESCRIPTION.permanentTasks.entries()) {
    await prisma.jobDescriptionTask.upsert({
      where: { slug: task.id },
      create: { slug: task.id, jobDescriptionId: jobDescription.id, textFr: task.textFr, order },
      update: { textFr: task.textFr, order },
    });
  }
  for (const [order, responsibility] of JOB_DESCRIPTION.responsibilities.entries()) {
    await prisma.jobDescriptionResponsibility.upsert({
      where: { slug: responsibility.id },
      create: {
        slug: responsibility.id,
        jobDescriptionId: jobDescription.id,
        textFr: responsibility.textFr,
        order,
      },
      update: { textFr: responsibility.textFr, order },
    });
  }

  return job.id;
}

async function seedManagementTeamAndOrgChart(unitIds: Map<string, string>): Promise<void> {
  for (const [order, member] of MANAGEMENT_TEAM.members.entries()) {
    await prisma.managementMember.upsert({
      where: { slug: member.id },
      create: {
        slug: member.id,
        initials: member.initials,
        nameFr: member.nameFr,
        roleFr: member.roleFr,
        scopeFr: member.scopeFr,
        tagFr: member.tagFr,
        perimeterFr: member.perimeterFr,
        priorityJ30Fr: member.priorityJ30Fr,
        order,
      },
      update: {
        initials: member.initials,
        nameFr: member.nameFr,
        roleFr: member.roleFr,
        scopeFr: member.scopeFr,
        tagFr: member.tagFr,
        perimeterFr: member.perimeterFr,
        priorityJ30Fr: member.priorityJ30Fr,
        order,
      },
    });
  }

  for (const [order, action] of MANAGEMENT_TEAM.recommendedActions.entries()) {
    await prisma.managementRecommendedAction.upsert({
      where: { slug: action.id },
      create: {
        slug: action.id,
        dayOffset: action.dayOffset,
        dayLabelFr: action.dayLabelFr,
        textFr: action.textFr,
        order,
      },
      update: {
        dayOffset: action.dayOffset,
        dayLabelFr: action.dayLabelFr,
        textFr: action.textFr,
        order,
      },
    });
  }

  /*
   * The org chart is a tree of *posts*, seeded into `position`.
   *
   * The source rows conflate two things in `labelFr`: a person's name where the seat is
   * filled ("DJAOUDI Farid"), a post title where it is not ("Resp. Fabrication"). A post
   * carries a title, so the title is taken from `roleFr` when the seat is occupied and
   * from `labelFr` when it is not. Who sits in the seat is an `Assignment`, not a column.
   *
   * Parents are created before children so `parentPositionId` always resolves.
   */
  const nodeIds = new Map<string, string>();
  for (const [order, node] of ORGANIZATION.orgChart.entries()) {
    const parentPositionId = node.parentId ? (nodeIds.get(node.parentId) ?? null) : null;
    const occupied = node.occupancy === 'OCCUPIED';

    const titleFr = occupied ? node.roleFr : node.labelFr;

    /*
     * Reconcile on title before minting a code.
     *
     * The org chart and the job description describe the same seats from two source
     * files -- "Directeur de Production" arrives from both -- and title is the only
     * identity they share. Keying on a code alone produced a second, empty copy of every
     * such seat, which then showed up on the chart as a vacant duplicate of a filled post.
     */
    const existing = await prisma.position.findFirst({
      where: { titleFr, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const data = {
      titleFr,
      parentPositionId,
      isVacant: !occupied,
      occupancy: node.occupancy,
      occupancyFr: occupied ? null : node.roleFr,
      order,
    };

    const record = existing
      ? await prisma.position.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.position.create({
          data: {
            ...data,
            code: `orgchart-${node.id}`,
            organizationUnitId: unitIds.get(node.id) ?? null,
          },
          select: { id: true },
        });
    nodeIds.set(node.id, record.id);
  }
}

async function seedKaizen(): Promise<void> {
  const programme = await prisma.kaizenProgramme.upsert({
    where: { slug: 'programme-kaizen' },
    create: {
      slug: 'programme-kaizen',
      programmeFr: KAIZEN.programmeFr,
      internalLeadFr: KAIZEN.internalLeadFr,
    },
    update: { programmeFr: KAIZEN.programmeFr, internalLeadFr: KAIZEN.internalLeadFr },
    select: { id: true },
  });

  const missionIds = new Map<string, string>();
  for (const mission of KAIZEN.missions) {
    const record = await prisma.kaizenMission.upsert({
      where: { slug: mission.id },
      create: {
        slug: mission.id,
        programmeId: programme.id,
        number: mission.number,
        icon: mission.icon,
        titleFr: mission.titleFr,
        periodFr: mission.periodFr,
        referenceFr: mission.referenceFr,
        internalLeadFr: mission.internalLeadFr,
        contextFr: mission.contextFr,
      },
      update: {
        number: mission.number,
        icon: mission.icon,
        titleFr: mission.titleFr,
        periodFr: mission.periodFr,
        referenceFr: mission.referenceFr,
        internalLeadFr: mission.internalLeadFr,
        contextFr: mission.contextFr,
      },
      select: { id: true },
    });
    missionIds.set(mission.id, record.id);

    for (const [order, result] of mission.results.entries()) {
      await prisma.kaizenMissionResult.upsert({
        where: { slug: result.id },
        create: { slug: result.id, missionId: record.id, textFr: result.textFr, order },
        update: { textFr: result.textFr, order },
      });
    }
    for (const [order, entry] of mission.journal.entries()) {
      await prisma.kaizenJournalEntry.upsert({
        where: { slug: entry.id },
        create: {
          slug: entry.id,
          missionId: record.id,
          dayFr: entry.dayFr,
          activitiesFr: entry.activitiesFr,
          outcomeFr: entry.outcomeFr,
          order,
        },
        update: {
          dayFr: entry.dayFr,
          activitiesFr: entry.activitiesFr,
          outcomeFr: entry.outcomeFr,
          order,
        },
      });
    }
    for (const [order, gap] of mission.gaps.entries()) {
      await prisma.kaizenGap.upsert({
        where: { slug: gap.id },
        create: {
          slug: gap.id,
          missionId: record.id,
          domainFr: gap.domainFr,
          observedFr: gap.observedFr,
          targetFr: gap.targetFr,
          order,
        },
        update: {
          domainFr: gap.domainFr,
          observedFr: gap.observedFr,
          targetFr: gap.targetFr,
          order,
        },
      });
    }
  }

  for (const [order, action] of KAIZEN.actions.entries()) {
    const missionId = missionIds.get(action.missionId);
    if (!missionId)
      throw new Error(`kaizen action references unknown mission: ${action.missionId}`);
    await prisma.kaizenAction.upsert({
      where: { slug: action.id },
      create: {
        slug: action.id,
        missionId,
        actionFr: action.actionFr,
        ownerFr: action.ownerFr,
        deadlineFr: action.deadlineFr,
        statusFr: action.statusFr,
        order,
      },
      update: {
        actionFr: action.actionFr,
        ownerFr: action.ownerFr,
        deadlineFr: action.deadlineFr,
        statusFr: action.statusFr,
        order,
      },
    });
  }

  for (const [order, action] of KAIZEN.priorityActionsJ30.entries()) {
    await prisma.kaizenPriorityActionJ30.upsert({
      where: { slug: action.id },
      create: {
        slug: action.id,
        programmeId: programme.id,
        dayLabelFr: action.dayLabelFr,
        textFr: action.textFr,
        order,
      },
      update: { dayLabelFr: action.dayLabelFr, textFr: action.textFr, order },
    });
  }
}

async function seedQms(): Promise<void> {
  const qms = await prisma.qms.upsert({
    where: { slug: 'smq-iso-9001' },
    create: {
      slug: 'smq-iso-9001',
      standardFr: QMS.standardFr,
      certificationBodyFr: QMS.certificationBodyFr,
      certifiedSinceFr: QMS.certifiedSinceFr,
      certificationScopeFr: QMS.certificationScopeFr,
      ownedProcessCode: QMS.ownedProcessCode,
      ownedProcessNoteFr: QMS.ownedProcessNoteFr,
      processMapCode: QMS.processMapCode,
    },
    update: {
      standardFr: QMS.standardFr,
      certificationBodyFr: QMS.certificationBodyFr,
      certifiedSinceFr: QMS.certifiedSinceFr,
      certificationScopeFr: QMS.certificationScopeFr,
      ownedProcessCode: QMS.ownedProcessCode,
      ownedProcessNoteFr: QMS.ownedProcessNoteFr,
      processMapCode: QMS.processMapCode,
    },
    select: { id: true },
  });

  for (const [order, responsibility] of QMS.responsibilities.entries()) {
    await prisma.qmsResponsibility.upsert({
      where: { slug: responsibility.id },
      create: { slug: responsibility.id, qmsId: qms.id, textFr: responsibility.textFr, order },
      update: { textFr: responsibility.textFr, order },
    });
  }

  for (const [order, process] of QMS.processes.entries()) {
    await prisma.qmsProcess.upsert({
      where: { code: process.code },
      create: {
        code: process.code,
        qmsId: qms.id,
        category: process.category,
        categoryLabelFr: process.categoryLabelFr,
        nameFr: process.nameFr,
        isOwnedByProductionDirector: process.isOwnedByProductionDirector,
        order,
      },
      update: {
        category: process.category,
        categoryLabelFr: process.categoryLabelFr,
        nameFr: process.nameFr,
        isOwnedByProductionDirector: process.isOwnedByProductionDirector,
        order,
      },
    });
  }
}

async function seedHse(): Promise<void> {
  const hse = await prisma.hse.upsert({
    where: { slug: 'site-si-mustapha' },
    create: {
      slug: 'site-si-mustapha',
      siteFr: HSE.siteFr,
      contactFr: HSE.contactFr,
      zonesFr: HSE.zonesFr,
      riskAreaFr: HSE.riskAreaFr,
      circulationPlanNoteFr: HSE.circulationPlanNoteFr,
    },
    update: {
      siteFr: HSE.siteFr,
      contactFr: HSE.contactFr,
      zonesFr: HSE.zonesFr,
      riskAreaFr: HSE.riskAreaFr,
      circulationPlanNoteFr: HSE.circulationPlanNoteFr,
    },
    select: { id: true },
  });

  let order = 0;
  for (const rule of HSE.trafficRules) {
    await prisma.hseRule.upsert({
      where: { slug: rule.id },
      create: {
        slug: rule.id,
        hseId: hse.id,
        kind: 'TRAFFIC',
        textFr: rule.textFr,
        order: order++,
      },
      update: { kind: 'TRAFFIC', textFr: rule.textFr },
    });
  }
  for (const rule of HSE.mandatoryPpe) {
    await prisma.hseRule.upsert({
      where: { slug: rule.id },
      create: { slug: rule.id, hseId: hse.id, kind: 'PPE', textFr: rule.textFr, order: order++ },
      update: { kind: 'PPE', textFr: rule.textFr },
    });
  }
}

async function seedContacts(): Promise<void> {
  for (const [order, contact] of CONTACTS.entries()) {
    await prisma.contact.upsert({
      where: { extension: contact.extension },
      create: {
        extension: contact.extension,
        initials: contact.initials,
        nameFr: contact.nameFr,
        roleFr: contact.roleFr,
        priorityFr: contact.priorityFr,
        priorityRank: contact.priorityRank,
        order,
      },
      update: {
        initials: contact.initials,
        nameFr: contact.nameFr,
        roleFr: contact.roleFr,
        priorityFr: contact.priorityFr,
        priorityRank: contact.priorityRank,
        order,
      },
    });
  }
}

async function seedDocuments(): Promise<void> {
  let order = 0;
  for (const doc of DOCUMENTS.available) {
    await prisma.document.upsert({
      where: { slug: doc.id },
      create: {
        slug: doc.id,
        fileName: doc.fileName,
        titleFr: doc.titleFr,
        detailFr: doc.detailFr,
        availability: 'AVAILABLE',
        order: order++,
      },
      update: {
        fileName: doc.fileName,
        titleFr: doc.titleFr,
        detailFr: doc.detailFr,
        availability: 'AVAILABLE',
      },
    });
  }
  for (const doc of DOCUMENTS.pending) {
    await prisma.document.upsert({
      where: { slug: doc.id },
      create: { slug: doc.id, titleFr: doc.titleFr, availability: 'PENDING', order: order++ },
      update: { titleFr: doc.titleFr, availability: 'PENDING' },
    });
  }
}

async function seedRecruitment(): Promise<void> {
  const recruitment = await prisma.recruitment.upsert({
    where: { slug: 'recrutements-dpr' },
    create: {
      slug: 'recrutements-dpr',
      internalMobilityNoteFr: RECRUITMENT.internalMobilityNoteFr,
      recommendedActionFr: RECRUITMENT.recommendedActionFr,
    },
    update: {
      internalMobilityNoteFr: RECRUITMENT.internalMobilityNoteFr,
      recommendedActionFr: RECRUITMENT.recommendedActionFr,
    },
    select: { id: true },
  });

  for (const [order, position] of RECRUITMENT.positions.entries()) {
    await prisma.openPosition.upsert({
      where: { slug: position.id },
      create: {
        slug: position.id,
        recruitmentId: recruitment.id,
        titleFr: position.titleFr,
        attachmentFr: position.attachmentFr,
        statusFr: position.statusFr,
        order,
      },
      update: {
        titleFr: position.titleFr,
        attachmentFr: position.attachmentFr,
        statusFr: position.statusFr,
        order,
      },
    });
  }
}

/**
 * Which phase a milestone belongs to, and who owns it, derived from the source data.
 *
 * The extracted checklist carries neither: the prototype had one flat list. Rather than
 * leave both columns null and have every task pile into one section, they are derived from
 * what the data *does* say — the day offset, and the words the client used in the title.
 *
 * Derived rather than invented: nothing here adds a task, a date or a department the
 * source file does not already imply. Anything unrecognised stays null, which the UI
 * renders as "not specified" instead of guessing.
 */
function milestoneShape(titleFr: string, dayOffset: number): {
  phase: 'PRE_ONBOARDING' | 'DAY_ONE' | 'PROBATION';
  ownerDepartment: 'HR' | 'IT' | 'HSE' | 'QUALITY' | 'MANAGER' | 'EMPLOYEE' | null;
} {
  const phase = dayOffset < 1 ? 'PRE_ONBOARDING' : dayOffset === 1 ? 'DAY_ONE' : 'PROBATION';

  const title = titleFr.toLowerCase();
  const ownerDepartment =
    title.includes('drh') || title.includes('accueil') || title.includes('recrutement')
      ? ('HR' as const)
      : title.includes('smq') || title.includes('qualité')
        ? ('QUALITY' as const)
        : title.includes('hse') || title.includes('sécurité')
          ? ('HSE' as const)
          : title.includes('équipement') || title.includes('cnc') || title.includes('plateforme')
            ? ('IT' as const)
            : title.includes('dg') || title.includes('direction')
              ? ('MANAGER' as const)
              : ('EMPLOYEE' as const);

  return { phase, ownerDepartment };
}

/** The reusable 30-day checklist attached to the Directeur de Production post. */
async function seedOnboardingTemplate(positionId: string): Promise<string> {
  const template = await prisma.onboardingTemplate.upsert({
    where: { slug: 'checklist-directeur-production' },
    create: {
      slug: 'checklist-directeur-production',
      positionId,
      titleFr: "Checklist d'intégration 30 jours",
    },
    update: { positionId, titleFr: "Checklist d'intégration 30 jours" },
    select: { id: true },
  });

  for (const milestone of ONBOARDING_MILESTONES) {
    await prisma.onboardingMilestone.upsert({
      where: { slug: milestone.id },
      create: {
        slug: milestone.id,
        templateId: template.id,
        order: milestone.order,
        dayLabelFr: milestone.dayLabelFr,
        dayOffset: milestone.dayOffset,
        titleFr: milestone.titleFr,
        detailFr: milestone.detailFr,
        isRecommended: milestone.isRecommended,
        ...milestoneShape(milestone.titleFr, milestone.dayOffset),
      },
      update: {
        order: milestone.order,
        dayLabelFr: milestone.dayLabelFr,
        dayOffset: milestone.dayOffset,
        titleFr: milestone.titleFr,
        detailFr: milestone.detailFr,
        isRecommended: milestone.isRecommended,
        ...milestoneShape(milestone.titleFr, milestone.dayOffset),
      },
    });
  }

  return template.id;
}

/**
 * Welcome content for the pilot onboarding recipient, plus their instance of the
 * checklist template — ADR-001's example made concrete: M. Djaoudi's onboarding is the
 * first instance of a reusable template, not a hardcoded page.
 */
async function seedWelcomeAndOnboardingInstance(templateId: string): Promise<void> {
  /*
   * The prototype's welcome letter, addressed to the first recruit. It used to name a
   * specific seeded person; that account went with the four-role cast, and hardcoding
   * another email would only move the same breakage one rename away.
   */
  const recipientEmail = DEMO_USERS.find((demo) => demo.onboardingStartDate)?.email;
  const djaoudi = recipientEmail
    ? await prisma.user.findUnique({ where: { email: recipientEmail }, select: { id: true } })
    : null;
  if (!djaoudi) throw new Error('a recruit must be seeded before welcome content');

  const welcome = await prisma.welcome.upsert({
    where: { slug: 'bienvenue-djaoudi' },
    create: {
      slug: 'bienvenue-djaoudi',
      userId: djaoudi.id,
      recipientFr: WELCOME.recipientFr,
      recipientRoleFr: WELCOME.recipientRoleFr,
      startDate: new Date(WELCOME.startDate),
      startDateSourceFr: WELCOME.startDateSourceFr,
      greetingFr: WELCOME.greetingFr,
      messageFr: WELCOME.messageFr,
      signatureFr: WELCOME.signatureFr,
    },
    update: {
      userId: djaoudi.id,
      recipientFr: WELCOME.recipientFr,
      recipientRoleFr: WELCOME.recipientRoleFr,
      startDate: new Date(WELCOME.startDate),
      startDateSourceFr: WELCOME.startDateSourceFr,
      greetingFr: WELCOME.greetingFr,
      messageFr: WELCOME.messageFr,
      signatureFr: WELCOME.signatureFr,
    },
    select: { id: true },
  });

  for (const [order, stat] of WELCOME.stats.entries()) {
    await prisma.welcomeStat.upsert({
      where: { slug: stat.id },
      create: {
        slug: stat.id,
        welcomeId: welcome.id,
        valueFr: stat.valueFr,
        labelFr: stat.labelFr,
        order,
      },
      update: { valueFr: stat.valueFr, labelFr: stat.labelFr, order },
    });
  }
  for (const [order, item] of WELCOME.agenda.entries()) {
    await prisma.welcomeAgendaItem.upsert({
      where: { slug: item.id },
      create: {
        slug: item.id,
        welcomeId: welcome.id,
        titleFr: item.titleFr,
        detailFr: item.detailFr,
        order,
      },
      update: { titleFr: item.titleFr, detailFr: item.detailFr, order },
    });
  }

  let instance = await prisma.onboardingInstance.findFirst({
    where: { userId: djaoudi.id, templateId },
    select: { id: true },
  });
  if (!instance) {
    instance = await prisma.onboardingInstance.create({
      data: { userId: djaoudi.id, templateId, startDate: new Date(WELCOME.startDate) },
      select: { id: true },
    });
  }

  // One open (not completed) task row per milestone — the checklist page's progress
  // badge counts these. Completion is recorded later, through the app, not the seed.
  const milestones = await prisma.onboardingMilestone.findMany({
    where: { templateId },
    select: { id: true },
  });
  for (const milestone of milestones) {
    const existing = await prisma.onboardingTaskCompletion.findUnique({
      where: { instanceId_milestoneId: { instanceId: instance.id, milestoneId: milestone.id } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.onboardingTaskCompletion.create({
        data: { instanceId: instance.id, milestoneId: milestone.id },
      });
    }
  }
}

/**
 * Onboarding journeys for the four recruits.
 *
 * Each is dated from that person's own `onboardingStartDate`, so the set spans the whole
 * 90-day arc at once: D+5 has a live deadline and an open J+7 survey, D+20 is mid-checklist,
 * D+45 is past J+30, and D+95 has finished. One recruit on day one would leave the
 * checklist, the survey rounds and the probation reporting each showing a single empty
 * state, which demonstrates none of them.
 *
 * Task rows are created but left open. Completion is recorded through the app, which is
 * the behaviour being tested; seeding it would hide whether it works.
 */
async function seedRecruitJourneys(templateId: string): Promise<number> {
  const milestones = await prisma.onboardingMilestone.findMany({
    where: { templateId },
    select: { id: true },
  });

  let created = 0;

  for (const demo of DEMO_USERS) {
    if (!demo.onboardingStartDate) continue;

    const recruit = await prisma.user.findUnique({
      where: { email: demo.email },
      select: { id: true },
    });
    if (!recruit) continue;

    const startDate = new Date(demo.onboardingStartDate);

    let instance = await prisma.onboardingInstance.findFirst({
      where: { userId: recruit.id, templateId },
      select: { id: true },
    });
    if (!instance) {
      instance = await prisma.onboardingInstance.create({
        data: { userId: recruit.id, templateId, startDate },
        select: { id: true },
      });
    } else {
      await prisma.onboardingInstance.update({
        where: { id: instance.id },
        data: { startDate },
      });
    }

    for (const milestone of milestones) {
      const existing = await prisma.onboardingTaskCompletion.findUnique({
        where: { instanceId_milestoneId: { instanceId: instance.id, milestoneId: milestone.id } },
        select: { id: true },
      });
      if (!existing) {
        await prisma.onboardingTaskCompletion.create({
          data: { instanceId: instance.id, milestoneId: milestone.id },
        });
      }
    }

    // Survey rounds are not created here: `seedSurveyRounds` walks every instance later
    // in the run and dates them from each instance's own start.
    created += 1;
  }

  return created;
}

/**
 * The competency reference frame (CDC v0.1 §7).
 *
 * Unlike everything above, this is *not* extracted from the prototype: the prototype's
 * "Bilan des compétences" page is an explicit placeholder ("en cours d'ajout"). §7.2
 * says the final labels must be supplied and validated by the business, so the frame is
 * seeded from the CDC's own example list, flagged as a proposal in the source file, and
 * fully editable through the administration screens (OQ-05, OQ-06).
 */
async function seedCompetencyFrame(positionId: string | null): Promise<number> {
  const frame = JSON.parse(
    readFileSync(new URL('../seed/reference/competency-frame.json', import.meta.url), 'utf8'),
  ) as {
    levels: { value: number; labelFr: string; definitionFr: string }[];
    families: { code: string; nameFr: string; order: number }[];
    competencies: {
      code: string;
      familyCode: string;
      nameFr: string;
      requiredLevel: number;
      mandatory: boolean;
    }[];
  };

  for (const level of frame.levels) {
    await prisma.competencyLevel.upsert({
      where: { value: level.value },
      create: { value: level.value, labelFr: level.labelFr, definitionFr: level.definitionFr },
      update: { labelFr: level.labelFr, definitionFr: level.definitionFr },
    });
  }

  const familyIds = new Map<string, string>();
  for (const family of frame.families) {
    const row = await prisma.competencyFamily.upsert({
      where: { code: family.code },
      create: { code: family.code, nameFr: family.nameFr, order: family.order },
      update: { nameFr: family.nameFr, order: family.order },
    });
    familyIds.set(family.code, row.id);
  }

  for (const competency of frame.competencies) {
    const familyId = familyIds.get(competency.familyCode) ?? null;
    const row = await prisma.competency.upsert({
      where: { code: competency.code },
      create: { code: competency.code, nameFr: competency.nameFr, familyId },
      update: { nameFr: competency.nameFr, familyId },
    });

    // The matrix row only exists once there is a post to attach it to.
    if (positionId) {
      await prisma.jobCompetency.upsert({
        where: { positionId_competencyId: { positionId, competencyId: row.id } },
        create: {
          positionId,
          competencyId: row.id,
          requiredLevel: competency.requiredLevel,
          notesFr: competency.mandatory ? 'Obligatoire' : 'Optionnelle',
        },
        update: {
          requiredLevel: competency.requiredLevel,
          notesFr: competency.mandatory ? 'Obligatoire' : 'Optionnelle',
        },
      });
    }
  }

  return frame.competencies.length;
}

/**
 * The training catalogue (CDC-2026 Module 6).
 *
 * Placeholder content under the §4 "Plug & Play" clause: the structure, the quizzes and
 * the certification flow are complete, and every module carries `isPlaceholder` so the UI
 * can say so. When SOFICLEF supplies its real HSE and Qualité supports they replace the
 * `contentFr` and the questions in place — no schema change, no rewrite.
 */
async function seedTrainingCatalogue(): Promise<number> {
  const catalogue = JSON.parse(
    readFileSync(new URL('../seed/reference/training-catalogue.json', import.meta.url), 'utf8'),
  ) as {
    modules: {
      code: string;
      titleFr: string;
      summaryFr: string;
      contentFr: string;
      passingScore: number;
      order: number;
      questions: {
        promptFr: string;
        options: { id: string; labelFr: string }[];
        correctOption: string;
        explanationFr?: string;
      }[];
    }[];
  };

  for (const entry of catalogue.modules) {
    const row = await prisma.trainingModule.upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        titleFr: entry.titleFr,
        summaryFr: entry.summaryFr,
        contentFr: entry.contentFr,
        passingScore: entry.passingScore,
        order: entry.order,
        isPlaceholder: true,
      },
      update: {
        titleFr: entry.titleFr,
        summaryFr: entry.summaryFr,
        contentFr: entry.contentFr,
        passingScore: entry.passingScore,
        order: entry.order,
      },
    });

    // Questions are replaced wholesale rather than upserted: they have no business key,
    // and a question removed from the catalogue must disappear rather than linger.
    await prisma.trainingQuestion.deleteMany({ where: { moduleId: row.id } });
    await prisma.trainingQuestion.createMany({
      data: entry.questions.map((question, index) => ({
        moduleId: row.id,
        order: index + 1,
        promptFr: question.promptFr,
        options: question.options,
        correctOption: question.correctOption,
        explanationFr: question.explanationFr ?? null,
      })),
    });
  }

  return catalogue.modules.length;
}

/**
 * Survey rounds for an existing journey (CDC-2026 Module 9).
 *
 * Created at instantiation rather than by a scheduler, so the four dates exist as data
 * from day one: a dashboard can then show what is due and what is late without a job
 * having run, and a missed scheduler tick cannot lose a round.
 */
async function seedSurveyRounds(): Promise<number> {
  const instances = await prisma.onboardingInstance.findMany({
    select: { id: true, startDate: true },
  });

  let created = 0;
  for (const instance of instances) {
    for (const dayOffset of [7, 30, 60, 90]) {
      const dueDate = new Date(instance.startDate);
      dueDate.setDate(dueDate.getDate() + dayOffset);

      await prisma.surveyRound.upsert({
        where: { instanceId_dayOffset: { instanceId: instance.id, dayOffset } },
        create: { instanceId: instance.id, dayOffset, dueDate },
        update: { dueDate },
      });
      created += 1;
    }
  }
  return created;
}

async function main(): Promise<void> {
  const suppliedPassword = process.env.SEED_DEMO_PASSWORD;
  const wasGenerated = !suppliedPassword;
  const password = suppliedPassword ?? `Soficlef-${randomBytes(9).toString('base64url')}`;

  await seedPermissionsAndRoles();
  const unitIds = await seedOrganization();
  await seedDemoUsers(unitIds, password);

  // After the new cast exists, never before: pruning first would leave a window with no
  // accounts at all if a later step failed.
  const pruned = await pruneRetiredSeedData();

  await seedCompanyAndValues();
  await seedStrategy();
  const jobId = await seedPositionAndDescription(unitIds);
  await seedManagementTeamAndOrgChart(unitIds);
  await seedKaizen();
  await seedQms();
  await seedHse();
  await seedContacts();
  await seedDocuments();
  await seedRecruitment();
  const templateId = await seedOnboardingTemplate(jobId);
  await seedWelcomeAndOnboardingInstance(templateId);
  const journeyCount = await seedRecruitJourneys(templateId);
  const competencyCount = await seedCompetencyFrame(jobId);
  const assignmentCount = await seedAssignments(unitIds);
  const settingCount = await seedAppSettings();
  const fileCount = await seedPersonalFiles();
  const trainingCount = await seedTrainingCatalogue();
  const surveyRoundCount = await seedSurveyRounds();

  console.log(`✔ ${ALL_PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles`);
  console.log(`✔ ${unitIds.size} organization units`);
  console.log(
    `✔ ${DEMO_USERS.length} accounts — one per role, plus four recruits and one unplaced`,
  );
  console.log('✔ company, values, strategy, job description, management team, org chart');
  console.log('✔ kaizen, qms, hse, contacts, documents, recruitment');
  console.log('✔ onboarding template + welcome content + onboarding instance');
  console.log(`✔ training catalogue — ${trainingCount} modules, placeholder content`);
  console.log(`✔ ${surveyRoundCount} survey rounds — J+7, J+30, J+60, J+90`);
  console.log(`✔ ${journeyCount} recruit journeys — D+5, D+20, D+45 and D+95`);
  console.log(`✔ ${fileCount} personal file requests (upload pending OQ-14/OQ-15)`);
  if (pruned.users > 0 || pruned.roles > 0) {
    console.log(
      `✔ pruned ${pruned.users} retired seed accounts and ${pruned.roles} retired roles`,
    );
  }
  console.log(`✔ ${settingCount} administrable settings (defaults; existing values kept)`);
  console.log(
    `✔ ${assignmentCount} assignments — one open post each; ` +
      'attente@soficlef.local left PENDING_ASSIGNMENT on purpose',
  );
  console.log(
    `✔ competency frame — ${competencyCount} competencies (proposal, awaiting validation)`,
  );

  if (wasGenerated) {
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
