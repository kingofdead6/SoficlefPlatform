import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';

import { publicApi } from '../../api/public.js';
import {
  DrawRule,
  Eyebrow,
  MeshBackdrop,
  ParticleField,
  Reveal,
  RevealGroup,
  RevealItem,
} from '../../components/public/Visuals.jsx';

const SECTION = 'mx-auto max-w-6xl px-6';

export default function Strategie() {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    publicApi
      .strategy()
      .then(({ data }) => setStrategy(data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* ------------------------------------------------------------------ hero */}
      <section data-flock className="relative flex min-h-[60svh] flex-col justify-center overflow-hidden border-b border-border">
        <MeshBackdrop />
        <div className={`${SECTION} relative pb-16 pt-28 lg:pb-20 lg:pt-28`}>
          {/* planFr is database content; only the fallback is ours to translate. */}
          <Eyebrow>{strategy?.planFr ?? t('public.strategy.eyebrowFallback')}</Eyebrow>
          <h1
            className="max-w-3xl font-display text-4xl leading-[1.1] text-text sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            <Trans i18nKey="public.strategy.heroTitle">
              <span className="text-red-deep" />
            </Trans>
          </h1>
          {strategy?.globalObjectiveFr && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
              {strategy.globalObjectiveFr}
            </p>
          )}
        </div>
      </section>

      {loading && (
        <div className={`${SECTION} py-16`}>
          <p className="text-center text-sm text-text-dim">{t('public.strategy.loading')}</p>
        </div>
      )}

      {failed && (
        <div className={`${SECTION} py-16`}>
          <p className="rounded-app border border-dashed border-border p-8 text-center text-sm text-text-dim">
            {t('public.strategy.loadFailed')}
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- marchés */}
      {strategy?.markets?.length > 0 && (
        <section className={`${SECTION} py-16`}>
          <Reveal>
            <Eyebrow>{t('public.strategy.marketsEyebrow')}</Eyebrow>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
              {t('public.strategy.marketsTitle')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-text-muted">
              {t('public.strategy.marketsLede')}
            </p>
            <DrawRule className="mt-6 max-w-2xl" />
          </Reveal>

          <RevealGroup className="mt-9 grid gap-5 lg:grid-cols-2">
            {strategy.markets.map((market) => (
              <RevealItem key={market.marketFr} className="h-full">
                <article className="flex h-full flex-col rounded-app border border-border bg-surface p-6 shadow-app">
                  <h3 className="font-display text-xl text-red-deep">{market.marketFr}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {market.strategyFr}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-text-dim">
                        {t('public.strategy.marketShare')}
                      </dt>
                      <dd className="mt-1 font-display text-lg text-text">
                        {market.marketShareTargetFr}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-text-dim">
                        {t('public.strategy.revenue')}
                      </dt>
                      <dd className="mt-1 font-display text-lg text-text">
                        {market.revenueTargetFr}
                      </dd>
                    </div>
                  </dl>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* --------------------------------------------------------------- projets */}
      {strategy?.projects?.length > 0 && (
        <section className="relative overflow-hidden border-y border-border bg-surface-2/60">
          <div aria-hidden className="absolute inset-0 opacity-60">
            <ParticleField density={26} />
          </div>
          <div className={`${SECTION} relative py-16`}>
            <Reveal>
              <Eyebrow>{t('public.strategy.projectsEyebrow')}</Eyebrow>
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
                {t('public.strategy.projectsTitle')}
              </h2>
            </Reveal>

            <RevealGroup className="mt-9 grid gap-4 lg:grid-cols-3">
              {strategy.projects.map((project) => (
                <RevealItem key={project.code} className="h-full">
                  <article className="flex h-full flex-col rounded-app border border-border bg-surface p-5 shadow-app">
                    <span className="font-mono text-xs text-red-brand">{project.code}</span>
                    <h3 className="mt-1.5 font-medium text-text">{project.titleFr}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">
                      {project.descriptionFr}
                    </p>
                  </article>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------------- cta */}
      <section className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-6 py-14`}>
          <div>
            <h2 className="font-display text-2xl text-text">{t('public.strategy.ctaTitle')}</h2>
            <p className="mt-2 max-w-xl text-sm text-text-muted">{t('public.strategy.ctaLede')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/organigramme"
              className="rounded-app bg-red-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('public.links.viewOrgChart')}
            </Link>
            <Link
              to="/entreprise"
              className="rounded-app border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('public.links.theCompany')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
