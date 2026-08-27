/**
 * The five assistants of CDC-2026 §4, as a domain model.
 *
 * **No provider is called from anywhere in this module or below it.** ADR-003 keeps the
 * MVP free of any LLM dependency, and CDC v0.1 §22 forbids a business feature that depends
 * on one. What exists here is the shape the feature will take: which agents there are,
 * what each is allowed to answer from, and the rule that an answer without a source is not
 * an answer. The generation step is a later, server-side addition behind this boundary.
 *
 * Domain code: no framework imports, no database, no I/O (ADR-019).
 */

export const AGENT_IDS = [
  /** "Who do I talk to about X" — answered from the asker's own visible org tree. */
  'orientation',
  /** "Where do I find the leave policy" — answered from the document library. */
  'documents',
  /** "What is left on my checklist" — answered from the asker's own journey. */
  'onboarding',
  /** "What training must I complete" — answered from the catalogue and the asker's record. */
  'training',
  /** "What does this job require" — answered from the job descriptions and competency frame. */
  'competencies',
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

/**
 * What an agent may read.
 *
 * Deliberately expressed as the platform's own resources rather than as a free-text
 * prompt: an agent is not a way around `can()`. Whatever it retrieves is fetched with the
 * asker's own permissions and scope, so an assistant can never surface a row its user
 * could not have opened directly.
 */
export interface AgentDefinition {
  id: AgentId;
  /** Message key under `assistant.agents`, not a hardcoded label. */
  labelKey: string;
  /** The resources this agent retrieves from, all read as the asking user. */
  reads: string[];
  /**
   * Whether an answer may ever be produced without at least one citation.
   *
   * Always false, and kept explicit rather than assumed: an assistant that answers "ask
   * HR" with no source is worse than one that says it does not know, because the user
   * cannot check it. This flag exists so the rule is visible in the model rather than
   * buried in a template.
   */
  requiresSource: false;
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
  orientation: {
    id: 'orientation',
    labelKey: 'orientation',
    reads: ['position', 'assignment', 'organization_unit'],
    requiresSource: false,
  },
  documents: {
    id: 'documents',
    labelKey: 'documents',
    reads: ['document'],
    requiresSource: false,
  },
  onboarding: {
    id: 'onboarding',
    labelKey: 'onboarding',
    reads: ['onboarding_instance', 'onboarding_task'],
    requiresSource: false,
  },
  training: {
    id: 'training',
    labelKey: 'training',
    reads: ['training'],
    requiresSource: false,
  },
  competencies: {
    id: 'competencies',
    labelKey: 'competencies',
    reads: ['competency', 'job_description'],
    requiresSource: false,
  },
};

/**
 * Where a piece of an answer came from, so the reader can check it.
 *
 * Every answer carries these. A citation names a row the user may open themselves — that
 * is what makes it checkable, and it is why the retrieval runs under their permissions
 * rather than a service account's.
 */
export interface AnswerSource {
  /** The resource type, e.g. "position". */
  kind: string;
  /** The row's id, so the UI can link to it. */
  id: string;
  /** What to show: a post title, a document name. */
  label: string;
  /** Where the reader can go to see it for themselves. */
  href?: string;
}

export interface AgentAnswer {
  agent: AgentId;
  /**
   * The answer, or null when nothing was found.
   *
   * Null is a real answer and must be shown as one. An assistant that invents a plausible
   * contact rather than admitting it has none is the specific failure this model is shaped
   * to prevent.
   */
  answer: string | null;
  sources: AnswerSource[];
}

/**
 * An answer is well-formed when it either cites something or admits it found nothing.
 *
 * The check is here, in the domain, so it is testable without a database and so no caller
 * can skip it by constructing the object itself.
 */
export function isWellFormed(answer: AgentAnswer): boolean {
  if (answer.answer === null) return answer.sources.length === 0;
  return answer.sources.length > 0;
}
