import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

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

/**
 * Why an answer came back plainer than usual. The reader deserves the difference. Keyed by
 * the server's `reason` value; `not_configured` deliberately maps to nothing, because that
 * case is already explained by ProviderNote below.
 */
const DEGRADED_KEYS = {
  timeout: 'public.assistant.degraded.timeout',
  rate_limited: 'public.assistant.degraded.rateLimited',
  model_loading: 'public.assistant.degraded.modelLoading',
  error: 'public.assistant.degraded.error',
  not_configured: null,
};

export default function AssistantChat({
  agentId,
  titleFr,
  purposeFr,
  provider,
  modelName,
  suggestions = [],
  placeholder,
  /*
   * Kept as `emptyDetailFr` rather than renamed: pages outside this slice still pass it by
   * that name, and it carries whatever text the caller supplies. Defaults are resolved in
   * the body, not in the signature — a default here would be frozen at module load and
   * would not follow a language change.
   */
  emptyDetailFr,
}) {
  const { t } = useTranslation();
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
          ? t('public.assistant.tooManyQuestions')
          : t('public.assistant.askFailed'),
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
          {t('public.assistant.questionLabel')}
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            placeholder={placeholder ?? t('public.assistant.defaultPlaceholder')}
            className="mt-1 w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={asking || question.trim().length < 2}
            className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
          >
            {asking ? t('public.assistant.asking') : t('public.assistant.askButton')}
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
                      {/*
                        The grounding badge is the whole point of the ungrounded path: an
                        answer the model recalled must never be mistaken for one drawn from
                        this platform's records. Shown above the text, not below it, so it
                        is read first.
                      */}
                      {exchange.grounded === false && (
                        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-status-amber/40 bg-status-amber/10 px-2.5 py-1 text-[11px] font-medium text-status-amber">
                          <span aria-hidden>◇</span>
                          {t('public.assistant.ungroundedBadge')}
                        </p>
                      )}

                      <p className="whitespace-pre-wrap text-sm text-text">{exchange.answer}</p>

                      {exchange.grounded === false && (
                        <p className="mt-2 text-xs text-text-dim">
                          {t('public.assistant.ungroundedNote')}
                        </p>
                      )}

                      {exchange.reason && DEGRADED_KEYS[exchange.reason] && (
                        <p className="mt-2 text-xs text-text-dim">
                          {t(DEGRADED_KEYS[exchange.reason])}
                        </p>
                      )}

                      {exchange.sources?.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                            {t('public.assistant.sources')}
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
                    <p className="text-sm text-text-dim">{t('public.assistant.noAnswer')}</p>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {exchanges.length === 0 && (
        <div className="mt-6">
          <EmptyState detail={emptyDetailFr ?? t('public.assistant.defaultEmptyDetail')} muted />
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
