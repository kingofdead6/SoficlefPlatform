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

// Persist the raw extracted payloads into the legacy generic store too, so any page not
// yet migrated off `SeedContent` keeps working while it's migrated table by table.
function seedDataFiles(): { domain: string; content: unknown }[] {
  const files = [
    'company.json',
    'contacts.json',
    'documents.json',
    'hse.json',
    'job-description.json',
    'kaizen.json',
    'management-team.json',
    'onboarding-checklist.json',
    'organization.json',
    'qms.json',
    'recruitment.json',
    'strategy.json',
    'values.json',
    'welcome.json',
  ];

  return files.map((f) => {
    const parsed = readSeed<{ meta?: { domain?: string } }>(f);
    const domain = parsed?.meta?.domain ?? f.replace(/\.json$/, '');
    return { domain, content: parsed };
  });
}

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
 * password of all of the accounts is Pwd123456
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

/** Creates the Directeur de Production post and its job description. Returns the Job id. */
async function seedJobAndDescription(unitIds: Map<string, string>): Promise<string> {
  const job = await prisma.job.upsert({
    where: { code: 'directeur-production' },
    create: {
      code: 'directeur-production',
      titleFr: JOB_DESCRIPTION.jobTitleFr,
      organizationUnitId: unitIds.get('DPR') ?? null,
      isVacant: false,
    },
    update: { titleFr: JOB_DESCRIPTION.jobTitleFr, organizationUnitId: unitIds.get('DPR') ?? null },
    select: { id: true },
  });

  const jobDescription = await prisma.jobDescription.upsert({
    where: { code: JOB_DESCRIPTION.code },
    create: {
      code: JOB_DESCRIPTION.code,
      jobId: job.id,
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
      jobId: job.id,
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

  // Org chart nodes form their own tree (see the model's doc comment) — create parents
  // before children so `parentId` always resolves.
  const nodeIds = new Map<string, string>();
  for (const [order, node] of ORGANIZATION.orgChart.entries()) {
    const parentId = node.parentId ? (nodeIds.get(node.parentId) ?? null) : null;
    const record = await prisma.orgChartNode.upsert({
      where: { slug: node.id },
      create: {
        slug: node.id,
        labelFr: node.labelFr,
        roleFr: node.roleFr,
        occupancy: node.occupancy,
        parentId,
        organizationUnitId: unitIds.get(node.id) ?? null,
        order,
      },
      update: {
        labelFr: node.labelFr,
        roleFr: node.roleFr,
        occupancy: node.occupancy,
        parentId,
        order,
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

/** The reusable 30-day checklist attached to the Directeur de Production job. */
async function seedOnboardingTemplate(jobId: string): Promise<string> {
  const template = await prisma.onboardingTemplate.upsert({
    where: { slug: 'checklist-directeur-production' },
    create: {
      slug: 'checklist-directeur-production',
      jobId,
      titleFr: "Checklist d'intégration 30 jours",
    },
    update: { jobId, titleFr: "Checklist d'intégration 30 jours" },
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
      },
      update: {
        order: milestone.order,
        dayLabelFr: milestone.dayLabelFr,
        dayOffset: milestone.dayOffset,
        titleFr: milestone.titleFr,
        detailFr: milestone.detailFr,
        isRecommended: milestone.isRecommended,
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
  const djaoudi = await prisma.user.findUnique({
    where: { email: 'djaoudi@soficlef.local' },
    select: { id: true },
  });
  if (!djaoudi) throw new Error('djaoudi@soficlef.local must be seeded before welcome content');

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
 * The competency reference frame (CDC v0.1 §7).
 *
 * Unlike everything above, this is *not* extracted from the prototype: the prototype's
 * "Bilan des compétences" page is an explicit placeholder ("en cours d'ajout"). §7.2
 * says the final labels must be supplied and validated by the business, so the frame is
 * seeded from the CDC's own example list, flagged as a proposal in the source file, and
 * fully editable through the administration screens (OQ-05, OQ-06).
 */
async function seedCompetencyFrame(jobId: string | null): Promise<number> {
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

    // The matrix row only exists once there is a job to attach it to.
    if (jobId) {
      await prisma.jobCompetency.upsert({
        where: { jobId_competencyId: { jobId, competencyId: row.id } },
        create: {
          jobId,
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

async function main(): Promise<void> {
  const suppliedPassword = process.env.SEED_DEMO_PASSWORD;
  const wasGenerated = !suppliedPassword;
  const password = suppliedPassword ?? `Soficlef-${randomBytes(9).toString('base64url')}`;

  await seedPermissionsAndRoles();
  const unitIds = await seedOrganization();
  await seedDemoUsers(unitIds, password);

  await seedCompanyAndValues();
  await seedStrategy();
  const jobId = await seedJobAndDescription(unitIds);
  await seedManagementTeamAndOrgChart(unitIds);
  await seedKaizen();
  await seedQms();
  await seedHse();
  await seedContacts();
  await seedDocuments();
  await seedRecruitment();
  const templateId = await seedOnboardingTemplate(jobId);
  await seedWelcomeAndOnboardingInstance(templateId);
  const competencyCount = await seedCompetencyFrame(jobId);

  // Legacy generic store, kept for pages not yet migrated off it (see file header).
  const payloads = seedDataFiles();
  for (const p of payloads) {
    await prisma.seedContent.upsert({
      where: { domain: p.domain },
      create: { domain: p.domain, data: p.content as object },
      update: { data: p.content as object },
    });
  }

  console.log(`✔ ${ALL_PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles`);
  console.log(`✔ ${unitIds.size} organization units`);
  console.log(`✔ ${DEMO_USERS.length} demo users`);
  console.log('✔ company, values, strategy, job description, management team, org chart');
  console.log('✔ kaizen, qms, hse, contacts, documents, recruitment');
  console.log('✔ onboarding template + welcome content + onboarding instance');
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
