import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { answerWithAgent } from '../application/assistant/answer.js';
import { AGENTS, AGENT_IDS } from '../domain/assistant/agents.js';
import { canAnyScope } from '../domain/auth/authorization.js';
import { isConfigured, modelName } from '../infrastructure/ai/huggingface.js';
import { rateLimiter } from '../infrastructure/security/rate-limit.js';
import { ASSISTANT_LANGUAGES } from '../application/assistant/language.js';
import { isAgentEnabled } from '../application/assistant/config.js';

const router = Router();
router.use(requireAuth);

/**
 * The assistant's HTTP surface.
 *
 * All five agents now answer. Each answers by retrieval over the caller's own visible data
 * first; a Hugging Face model, when one is configured, rephrases what retrieval found and
 * nothing more. With no key the endpoints behave identically minus the rephrasing, so the
 * feature does not depend on an external service being reachable.
 */
/**
 * How each agent is announced to a reader.
 *
 * Catalogue *keys*, not sentences. This used to hold French `titleFr`/`purposeFr` strings,
 * which meant the one part of the assistant that names what it does stayed French on the
 * English and Arabic interfaces — the agent picker read "Agent 3 · Parcours" next to an
 * otherwise fully translated page. The server has no business choosing that wording anyway:
 * it knows which agents exist, the client knows which language the reader is in.
 *
 * `order` travels with them because "Agent 1 … Agent 5" is a numbering the copy refers to,
 * and a client sorting agents itself would have to duplicate it.
 */
const AGENT_LABELS = {
  orientation: { labelKey: 'assistant.agentLabels.orientation', order: 1 },
  documents: { labelKey: 'assistant.agentLabels.documents', order: 2 },
  onboarding: { labelKey: 'assistant.agentLabels.onboarding', order: 3 },
  training: { labelKey: 'assistant.agentLabels.training', order: 4 },
  competencies: { labelKey: 'assistant.agentLabels.competencies', order: 5 },
};

/**
 * GET /api/v1/assistant/agents — the assistant structure: which agents exist, what each may
 * read, whether it answers, and what is doing the answering.
 *
 * `live` is now true for all five because all five have a retriever. `provider` reports the
 * *actual* environment state so the UI can tell the reader whether a model phrased the
 * answer or the platform listed the rows itself — neither claim should be hardcoded in a
 * page.
 *
 * Three different "can I use this?" facts travel separately rather than being collapsed into
 * one boolean, because a reader who cannot use an agent deserves to know which of them is the
 * reason:
 *   - `live`      — the platform has a retriever for it at all.
 *   - `available` — this caller's permissions reach what it reads.
 *   - `enabled`   — an administrator has not switched it off.
 */
router.get('/agents', async (req, res, next) => {
  try {
  const configured = isConfigured();

  const data = await Promise.all(
    AGENT_IDS.map(async (id) => ({
      id,
      ...AGENTS[id],
      ...AGENT_LABELS[id],
      live: true,
      /*
       * Whether *this* caller can use the agent, derived from the agent's own declared
       * `reads` and the caller's permissions — never from their role name. A page that
       * hardcoded "managers get these three" would drift from the permission catalogue the
       * moment a role changed; this cannot, because it asks the same `canAnyScope` the
       * retrievers ask.
       */
      available: AGENTS[id].reads.some((resource) => canAnyScope(req.user, 'read', resource)),
      /** The administrator's switch (/admin/ai). Absent means on. */
      enabled: await isAgentEnabled(id),
    })),
  );

  res.json({
    data,
    provider: configured ? 'huggingface' : null,
    modelName: modelName(),
    /** Which languages an answer can be requested in, so the client need not hardcode them. */
    languages: ASSISTANT_LANGUAGES,
  });
  } catch (error) {
    next(error);
  }
});

/**
 * `language` is optional and unconstrained beyond being a short string: the application layer
 * narrows it (`assistantLanguage`) and falls back to French. Validating it against the
 * supported list *here* would turn "this deployment does not speak Tamazight yet" into a 422
 * with no answer at all, where falling back gives the reader their answer in French — the
 * lesser of the two failures by a wide margin.
 */
const Ask = z.object({
  question: z.string().trim().min(2).max(300),
  language: z.string().trim().max(16).optional(),
});

/**
 * Per-user rate limit on the model-backed endpoints.
 *
 * Reuses infrastructure/security/rate-limit.js, the same in-memory limiter the login flow
 * uses — correct for a single instance, and swappable for Redis behind the same interface.
 * An LLM endpoint without a ceiling is a billing incident waiting to happen, and the ceiling
 * belongs per *user* rather than per IP so one office cannot be locked out by one colleague.
 */
const ASK_MAX_PER_WINDOW = 20;
const ASK_WINDOW_SECONDS = 60;

async function askLimited(req, res) {
  const { allowed, resetAt } = await rateLimiter.consume(
    `assistant:ask:${req.user.id}`,
    ASK_MAX_PER_WINDOW,
    ASK_WINDOW_SECONDS,
  );

  if (!allowed) {
    /*
     * No prose in the body. The client already renders its own translated sentence for a 429
     * (`public.assistant.tooManyQuestions`), so a French `message` here is either ignored or,
     * worse, shown to an Arabic reader. The status code and `retryAt` are the facts; the
     * wording belongs to whoever is displaying it.
     */
    res.status(429).json({ error: 'rate-limited', retryAt: resetAt });
    return false;
  }
  return true;
}

/**
 * POST /api/v1/assistant/orientation/ask — kept as an alias so existing clients keep working.
 * Declared before /:agentId so the literal path is not swallowed by the parameter.
 */
router.post('/orientation/ask', async (req, res, next) => {
  try {
    const parsed = Ask.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ agent: 'orientation', answer: null, sources: [] });
    }
    if (!(await askLimited(req, res))) return;

    res.json(
      await answerWithAgent(req.user, 'orientation', parsed.data.question, parsed.data.language),
    );
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/assistant/:agentId/ask — the five agents, one handler. */
router.post('/:agentId/ask', async (req, res, next) => {
  try {
    const { agentId } = req.params;
    if (!AGENT_IDS.includes(agentId)) {
      return res.status(404).json({ error: 'not-found' });
    }

    const parsed = Ask.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ agent: agentId, answer: null, sources: [] });
    }
    if (!(await askLimited(req, res))) return;

    res.json(
      await answerWithAgent(req.user, agentId, parsed.data.question, parsed.data.language),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
