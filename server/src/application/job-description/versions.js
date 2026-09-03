import { assertCanAnyScope } from '../../domain/auth/authorization.js';
import { availableActions } from '../../domain/workflow/job-description.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * Reads a job description's version history and its workflow trail.
 * Ported from SoficlefPlatform src/application/job-description/versions.ts.
 */

async function namesOf(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true },
  });
  return new Map(users.map((user) => [user.id, user.displayName]));
}

function actionAllowedFor(user, action) {
  const required = action === 'submit' || action === 'reopen' ? 'update' : 'validate';
  try {
    assertCanAnyScope(user, required, 'job_description');
    return true;
  } catch {
    return false;
  }
}

export async function loadDossier(user, jobDescriptionId) {
  assertCanAnyScope(user, 'read', 'job_description');

  const document = await prisma.jobDescription.findUnique({
    where: { id: jobDescriptionId },
    select: {
      id: true,
      code: true,
      jobTitleFr: true,
      jobDescriptionVersions: { orderBy: { versionNumber: 'desc' } },
    },
  });
  if (!document) return null;

  const trailRows = await prisma.workflowAction.findMany({
    where: {
      entityType: 'job_description_version',
      entityId: { in: document.jobDescriptionVersions.map((version) => version.id) },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const names = await namesOf([
    ...document.jobDescriptionVersions.flatMap((version) => [version.authorId, version.validatedBy]),
    ...trailRows.map((row) => row.actorId),
  ]);

  const versions = document.jobDescriptionVersions.map((version) => {
    const status = version.status;
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      status,
      reasonFr: version.reasonFr,
      createdAt: version.createdAt,
      validatedAt: version.validatedAt,
      authorName: version.authorId ? (names.get(version.authorId) ?? null) : null,
      validatorName: version.validatedBy ? (names.get(version.validatedBy) ?? null) : null,
      actions: availableActions(status).filter((action) => actionAllowedFor(user, action)),
    };
  });

  return {
    jobDescriptionId: document.id,
    code: document.code,
    jobTitleFr: document.jobTitleFr,
    versions,
    trail: trailRows.map((row) => ({
      id: row.id,
      action: row.action,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      commentFr: row.commentFr,
      createdAt: row.createdAt,
      actorName: row.actorId ? (names.get(row.actorId) ?? null) : null,
    })),
    currentVersionId: versions.find((version) => version.status !== 'ARCHIVED')?.id ?? null,
  };
}

/** The §6.2 field set, snapshotted into a version. */
export function snapshotFrom(document) {
  return {
    jobTitleFr: document.jobTitleFr,
    positioning: {
      structureFr: document.positioningStructureFr,
      processFr: document.positioningProcessFr,
      reportsToFr: document.positioningReportsToFr,
      subordinatesFr: document.positioningSubordinatesFr,
    },
    requirements: {
      educationFr: document.requirementEducationFr,
      additionalEducationFr: document.requirementAdditionalEducationFr,
      experienceFr: document.requirementExperienceFr,
      workPatternFr: document.requirementWorkPatternFr,
    },
    missions: document.missions.map((mission) => mission.textFr),
    permanentTasks: document.permanentTasks.map((task) => task.textFr),
    responsibilities: document.responsibilities.map((item) => item.textFr),
  };
}

/** Every job description with its position and current status — for the list view. */
export async function listJobDescriptions(user) {
  assertCanAnyScope(user, 'read', 'job_description');

  const documents = await prisma.jobDescription.findMany({
    orderBy: { jobTitleFr: 'asc' },
    select: {
      id: true,
      code: true,
      jobTitleFr: true,
      position: { select: { id: true, titleFr: true, organizationUnitId: true } },
      jobDescriptionVersions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { status: true, versionNumber: true },
      },
    },
  });

  return documents.map((document) => ({
    jobDescriptionId: document.id,
    code: document.code,
    jobTitleFr: document.jobTitleFr,
    position: document.position,
    currentStatus: document.jobDescriptionVersions[0]?.status ?? null,
    currentVersionNumber: document.jobDescriptionVersions[0]?.versionNumber ?? null,
  }));
}
