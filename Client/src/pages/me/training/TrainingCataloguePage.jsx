import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { trainingApi } from '../../../api/training.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * /app/me/training — Ma formation (route guide §2.1, CORE).
 * "Mandatory + optional micro-learning, progress per module."
 *
 * Split into the two groups the spec names — obligatoire and facultatif — because the
 * distinction decides what a recruit must do this week and what they may do later, and a
 * single mixed list buries it. Progress per module comes from the catalogue's own `best`
 * attempt, which the server computes; this page never re-derives a pass from a raw score.
 */
export default function TrainingCataloguePage() {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await trainingApi.catalogue();
        setCatalogue(data);
      } catch {
        setError(t('me.training.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 20 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 });
    },
    [loading, catalogue],
  );

  const groups = useMemo(() => {
    if (!catalogue) return [];
    const entries = catalogue.entries ?? [];
    return [
      {
        id: 'mandatory',
        labelKey: 'me.training.groups.mandatory.label',
        detailKey: 'me.training.groups.mandatory.detail',
        entries: entries.filter((entry) => entry.isMandatory),
      },
      {
        id: 'optional',
        labelKey: 'me.training.groups.optional.label',
        detailKey: 'me.training.groups.optional.detail',
        entries: entries.filter((entry) => !entry.isMandatory),
      },
    ].filter((group) => group.entries.length > 0);
  }, [catalogue]);

  if (loading) return <PageLoading label={t('me.training.loading')} />;
  if (error) return <PageError message={error} />;

  const percent =
    catalogue.mandatoryTotal === 0
      ? 100
      : Math.round((catalogue.mandatoryPassed / catalogue.mandatoryTotal) * 100);

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.training.title')}
        subtitle={t('me.training.subtitle')}
        actions={
          <Link
            to="/app/me/training/certificates"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('nav.items.meCertificates')}
          </Link>
        }
      />

      <div data-gsap="band" className={`mb-8 flex flex-wrap items-center gap-8 ${CARD} p-6`}>
        <ProgressRing percent={percent} tone={catalogue.allMandatoryComplete ? 'green' : 'brand'} />
        <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3">
          <Figure
            label={t('me.training.mandatoryPassed')}
            value={catalogue.mandatoryPassed}
            suffix={`/${catalogue.mandatoryTotal}`}
          />
          <Figure label={t('me.training.modulesOffered')} value={catalogue.entries?.length ?? 0} />
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
              {t('me.training.journey')}
            </p>
            <p
              className={cn(
                'font-display text-2xl',
                catalogue.allMandatoryComplete ? 'text-status-green' : 'text-red-deep',
              )}
            >
              {catalogue.allMandatoryComplete ? t('me.training.complete') : t('me.training.inProgress')}
            </p>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={t('me.training.noModulesTitle')} detail={t('me.training.noModulesDetail')} muted />
      ) : (
        <div data-gsap="band" className="flex-1 space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="font-display text-xl text-text">{t(group.labelKey)}</h2>
              <p className="mb-4 text-xs text-text-dim">{t(group.detailKey)}</p>

              <motion.ul
                variants={staggerContainer(0.06, 0.15)}
                initial={initialOrNone(reduce)}
                animate="visible"
                className="grid gap-4 sm:grid-cols-2"
              >
                {group.entries.map((entry) => (
                  <motion.li
                    key={entry.id}
                    variants={staggerItem}
                    whileHover={reduce ? undefined : { y: -3, boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)' }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ModuleCard entry={entry} />
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ entry }) {
  const { t } = useTranslation();
  const passed = entry.best?.passed ?? false;
  const attempted = Boolean(entry.best);

  return (
    <div
      className={cn(
        CARD,
        'flex h-full flex-col p-5',
        passed ? 'border-status-green/40' : '',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-medium text-text">{entry.titleFr}</h3>
        {entry.isMandatory && (
          <span className="shrink-0 rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
            {t('me.training.mandatoryBadge')}
          </span>
        )}
      </div>

      <p className="mb-4 flex-1 text-sm text-text-dim">{entry.summaryFr}</p>

      {/*
        Progress per module. The bar shows the best score against the module's own passing
        score, not against 100 — "62 % on a module that passes at 60 %" is a pass, and a bar
        drawn to 100 would make it look like a near-miss.
      */}
      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-text-dim">
            {attempted ? t('me.training.bestScore', { score: entry.best.score }) : t('me.training.notAttempted')}
          </span>
          <span className="text-text-dim">{t('me.training.threshold', { score: entry.passingScore })}</span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn('h-full', passed ? 'bg-status-green' : attempted ? 'bg-status-amber' : 'bg-surface-2')}
            style={{ width: `${Math.min(100, entry.best?.score ?? 0)}%` }}
          />
          <span
            aria-hidden
            className="absolute top-0 h-full w-px bg-text-dim/40"
            style={{ left: `${Math.min(100, entry.passingScore)}%` }}
          />
        </div>
      </div>

      <div className="mb-4 text-xs text-text-muted">
        {t('me.training.questionCount', { count: entry.questionCount })}
        {passed && ` · ${t('me.training.moduleValidated')}`}
      </div>

      <Link
        to={`/app/me/training/${entry.code}`}
        className={cn(
          'inline-block rounded-app px-3 py-2 text-center text-sm font-medium transition-colors',
          passed
            ? 'border border-border text-text hover:border-red-brand hover:text-red-brand'
            : 'bg-red-brand text-white hover:bg-red-light',
        )}
      >
        {passed ? t('me.training.reviewModule') : attempted ? t('me.training.retry') : t('me.training.start')}
      </Link>
    </div>
  );
}

function Figure({ label, value, suffix = '' }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-2xl text-red-deep">
        <CountUp value={value} />
        {suffix && <span className="text-base text-text-dim">{suffix}</span>}
      </p>
    </div>
  );
}
