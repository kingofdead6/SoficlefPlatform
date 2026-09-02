import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { assistantApi } from '../../api/assistant.js';
import { EmptyState } from '../manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * The one question-and-answer surface, used by every assistant page.
 *
 * There was previously a copy of this in each page, which is how the employee page and the
 * HR page ended up describing the same feature differently. One component means one
 * description, and — more importantly — one place where the "no source, no answer" rule is
 * rendered.
 *
 * Two things it never does:
 *   - it never invents a fallback answer when the server returns `answer: null`;
 *   - it never renders a source the server did not send, because the server's sources come
 *     from retrieval rather than from the model's text.
 */

/** Why an answer came back plainer than usual. The reader deserves the difference. */
const DEGRADED_FR = {
  timeout: 'Le modèle n’a pas répondu à temps — voici les résultats de la recherche.',
  rate_limited: 'Le quota du modèle est atteint — voici les résultats de la recherche.',
  model_loading:
    'Le modèle est en cours de démarrage (comptez ~20 s) — voici les résultats de la recherche en attendant.',
  error: 'Le modèle n’a pas pu être joint — voici les résultats de la recherche.',
  not_configured: null,
};

export default function AssistantChat({
  agentId,
  titleFr,
  purposeFr,
  provider,
  modelName,
  suggestions = [],
  placeholder = 'Posez votre question…',
  emptyDetailFr = 'Posez une question, ou choisissez l’une des suggestions ci-dessus.',
}) {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [askError, setAskError] = useState(null);
  const inputRef = useRef(null);
  const reduce = useReducedMotion();

  async function ask(event, preset) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (text.length < 2) return;

    setAsking(true);
    setAskError(null);
    try {
      const result = await assistantApi.ask(agentId, text);
      setExchanges((current) => [
        { id: `${agentId}-${Date.now()}`, question: text, ...result },
        ...current,
      ]);
      setQuestion('');
      inputRef.current?.focus();
    } catch (error) {
      setAskError(
        error?.status === 429
          ? 'Trop de questions en peu de temps. Réessayez dans un instant.'
          : 'La recherche a échoué. Réessayez dans un instant.',
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <section>
      {(titleFr || purposeFr) && (
        <div className="mb-3">
          {titleFr && <h3 className="font-display text-lg text-text">{titleFr}</h3>}
          {purposeFr && <p className="mt-1 text-sm text-text-dim">{purposeFr}</p>}
        </div>
      )}

      <form onSubmit={ask} className={`${CARD} p-4`}>
        <label className="block text-sm text-text-muted">
          Votre question
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            placeholder={placeholder}
            className="mt-1 w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={asking || question.trim().length < 2}
            className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
          >
            {asking ? 'Recherche…' : 'Demander'}
          </button>
          <ProviderNote provider={provider} modelName={modelName} />
        </div>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={asking}
              onClick={(event) => ask(event, suggestion)}
              className="rounded-app border border-border px-3 py-1.5 text-xs text-text-dim transition-colors hover:border-red-brand hover:text-red-brand disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {askError && (
        <p className="mt-4 rounded-app border border-status-red/40 bg-status-red/5 px-4 py-2 text-sm text-status-red">
          {askError}
        </p>
      )}

      <AnimatePresence initial={false}>
        {exchanges.length > 0 && (
          <motion.ul
            variants={staggerContainer(0.05)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="mt-6 space-y-3"
          >
            {exchanges.map((exchange) => (
              <motion.li
                key={exchange.id}
                variants={staggerItem}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={CARD}
              >
                <p className="border-b border-border px-4 py-3 text-sm font-medium text-text">
                  {exchange.question}
                </p>
                <div className="px-4 py-3">
                  {exchange.answer ? (
                    <>
                      <p className="whitespace-pre-wrap text-sm text-text">{exchange.answer}</p>

                      {exchange.reason && DEGRADED_FR[exchange.reason] && (
                        <p className="mt-2 text-xs text-text-dim">{DEGRADED_FR[exchange.reason]}</p>
                      )}

                      {exchange.sources?.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                            Sources
                          </p>
                          <ul className="flex flex-wrap gap-2">
                            {exchange.sources.map((source) => (
                              <li key={`${source.kind}-${source.id}`}>
                                <Link
                                  to={source.href}
                                  className="inline-block rounded-app border border-border px-2 py-1 text-xs text-red-brand transition-colors hover:bg-surface-2"
                                >
                                  {source.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-text-dim">
                      Je n’ai rien trouvé qui corresponde dans les données que vous êtes autorisé à
                      consulter. Plutôt qu’une réponse approximative, l’assistant préfère ne rien
                      affirmer : reformulez la question, ou consultez directement la rubrique
                      concernée.
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {exchanges.length === 0 && (
        <div className="mt-6">
          <EmptyState detail={emptyDetailFr} muted />
        </div>
      )}
    </section>
  );
}

/**
 * What is answering, stated honestly and driven by the server's `provider` field rather than
 * by a hardcoded sentence. Both states are true claims; which one is true is not this
 * component's decision to make.
 */
export function ProviderNote({ provider, modelName }) {
  if (provider) {
    return (
      <span className="text-xs text-text-dim">
        Réponses formulées par {modelName ?? 'un modèle de langage'} ({provider}), à partir des
        seules données que vous pouvez déjà consulter.
      </span>
    );
  }
  return (
    <span className="text-xs text-text-dim">
      Aucun modèle de langage n’est raccordé : l’assistant répond par recherche dans vos données
      visibles, et cite ce qu’il a trouvé.
    </span>
  );
}
