/**
 * Whether an agent can be put in front of this reader right now.
 *
 * Three separate facts come back from `GET /assistant/agents`, and all three have to be true:
 *
 *   - `live`      — the platform has a retriever for it.
 *   - `available` — this reader's permissions reach what it reads.
 *   - `enabled`   — an administrator has not switched it off in /admin/ai.
 *
 * `!== false` rather than a truthiness test, deliberately: an older server that does not send
 * `enabled` at all must keep working, and `undefined` there means "no opinion", not "off".
 *
 * Shared rather than repeated per page because it was repeated per page — four copies of
 * `agent.available !== false`, which is how the `enabled` flag would have reached three of
 * them and been forgotten in the fourth.
 */
export function isAgentUsable(agent) {
  return Boolean(agent) && agent.available !== false && agent.enabled !== false;
}
