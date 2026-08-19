import 'server-only';

import { assertCan, type AuthenticatedUser } from '@/domain/auth/authorization';
import {
  availableActions,
  type JobDescriptionStatus,
  type WorkflowActionKind,
} from '@/domain/workflow/job-description';
import { prisma } from '@/infrastructure/db/client';

/**
 * Reads a job description's version history and its workflow trail (CDC v0.1 §6.1, §9).
 *
 * The §6.2 content of a version is an immutable JSON snapshot, so a later edit to the
 * live tables can never rewrite what somebody validated.
 */

export interface VersionView {
  id: string;
  versionNumber: number;
  status: JobDescriptionStatus;
  reasonFr: string | null;
  createdAt: Date;
  validatedAt: Date | null;
  authorName: string | null;
  validatorName: string | null;
  /** Which buttons this reader may press on this version. */
  actions: WorkflowActionKind[];
}

export interface WorkflowEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  commentFr: string | null;
  createdAt: Date;
  actorName: string | null;
}

export interface JobDescriptionDossier {
  jobDescriptionId: string;
  code: string;
  jobTitleFr: string;
  versions: VersionView[];
  trail: WorkflowEntry[];
  /** The version a reader should act on: the newest one that is not archived. */
  currentVersionId: string | null;
}

/** Resolves the display names of a set of user ids in one query. */
async function namesOf(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true },
  });
  return new Map(users.map((user) => [user.id, user.displayName]));
}

export async function loadDossier(
  user: AuthenticatedUser,
  jobDescriptionId: string,
): Promise<JobDescriptionDossier | null> {
  assertCan(user, 'read', 'job_description');

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
    ...document.jobDescriptionVersions.flatMap((version) => [
      version.authorId,
      version.validatedBy,
    ]),
    ...trailRows.map((row) => row.actorId),
  ]);

  const versions: VersionView[] = document.jobDescriptionVersions.map((version) => {
    const status = version.status as JobDescriptionStatus;
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      status,
      reasonFr: version.reasonFr,
      createdAt: version.createdAt,
      validatedAt: version.validatedAt,
      authorName: version.authorId ? (names.get(version.authorId) ?? null) : null,
      validatorName: version.validatedBy ? (names.get(version.validatedBy) ?? null) : null,
      // Only offer what this reader may actually do: the machine says what is legal from
      // the state, `can()` says whether this person may take that step.
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

function actionAllowedFor(user: AuthenticatedUser, action: WorkflowActionKind): boolean {
  const required = action === 'submit' || action === 'reopen' ? 'update' : 'validate';
  try {
    assertCan(user, required, 'job_description');
    return true;
  } catch {
    return false;
  }
}

/** The §6.2 field set, snapshotted into a version. */
export function snapshotFrom(document: {
  jobTitleFr: string;
  positioningStructureFr: string;
  positioningProcessFr: string;
  positioningReportsToFr: string;
  positioningSubordinatesFr: string;
  requirementEducationFr: string;
  requirementAdditionalEducationFr: string;
  requirementExperienceFr: string;
  requirementWorkPatternFr: string;
  missions: { textFr: string }[];
  permanentTasks: { textFr: string }[];
  responsibilities: { textFr: string }[];
}) {
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
