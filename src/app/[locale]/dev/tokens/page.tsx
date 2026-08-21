import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { devPagesEnabled } from '@/lib/dev-pages';

/**
 * Design-token showcase — development only.
 *
 * Renders every token so a palette change (OQ-22) can be reviewed on one screen, and
 * so the LTR/RTL pair can be compared side by side. It is not part of the product and
 * is not reachable in production.
 */

const BRAND = [
  { name: '--red-brand', use: 'Marque, boutons principaux, états actifs, titres de cartes' },
  { name: '--red-light', use: 'Variante claire de la marque' },
  { name: '--red-accent', use: 'Survol, barres de progression, fonds de callout' },
  { name: '--red-dim', use: 'Fond discret des éléments actifs' },
  { name: '--blue', use: 'En-têtes de tableaux, badges de structure, actions secondaires' },
  { name: '--blue-dim', use: 'Fond discret des badges de structure' },
];

const SURFACES = [
  { name: '--bg', use: "Arrière-plan de l'application" },
  { name: '--surface', use: 'Cartes, modales, tableaux' },
  { name: '--surface2', use: 'Surface secondaire, survol' },
  { name: '--border', use: 'Bordures de cartes et de tableaux' },
];

const STATUS = [
  { name: '--green', use: 'Validé / conforme' },
  { name: '--red', use: 'Critique / vacant / en retard' },
];

const TEXT = [
  { name: '--text', use: 'Texte principal' },
  { name: '--text-muted', use: 'Texte secondaire' },
  { name: '--text-dim', use: 'Texte tertiaire, libellés' },
];

function Swatch({ name, use }: { name: string; use: string }) {
  return (
    <div className="flex items-center gap-3 rounded-(--radius) border border-(--border) bg-(--surface) p-3">
      <div
        aria-hidden
        className="size-10 shrink-0 rounded-md border border-(--border)"
        style={{ background: `var(${name})` }}
      />
      <div className="min-w-0">
        <div className="text-text font-mono text-xs">{name}</div>
        <div className="text-text-muted text-xs">{use}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-text mb-3 text-lg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Rendered per request rather than prerendered: whether these pages exist is a runtime
 * decision (ENABLE_DEV_PAGES), and a build-time snapshot would freeze the answer.
 */
export const dynamic = 'force-dynamic';

export default async function TokensPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Part of the toolkit, not the product: absent from production unless deliberately
  // switched on with ENABLE_DEV_PAGES.
  if (!devPagesEnabled()) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-10">
        <p className="text-text-dim font-mono text-xs tracking-widest uppercase">
          SOFICLEF · Design system
        </p>
        <h1 className="text-text text-3xl">Tokens</h1>
        <p className="text-text-muted mt-2 max-w-prose">
          Industriel, premium, précis. L&apos;or est un accent parcimonieux sur un fond sable : il
          signale la hiérarchie, il ne décore pas. Les cartes sont sobres et bordées, les données
          sont en chasse fixe.
        </p>
      </header>

      <Section title="Marque">
        <div className="grid gap-3 sm:grid-cols-2">
          {BRAND.map((token) => (
            <Swatch key={token.name} {...token} />
          ))}
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid gap-3 sm:grid-cols-2">
          {SURFACES.map((token) => (
            <Swatch key={token.name} {...token} />
          ))}
        </div>
      </Section>

      <Section title="États">
        <div className="grid gap-3 sm:grid-cols-2">
          {STATUS.map((token) => (
            <Swatch key={token.name} {...token} />
          ))}
        </div>
        <p className="text-text-muted mt-3 text-xs">
          Un état n&apos;est jamais porté par la couleur seule : chaque statut affiche aussi un
          libellé ou une icône.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-(--red) bg-white px-2 py-1 text-xs text-(--red)">
            <span aria-hidden>⚠</span> Responsable VACANT
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-(--green) bg-white px-2 py-1 text-xs text-(--green)">
            <span aria-hidden>✓</span> Validée
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-(--red-brand) bg-(--red-dim) px-2 py-1 text-xs text-(--red-brand)">
            <span aria-hidden>◷</span> En cours
          </span>
        </div>
      </Section>

      <Section title="Texte">
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT.map((token) => (
            <Swatch key={token.name} {...token} />
          ))}
        </div>
      </Section>

      <Section title="Typographie">
        <div className="space-y-4 rounded-(--radius) border border-(--border) bg-(--surface) p-5">
          <div>
            <p className="text-text-dim font-mono text-xs">--font-display · titres</p>
            <p className="font-display text-text text-2xl">Direction de Production</p>
          </div>
          <div>
            <p className="text-text-dim font-mono text-xs">--font-ui · interface</p>
            <p className="text-text text-base">
              Plateforme de gestion des structures, emplois et compétences.
            </p>
          </div>
          <div>
            <p className="text-text-dim font-mono text-xs">--font-mono · données</p>
            <p className="data text-text text-base">
              EN-012-DRH · PR02 · Poste 121 · +60% · 8 Mds DZD
            </p>
          </div>
          <div lang="ar" dir="rtl">
            <p className="text-text-dim font-mono text-xs" dir="ltr">
              locale ar · Noto Kufi Arabic / Noto Sans Arabic
            </p>
            <p className="font-display text-text text-2xl">الحزم والاحترام</p>
            <p className="text-text text-base">الابتكار والتطوير المستمر</p>
          </div>
        </div>
      </Section>

      <Section title="Direction du document">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['ltr', 'rtl'] as const).map((dir) => (
            <div
              key={dir}
              data-testid={`dir-demo-${dir}`}
              dir={dir}
              lang={dir === 'rtl' ? 'ar' : 'fr'}
              className="rounded-(--radius) border border-(--border) bg-(--surface) p-4"
            >
              <p className="text-text-dim font-mono text-xs" dir="ltr">
                dir=&quot;{dir}&quot;
              </p>
              {/*
                Logical properties only: border-inline-start and padding-inline-start
                mirror on their own, so this block needs no RTL-specific rule (ADR-029).
              */}
              <div className="mt-2 border-s-4 border-s-(--red-brand) ps-3">
                <p className="text-text text-sm">
                  {dir === 'rtl'
                    ? 'هيكل التصنيع — المسؤول شاغر'
                    : 'Structure Fabrication — Responsable VACANT'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Géométrie">
        <div className="flex flex-wrap items-end gap-4">
          <div className="rounded-(--radius) border border-(--border) bg-(--surface) p-4 shadow-(--shadow)">
            <p className="text-text-dim font-mono text-xs">--radius · --shadow</p>
            <p className="text-text text-sm">Carte sobre et bordée</p>
          </div>
          <div className="rounded-(--radius) border border-(--border) bg-(--surface) p-4">
            <p className="text-text-dim font-mono text-xs">--sidebar-w · --topbar-h</p>
            <p className="data text-text text-sm">268px · 52px</p>
          </div>
        </div>
      </Section>
    </main>
  );
}
