import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { publicApi } from '../../api/public.js';
import {
  DrawRule,
  Eyebrow,
  HatchPanel,
  MeshBackdrop,
  Parallax,
  ParticleField,
  Reveal,
  RevealGroup,
  RevealItem,
} from '../../components/public/Visuals.jsx';

const SECTION = 'mx-auto max-w-6xl px-6';

/** The company's own milestones, drawn as a vertical timeline. */
const MILESTONES = [
  { year: '1994', titleFr: 'Création à Alger', bodyFr: 'SOFICLEF est fondée comme SARL, sur les solutions d’ouverture et de verrouillage.' },
  { year: '2017', titleFr: 'Certification ISO 9001', bodyFr: 'Le système de management de la qualité est certifié ISO 9001:2015 en septembre.' },
  { year: 'Aujourd’hui', titleFr: 'Opérateur Économique Agréé', bodyFr: 'Le statut OEA reconnaît la fiabilité de la chaîne logistique et douanière.' },
];

export default function Entreprise() {
  const [company, setCompany] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    publicApi
      .company()
      .then(({ data }) => setCompany(data))
      .catch(() => setFailed(true));
  }, []);

  const identity = company
    ? [
        { labelFr: 'Raison sociale', value: company.legalName },
        { labelFr: 'Forme juridique', value: company.legalForm },
        { labelFr: 'Année de création', value: String(company.foundedYear) },
        { labelFr: 'Ville de création', value: company.foundedCity },
        { labelFr: 'Siège', value: company.headquarters },
        { labelFr: 'Direction générale', value: company.generalManager },
        { labelFr: 'Certification', value: company.certification },
        { labelFr: 'Statut', value: company.status },
      ]
    : [];

  return (
    <div>
      {/* ------------------------------------------------------------------ hero */}
      <section data-flock className="relative flex min-h-[60svh] flex-col justify-center overflow-hidden border-b border-border">
        <MeshBackdrop />
        <div className={`${SECTION} relative pb-16 pt-28 lg:pb-20 lg:pt-28`}>
          <Eyebrow>L’entreprise</Eyebrow>
          <h1
            className="max-w-3xl font-display text-4xl leading-[1.1] text-text sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            Trente ans de <span className="text-red-deep">serrurerie industrielle</span> algérienne
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            De la fabrication de corps de serrure à la distribution nationale, SOFICLEF conçoit et
            produit depuis Boumerdès les composants qui ferment portes, coffres et bâtiments.
          </p>
        </div>
      </section>

      {failed && (
        <div className={`${SECTION} py-16`}>
          <p className="rounded-app border border-dashed border-border p-8 text-center text-sm text-text-dim">
            Les informations de l’entreprise ne sont pas disponibles pour le moment.
          </p>
        </div>
      )}

      {/* -------------------------------------------------- mission &amp; vision */}
      {company && (
        <section className={`${SECTION} py-16`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal>
              <article className="flex h-full flex-col rounded-app border border-border bg-surface p-7 shadow-app">
                <Eyebrow>Mission</Eyebrow>
                <p className="font-display text-xl leading-snug text-text">{company.missionFr}</p>
              </article>
            </Reveal>
            <Reveal delay={0.08}>
              <article className="relative flex h-full flex-col overflow-hidden rounded-app border border-border bg-surface p-7 shadow-app">
                <div aria-hidden className="absolute inset-0 opacity-60">
                  <ParticleField density={22} />
                </div>
                <div className="relative">
                  <Eyebrow>Vision</Eyebrow>
                  <p className="font-display text-xl leading-snug text-text">{company.visionFr}</p>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- identité */}
      {company && (
        <section className="border-y border-border bg-surface">
          <div className={`${SECTION} py-16`}>
            <Reveal>
              <Eyebrow>Carte d’identité</Eyebrow>
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
                Les faits, sans emballage
              </h2>
              <DrawRule className="mt-6" />
            </Reveal>

            <RevealGroup
              stagger={0.05}
              className="mt-9 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Plain elements rather than <dt>/<dd>: RevealGroup renders a <div>, and a
                  definition list whose terms are not children of a <dl> is invalid markup
                  that screen readers do not announce as pairs. */}
              {identity.map((row) => (
                <RevealItem key={row.labelFr}>
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-text-dim">
                      {row.labelFr}
                    </p>
                    <p className="mt-1 text-sm font-medium text-text">{row.value}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- métiers */}
      {company?.activities?.length > 0 && (
        <section className={`${SECTION} py-16`}>
          <Reveal>
            <Eyebrow>Nos métiers</Eyebrow>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
              Produire, distribuer, livrer
            </h2>
          </Reveal>

          <RevealGroup className="mt-9 space-y-4">
            {company.activities.map((activity, index) => (
              <RevealItem key={activity.labelFr}>
                <article className="grid gap-5 rounded-app border border-border bg-surface p-5 shadow-app sm:grid-cols-[128px_1fr] sm:items-center">
                  <Parallax distance={22} className="h-24 sm:h-full">
                    <HatchPanel
                      className="h-24 sm:h-full"
                      icon={['⚙️', '🤝', '🚚'][index] ?? '⚙️'}
                    />
                  </Parallax>
                  <div>
                    <h3 className="font-display text-lg text-text">{activity.labelFr}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                      {activity.contentFr}
                    </p>
                  </div>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ---------------------------------------------------------------- repères */}
      <section className="border-t border-border bg-surface">
        <div className={`${SECTION} py-16`}>
          <Reveal>
            <Eyebrow>Repères</Eyebrow>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
              Quelques dates
            </h2>
          </Reveal>

          <RevealGroup stagger={0.12} className="mt-9 max-w-3xl">
            {MILESTONES.map((milestone, index) => (
              <RevealItem key={milestone.year}>
                {/* A <div>, not an <li>: RevealGroup is a <div>, so a list item here would
                    have no list to belong to. The sequence is carried by the connector line
                    and the dates themselves. */}
                <div className="relative flex gap-6 pb-8 last:pb-0">
                  {/* Connector, omitted on the final item so the line ends with the list. */}
                  {index < MILESTONES.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-4 h-full w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden
                    className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-red-brand bg-bg"
                  />
                  <div>
                    <p className="font-mono text-sm text-red-brand">{milestone.year}</p>
                    <h3 className="mt-0.5 font-medium text-text">{milestone.titleFr}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{milestone.bodyFr}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* -------------------------------------------------------------------- cta */}
      <section className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-6 py-14`}>
          <div>
            <h2 className="font-display text-2xl text-text">Comment nous sommes organisés</h2>
            <p className="mt-2 max-w-xl text-sm text-text-muted">
              Structures, unités de production et cellules fonctionnelles — l’organigramme complet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/organigramme"
              className="rounded-app bg-red-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              Voir l’organigramme
            </Link>
            <Link
              to="/strategie"
              className="rounded-app border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Notre stratégie
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
