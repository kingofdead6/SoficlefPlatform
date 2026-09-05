import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';

import { publicApi } from '../../api/public.js';
import OrgChart from '../../components/org/OrgChart.jsx';
import {
  DrawRule,
  Eyebrow,
  MeshBackdrop,
  Reveal,
  RevealGroup,
  RevealItem,
} from '../../components/public/Visuals.jsx';

const SECTION = 'mx-auto max-w-6xl px-6';

/**
 * How each unit type reads on a public page. The keys are the `type` values actually
 * stored on organization_unit (DIRECTION, STRUCTURE, UNITE_PRODUCTION, CELLULE) — an
 * unmapped type falls back to its raw value rather than disappearing, so a new type added
 * to the table shows up looking unfinished instead of silently vanishing from the chart.
 */
const TYPE_META = {
  DIRECTION: { labelKey: 'public.org.types.directionLabel', helpKey: 'public.org.types.directionHelp' },
  STRUCTURE: { labelKey: 'public.org.types.structureLabel', helpKey: 'public.org.types.structureHelp' },
  UNITE_PRODUCTION: {
    labelKey: 'public.org.types.uniteProductionLabel',
    helpKey: 'public.org.types.uniteProductionHelp',
  },
  CELLULE: {
    labelKey: 'public.org.types.celluleLabel',
    helpKey: 'public.org.types.celluleHelp',
  },
};

/** Display order, so the summary and the detail read top-down rather than alphabetically. */
const TYPE_ORDER = ['DIRECTION', 'STRUCTURE', 'UNITE_PRODUCTION', 'CELLULE'];

/**
 * /organigramme — the public organisation chart, replacing the former Carrières page.
 *
 * It renders the same shared OrgChart component the internal portals use, so the public
 * view and the employee view cannot drift into showing different shapes of the company.
 * The data comes from GET /public/organization, whose `select` deliberately omits which
 * posts are vacant, the internal criticality notes and per-cell staffing — a visitor sees
 * how the company is organised, not where it is short-handed.
 */
