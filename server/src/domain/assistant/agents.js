/**
 * The five assistants of CDC-2026 §4, as a domain model.
 *
 * **No provider is called from anywhere in this module or below it.** ADR-003 keeps the
 * MVP free of any LLM dependency, and CDC v0.1 §22 forbids a business feature that depends
 * on one. What exists here is the shape the feature will take: which agents there are,
 * what each is allowed to answer from, and the rule that an answer without a source is not
 * an answer. The generation step is a later, server-side addition behind this boundary.
 *
 * Ported faithfully from SoficlefPlatform src/domain/assistant/agents.ts.
 * Domain code: no framework imports, no database, no I/O.
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
];

/**
 * What an agent may read.
 *
 * Deliberately expressed as the platform's own resources rather than as a free-text
 * prompt: an agent is not a way around `can()`. Whatever it retrieves is fetched with the
 * asker's own permissions and scope, so an assistant can never surface a row its user
 * could not have opened directly.
 */
export const AGENTS = {
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
 * An answer is well-formed when it either cites something or admits it found nothing.
 *
 * The check is here, in the domain, so it is testable without a database and so no caller
 * can skip it by constructing the object itself.
 */
export function isWellFormed(answer) {
  if (answer.answer === null) return answer.sources.length === 0;
  return answer.sources.length > 0;
}
