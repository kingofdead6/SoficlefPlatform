import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';

import { publicApi } from '../../api/public.js';
import {
  AuroraBackdrop,
  DrawRule,
  Eyebrow,
  HatchPanel,
  MeshBackdrop,
  ParticleField,
  Reveal,
  RevealGroup,
  RevealItem,
} from '../../components/public/Visuals.jsx';
import KeyStage from '../../components/public/KeyStage.jsx';
import Takeover from '../../components/public/Takeover.jsx';

const SECTION = 'mx-auto max-w-6xl px-6';

/**
 * What the platform does, in the company's own terms. The copy lives in the catalogues;
 * only the icon, the route and the key stems are structural.
 */
const CAPABILITIES = [
  { id: 'structure', icon: '🗺️', to: '/organigramme', linkKey: 'public.home.capabilities.structureLink' },
  { id: 'journey', icon: '📈' },
  { id: 'skills', icon: '🎯' },
];

export default function Home() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(null);
  const [values, setValues] = useState([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    publicApi.company().then(({ data }) => setCompany(data)).catch(() => setCompany(null));
    publicApi.values().then(({ data }) => setValues(data ?? [])).catch(() => setValues([]));
  }, []);

  return (
    <div>
      {/* ---------------------------------------------------------------- hero */}
      {/*
        A full-viewport hero. `min-h-svh` rather than `min-h-screen`: on mobile browsers
        100vh is the *largest* viewport height, so with the address bar showing, a 100vh
        hero pushes its own content below the fold. svh tracks the visible height instead.

        min- rather than a fixed height, so a short landscape phone scrolls the hero
        rather than clipping the headline.
      */}
      <section data-flock className="relative flex min-h-svh flex-col overflow-hidden border-b border-border">
        <MeshBackdrop />
        <div
          className={`${SECTION} relative grid flex-1 items-center gap-12 pb-20 pt-28 lg:grid-cols-[1.15fr_1fr] lg:pb-24 lg:pt-28`}
        >
          <div>
            <Eyebrow>{t('public.home.eyebrow')}</Eyebrow>

            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-4xl leading-[1.08] text-text sm:text-5xl lg:text-6xl"
              style={{ textWrap: 'balance' }}
            >
              {/* Trans, not t: the accent half of the headline is an inline <span>, and
                  which words it covers differs between languages. */}
              <Trans i18nKey="public.home.heroTitle">
                <span className="text-red-deep" />
              </Trans>
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              className="mt-5 max-w-xl text-[15px] leading-relaxed text-text-muted"
            >
              {/* missionFr is database content and renders as-is in both languages; only
                  the fallback sentence is ours to translate. */}
              {company?.missionFr ?? t('public.home.heroLedeFallback')}
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/entreprise"
                data-cursor
                data-cursor-text={t('public.home.cursorDiscover')}
                className="rounded-app bg-red-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light"
              >
                {t('public.home.heroCtaCompany')}
              </Link>
              <Link
                to="/organigramme"
                data-cursor
                data-cursor-text={t('public.home.cursorView')}
                className="rounded-app border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {t('public.home.heroCtaOrg')}
              </Link>
            </motion.div>
          </div>

          {/*
            KeyStage drives its own tilt and scroll rotation, so it is not wrapped in
            Parallax — two transform sources on one element fight for the same matrix.
          */}
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <KeyStage className="h-full w-full" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- figures */}
      {company && (
        <section className="border-b border-border bg-surface">
          <RevealGroup
            stagger={0.09}
            className={`${SECTION} grid gap-px py-0 sm:grid-cols-2 lg:grid-cols-4`}
          >
            {[
              {
                id: 'founded',
                value: company.foundedYear,
                label: t('public.home.stats.foundedIn', { city: company.foundedCity }),
              },
              { id: 'warehouse', value: '15 000 m²', label: t('public.home.stats.warehouse') },
              { id: 'iso', value: 'ISO 9001', label: t('public.home.stats.certifiedSince') },
              {
                id: 'aeo',
                // The acronym itself differs by language: OEA in French, AEO in English.
                value: t('public.home.stats.trustedOperatorAcronym'),
                label: t('public.home.stats.trustedOperator'),
              },
            ].map((stat) => (
              <RevealItem key={stat.id}>
                <div className="px-2 py-9 text-center">
                  <p className="font-display text-3xl text-red-deep sm:text-4xl">{stat.value}</p>
                  <p className="mt-1.5 text-xs uppercase tracking-[0.1em] text-text-dim">{stat.label}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* The pinned takeover band. */}
      <Takeover />

      {/* ------------------------------------------------------------ activités */}
      {company?.activities?.length > 0 && (
        <section className={`${SECTION} py-20`}>
          <Reveal>
            <Eyebrow>{t('public.home.tradesEyebrow')}</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl leading-tight text-text sm:text-4xl">
              {t('public.home.tradesTitle')}
            </h2>
            <DrawRule className="mt-6 max-w-2xl" />
          </Reveal>

          <RevealGroup className="mt-10 grid gap-5 lg:grid-cols-3">
            {company.activities.map((activity, index) => (
              <RevealItem key={activity.labelFr} className="h-full">
                <motion.article
                  data-cursor
                  whileHover={reduce ? undefined : { y: -4 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full overflow-hidden rounded-app border border-border bg-surface shadow-app transition-colors hover:border-red-brand"
                >
                  <HatchPanel
                    className="h-36"
                    icon={['⚙️', '🤝', '🚚'][index] ?? '⚙️'}
                    label={activity.labelFr}
                  />
                  <div className="p-5">
                    <h3 className="font-display text-lg text-text">{activity.labelFr}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{activity.contentFr}</p>
                  </div>
                </motion.article>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* --------------------------------------------------------------- vision */}
      <section className="relative overflow-hidden border-y border-border bg-surface-2/60">
        <AuroraBackdrop opacity={0.4} />
        <div aria-hidden className="absolute inset-0 opacity-70">
          <ParticleField />
        </div>
        <div className={`${SECTION} relative py-20`}>
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>{t('public.home.visionEyebrow')}</Eyebrow>
            <p className="font-display text-2xl leading-snug text-text sm:text-3xl" style={{ textWrap: 'balance' }}>
              {/* The quotation marks belong to the language, not the layout: French uses
                  guillemets with non-breaking spaces, English plain curly quotes. */}
              {t('public.home.visionQuote', {
                vision: company?.visionFr ?? t('public.home.visionFallback'),
              })}
            </p>
            {company?.generalManager && (
              <p className="mt-4 text-sm text-text-dim">
                {company.generalManager} · {t('public.home.visionRole')}
              </p>
            )}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------------- valeurs */}
      {values.length > 0 && (
        <section className={`${SECTION} py-20`}>
          <Reveal>
            <Eyebrow>{t('public.home.valuesEyebrow')}</Eyebrow>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
              {t('public.home.valuesTitle')}
            </h2>
          </Reveal>

          <RevealGroup stagger={0.06} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <RevealItem key={value.nameFr} className="h-full">
                <div className="flex h-full items-start gap-4 rounded-app border border-border bg-surface p-5 shadow-app">
                  <span className="font-display text-2xl text-red-brand/40">
                    {String(value.rank ?? index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="font-medium text-text">{value.nameFr}</p>
                    {value.nameAr && <p className="mt-0.5 text-sm text-text-dim">{value.nameAr}</p>}
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ------------------------------------------------------------ plateforme */}
      <section className="border-t border-border bg-surface">
        <div className={`${SECTION} py-20`}>
          <Reveal>
            <Eyebrow>{t('public.home.platform.eyebrow')}</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl leading-tight text-text sm:text-4xl">
              {t('public.home.platform.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
              {t('public.home.platform.lede')}
            </p>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-5 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <RevealItem key={capability.id} className="h-full">
                <div className="flex h-full flex-col rounded-app border border-border bg-bg p-6">
                  <span aria-hidden className="text-2xl">{capability.icon}</span>
                  <h3 className="mt-3 font-display text-lg text-text">
                    {t(`public.home.capabilities.${capability.id}Title`)}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {t(`public.home.capabilities.${capability.id}Body`)}
                  </p>
                  {capability.to && (
                    <Link
                      to={capability.to}
                      className="mt-4 text-sm font-medium text-red-brand hover:underline"
                    >
                      {t(capability.linkKey)} <span aria-hidden className="rtl:-scale-x-100">→</span>
                    </Link>
                  )}
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* -------------------------------------------------------------------- cta */}
      <section className="relative overflow-hidden border-t border-border">
        <AuroraBackdrop opacity={0.55} />
        <div className={`${SECTION} relative py-20 text-center`}>
          <Reveal>
            <h2 className="font-display text-3xl text-text sm:text-4xl" style={{ textWrap: 'balance' }}>
              {t('public.home.ctaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-text-muted">
              {t('public.home.ctaLede')}
            </p>
            <Link
              to="/login"
              className="mt-7 inline-block rounded-app bg-red-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('public.home.ctaLink')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