export default function Organigramme() {
  const { t } = useTranslation();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);

  /*
   * An unmapped type still falls back to its raw stored value rather than disappearing, so
   * a new type added to the table shows up looking unfinished instead of vanishing.
   */
  const typeLabel = (type) => (TYPE_META[type] ? t(TYPE_META[type].labelKey) : type);

  useEffect(() => {
    publicApi
      .organization()
      .then(({ data }) => setUnits(data ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  /**
   * OrgChart keys on `parentPositionId` / `titleFr`, so the units are mapped onto that
   * shape rather than the component being forked for a second data source.
   */
  const nodes = useMemo(
    () =>
      units.map((unit) => ({
        id: unit.id,
        parentPositionId: unit.parentId,
        titleFr: unit.nameFr,
        code: unit.code,
        type: unit.type,
        descriptionFr: unit.descriptionFr,
      })),
    [units],
  );

  /*
   * Grouped and ordered top-down. The API sorts by `type` alphabetically, which would put
   * "Cellules" above "Direction" — correct as a query, wrong as a hierarchy.
   */
  const byType = useMemo(() => {
    const groups = new Map();
    for (const unit of units) {
      if (!groups.has(unit.type)) groups.set(unit.type, []);
      groups.get(unit.type).push(unit);
    }

    const rank = (type) => {
      const index = TYPE_ORDER.indexOf(type);
      return index === -1 ? TYPE_ORDER.length : index;
    };

    return new Map([...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)));
  }, [units]);

  return (
    <div>
      {/* ------------------------------------------------------------------ hero */}
      <section data-flock className="relative flex min-h-[60svh] flex-col justify-center overflow-hidden border-b border-border">
        <MeshBackdrop />
        <div className={`${SECTION} relative pb-16 pt-28 lg:pb-20 lg:pt-28`}>
          <Eyebrow>{t('public.org.eyebrow')}</Eyebrow>
          <h1
            className="max-w-3xl font-display text-4xl leading-[1.1] text-text sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            <Trans i18nKey="public.org.heroTitle">
              <span className="text-red-deep" />
            </Trans>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            {t('public.org.heroLede')}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- summary */}
      {units.length > 0 && (
        <section className="border-b border-border bg-surface">
          <RevealGroup
            stagger={0.09}
            className={`${SECTION} grid gap-px sm:grid-cols-2 lg:grid-cols-4`}
          >
            {[...byType.entries()].map(([type, list]) => (
              <RevealItem key={type}>
                <div className="px-2 py-9 text-center">
                  <p className="font-display text-3xl text-red-deep sm:text-4xl">{list.length}</p>
                  <p className="mt-1.5 text-xs uppercase tracking-[0.1em] text-text-dim">
                    {typeLabel(type)}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ----------------------------------------------------------------- chart */}
      <section className={`${SECTION} py-16`}>
        <Reveal>
          <Eyebrow>{t('public.org.chartEyebrow')}</Eyebrow>
          <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
            {t('public.org.chartTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-text-muted">{t('public.org.chartLede')}</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 overflow-x-auto rounded-app border border-border bg-surface p-6 shadow-app">
            {loading ? (
              <p className="py-12 text-center text-sm text-text-dim">{t('public.org.loading')}</p>
            ) : failed ? (
              <p className="py-12 text-center text-sm text-text-dim">
                {t('public.org.loadFailed')}
              </p>
            ) : (
              <OrgChart
                nodes={nodes}
                emptyLabel={t('public.org.notPublished')}
                subtitleOf={(node) => typeLabel(node.type)}
                onSelect={(node) => setSelected(node)}
              />
            )}
          </div>
        </Reveal>

        {/* The read-only detail panel for the selected entity. */}
        {selected && (
          <Reveal>
            <aside className="mt-5 rounded-app border border-red-brand/40 bg-red-brand/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-brand">
                    {typeLabel(selected.type)}
                  </p>
                  <h3 className="mt-1 font-display text-xl text-text">{selected.titleFr}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-app border border-border bg-surface px-2.5 py-1 text-xs text-text-dim hover:text-red-brand"
                >
                  {t('common.actions.close')}
                </button>
              </div>
              {selected.descriptionFr && (
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {selected.descriptionFr}
                </p>
              )}
            </aside>
          </Reveal>
        )}
      </section>

      {/* ---------------------------------------------------------------- by type */}
      {units.length > 0 && (
        <section className="border-t border-border bg-surface">
          <div className={`${SECTION} py-16`}>
            <Reveal>
              <Eyebrow>{t('public.org.detailEyebrow')}</Eyebrow>
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
                {t('public.org.detailTitle')}
              </h2>
              <DrawRule className="mt-6 max-w-2xl" />
            </Reveal>

            <div className="mt-10 space-y-10">
              {[...byType.entries()].map(([type, list]) => (
                <div key={type}>
                  <Reveal>
                    <div className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-border pb-2">
                      <h3 className="font-display text-xl text-red-deep">{typeLabel(type)}</h3>
                      <p className="text-sm text-text-dim">
                        {TYPE_META[type] ? t(TYPE_META[type].helpKey) : null}
                      </p>
                    </div>
                  </Reveal>

                  <RevealGroup stagger={0.06} className="grid gap-4 lg:grid-cols-2">
                    {list.map((unit) => (
                      <RevealItem key={unit.id} className="h-full">
                        <article className="flex h-full gap-4 rounded-app border border-border bg-bg p-5">
                          <div className="min-w-0">
                            <h4 className="font-medium text-text">{unit.nameFr}</h4>
                            {unit.descriptionFr && (
                              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                                {unit.descriptionFr}
                              </p>
                            )}
                          </div>
                        </article>
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------------- cta */}
      <section className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-6 py-14`}>
          <div>
            <h2 className="font-display text-2xl text-text">{t('public.org.ctaTitle')}</h2>
            <p className="mt-2 max-w-xl text-sm text-text-muted">{t('public.org.ctaLede')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/entreprise"
              className="rounded-app border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('public.links.theCompany')}
            </Link>
            <Link
              to="/strategie"
              className="rounded-app bg-red-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('public.links.ourStrategy')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
