import { prisma } from '../../infrastructure/db/client.js';

/**
 * The administrator's assistant settings, as the answer pipeline actually reads them.
 *
 * `/admin/ai` has always *stored* two things the pipeline ignored: which agents are enabled,
 * and a prompt template per agent. A switch that saves and changes nothing is worse than no
 * switch — an administrator who turns an agent off and watches it keep answering has been
 * told something false by their own console. This module is the missing half: the same two
 * values, read on the way to an answer.
 *
 * Three rules govern what they are allowed to do, and the reasons are in `systemPromptFor`
 * and `isAgentEnabled` below:
 *
 *   1. Absent means enabled. An untouched deployment behaves exactly as it did before this
 *      module existed, and a database that cannot be read never silently mutes the assistant.
 *   2. A custom prompt *adds to* the built-in instructions, it never replaces them. The rules
 *      that keep the assistant from inventing a name are not an administrator's to remove
 *      through a text box.
 *   3. Reading the configuration must never fail a question. Every failure path falls back to
 *      the defaults.
 */

/**
 * How long a read is reused before the table is consulted again.
 *
 * A question must not cost a configuration query — the assistant is already doing retrieval,
 * and this row changes perhaps twice a year. Thirty seconds is short enough that an
 * administrator toggling an agent sees the effect within one page refresh even if the
 * explicit invalidation below were somehow missed, and long enough that a burst of questions
 * reads the table once.
 */
const CACHE_TTL_MS = 30_000;

const DEFAULTS = { agentsEnabled: {}, promptTemplates: {} };

let cached = null;
let cachedAt = 0;

/**
 * Drop the cached configuration.
 *
 * Called by the PATCH that writes the row, so a change takes effect on the next question
 * rather than up to `CACHE_TTL_MS` later. The TTL stays as the backstop for the case this
 * call is missed — for instance a second server process, which this call cannot reach.
 */
export function invalidateAssistantConfig() {
  cached = null;
  cachedAt = 0;
}

async function load() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  const row = await prisma.aiConfig.findFirst().catch(() => null);

  cached = {
    // `?? {}` on each: the columns are JSON and nullable, and a null one must read as "no
    // opinion recorded" rather than throwing on the property access below.
    agentsEnabled: row?.agentsEnabled ?? DEFAULTS.agentsEnabled,
    promptTemplates: row?.promptTemplates ?? DEFAULTS.promptTemplates,
  };
  cachedAt = now;
  return cached;
}

/**
 * Whether an agent is switched on.
 *
 * Only an explicit `false` disables. An agent with no entry — every agent, on a deployment
 * where nobody has opened the page — is enabled, so adding this check cannot turn a working
 * assistant off. The same applies when the query fails: `load()` returns the defaults, and
 * the defaults answer.
 */
export async function isAgentEnabled(agentId) {
  const { agentsEnabled } = await load();
  return agentsEnabled?.[agentId] !== false;
}

/**
 * The system prompt for one agent: the built-in instructions, plus the administrator's
 * template when one is saved.
 *
 * Appended, never substituted. The built-in block is what stops the model inventing a name,
 * a figure or a policy, and what tells it to cite the numbered context — an administrator
 * adding "réponds en une phrase" should get one-sentence answers, not an assistant that has
 * quietly lost its grounding rules. Order matters for the same reason: the platform's rules
 * are stated first, and the house instruction arrives as a refinement of them.
 */
export async function systemPromptFor(agentId, basePrompt) {
  const { promptTemplates } = await load();
  const template = promptTemplates?.[agentId];

  if (typeof template !== 'string' || !template.trim()) return basePrompt;

  return `${basePrompt}\n\n${template.trim()}`;
}
