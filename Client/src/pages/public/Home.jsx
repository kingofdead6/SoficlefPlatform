import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

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

/** What the platform does, in the company's own terms. */
const CAPABILITIES = [
  {
    icon: '🗺️',
    titleFr: 'Une structure lisible',
    bodyFr:
      'Chaque poste est rattaché à un responsable, chaque responsable à une structure. L’organigramme n’est pas un document annuel : il est la source que lisent les affectations et les évaluations.',
    to: '/organigramme',
    linkFr: 'Voir l’organigramme',
  },
  {
    icon: '📈',
    titleFr: 'Un parcours suivi',
    bodyFr:
      'De l’affectation à la fin de la période d’essai, chaque étape a une échéance et un responsable. Les retards se voient avant l’échéance, pas après.',
  },
  {
    icon: '🎯',
    titleFr: 'Des compétences évaluées',
    bodyFr:
      'Une matrice par poste, comparée au niveau réel du collaborateur. Les écarts nourrissent le plan de formation plutôt qu’un classeur.',
  },
];

export default function Home() {
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
            <Eyebrow>SOFICLEF SARL · depuis 1994</Eyebrow>

            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-4xl leading-[1.08] text-text sm:text-5xl lg:text-6xl"
              style={{ textWrap: 'balance' }}
            >
              Protéger la vie et les biens,
              <span className="text-red-deep"> pièce après pièce.</span>
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              className="mt-5 max-w-xl text-[15px] leading-relaxed text-text-muted"
            >
              {company?.missionFr ??
                'Des solutions alliant design, fiabilité et confort — conçues, fabriquées et distribuées depuis Boumerdès.'}
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
                data-cursor-text="Découvrir"
                className="rounded-app bg-red-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light"
              >
                Découvrir l’entreprise
              </Link>
              <Link
                to="/organigramme"
                data-cursor
                data-cursor-text="Voir"
                className="rounded-app border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
              >
                Notre organisation
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
              { value: company.foundedYear, label: `Fondée à ${company.foundedCity}` },
              { value: '15 000 m²', label: 'Entrepôt logistique' },
              { value: 'ISO 9001', label: 'Certifiée depuis 2017' },
              { value: 'OEA', label: 'Opérateur Économique Agréé' },
            ].map((stat) => (
              <RevealItem key={stat.label}>
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
            <Eyebrow>Nos métiers</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl leading-tight text-text sm:text-4xl">
              Trois pôles, une même exigence de fiabilité.
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
            <Eyebrow>Notre vision</Eyebrow>
            <p className="font-display text-2xl leading-snug text-text sm:text-3xl" style={{ textWrap: 'balance' }}>
              «&nbsp;{company?.visionFr ??
                'Devenir le leader national dans les solutions d’ouverture et de verrouillage innovantes.'}&nbsp;»
            </p>
            {company?.generalManager && (
              <p className="mt-4 text-sm text-text-dim">{company.generalManager} · Directeur Général</p>
            )}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------------- valeurs */}
      {values.length > 0 && (
        <section className={`${SECTION} py-20`}>
          <Reveal>
            <Eyebrow>Ce qui nous tient</Eyebrow>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">Nos valeurs</h2>
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
            <Eyebrow>La plateforme d’intégration</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl leading-tight text-text sm:text-4xl">
              Une intégration suivie, pas seulement lancée.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
              SOFICLEF accompagne chaque collaborateur de son affectation jusqu’à la fin de sa
              période d’essai. Le parcours est le même pour tous ; ce qu’il contient dépend du poste.
            </p>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-5 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <RevealItem key={capability.titleFr} className="h-full">
                <div className="flex h-full flex-col rounded-app border border-border bg-bg p-6">
                  <span aria-hidden className="text-2xl">{capability.icon}</span>
                  <h3 className="mt-3 font-display text-lg text-text">{capability.titleFr}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {capability.bodyFr}
                  </p>
                  {capability.to && (
                    <Link
                      to={capability.to}
                      className="mt-4 text-sm font-medium text-red-brand hover:underline"
                    >
                      {capability.linkFr} →
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
              Vous rejoignez SOFICLEF ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-text-muted">
              Votre espace collaborateur réunit votre parcours, vos documents, vos formations et
              votre organigramme.
            </p>
            <Link
              to="/login"
              className="mt-7 inline-block rounded-app bg-red-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              Accéder à mon espace
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
