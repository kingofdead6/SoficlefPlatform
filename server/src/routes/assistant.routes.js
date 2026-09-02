import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { answerWithAgent } from '../application/assistant/answer.js';
import { AGENTS, AGENT_IDS } from '../domain/assistant/agents.js';
import { canAnyScope } from '../domain/auth/authorization.js';
import { isConfigured, modelName } from '../infrastructure/ai/huggingface.js';
import { rateLimiter } from '../infrastructure/security/rate-limit.js';

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
const AGENT_LABELS = {
  orientation: {
    titleFr: 'Agent 1 · Accueil',
    purposeFr: '« À qui m’adresser pour… », depuis l’organigramme visible et l’annuaire.',
  },
  documents: {
    titleFr: 'Agent 2 · Documents',
    purposeFr: 'Retrouver une procédure dans la bibliothèque documentaire qui vous est ouverte.',
  },
  onboarding: {
    titleFr: 'Agent 3 · Parcours',
    purposeFr: 'Répondre sur l’avancement de votre propre parcours d’intégration.',
  },
  training: {
    titleFr: 'Agent 4 · Formation',
    purposeFr: 'Modules obligatoires du catalogue et vos propres résultats.',
  },
  competencies: {
    titleFr: 'Agent 5 · Compétences',
    purposeFr: 'Compétences attendues d’un poste et écarts constatés.',
  },
};

/**
 * GET /api/v1/assistant/agents — the assistant structure: which agents exist, what each may
 * read, whether it answers, and what is doing the answering.
 *
 * `live` is now true for all five because all five have a retriever. `provider` reports the
 * *actual* environment state so the UI can tell the reader whether a model phrased the
 * answer or the platform listed the rows itself — neither claim should be hardcoded in a
 * page.
 */
router.get('/agents', (req, res) => {
  const configured = isConfigured();

  const data = AGENT_IDS.map((id) => ({
    id,
    ...AGENTS[id],
    ...AGENT_LABELS[id],
    live: true,
    /*
     * Whether *this* caller can use the agent, derived from the agent's own declared `reads`
     * and the caller's permissions — never from their role name. A page that hardcoded
     * "managers get these three" would drift from the permission catalogue the moment a role
     * changed; this cannot, because it asks the same `canAnyScope` the retrievers ask.
     */
    available: AGENTS[id].reads.some((resource) => canAnyScope(req.user, 'read', resource)),
  }));

  res.json({
    data,
    provider: configured ? 'huggingface' : null,
    modelName: modelName(),
  });
});

const Ask = z.object({ question: z.string().trim().min(2).max(300) });

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
    res.status(429).json({
      error: 'rate-limited',
      message: 'Trop de questions en peu de temps. Réessayez dans un instant.',
      retryAt: resetAt,
    });
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

    res.json(await answerWithAgent(req.user, 'orientation', parsed.data.question));
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

    res.json(await answerWithAgent(req.user, agentId, parsed.data.question));
  } catch (error) {
    next(error);
  }
});

export default router;
