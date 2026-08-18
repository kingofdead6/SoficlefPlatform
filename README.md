# SOFICLEF — Plateforme Compétences & Emplois

Internal platform for **SOFICLEF SARL** (Si Mustapha, Boumerdès — locks and locking
solutions, ISO 9001:2015): organizational structures, jobs, job descriptions,
competencies and onboarding journeys, in French, Arabic (RTL) and English.

The first onboarding journey it carries is that of the new Directeur de Production. It is
an instance of a reusable template, not a hardcoded portal — see `docs/SCOPE.md`.

## Documentation

| File                        | What it holds                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `docs/SCOPE.md`             | Reconciled scope, MVP boundary, and the mapping of every CDC v1 module and CDC v0.1 section to a Part |
| `docs/DECISIONS.md`         | ADRs. Anything flagged `ASSUMPTION` awaits client confirmation                                        |
| `docs/OPEN-QUESTIONS.md`    | Business questions with a proposed default each, so an unanswered one never halts the build           |
| `docs/CONTENT-INVENTORY.md` | What was extracted from the client's HTML prototype, with counts and source pages                     |

## Requirements

- Node.js 22+
- Docker and Docker Compose (or a local PostgreSQL 16)

## Getting started

```bash
cp .env.example .env          # then fill in POSTGRES_PASSWORD and AUTH_SESSION_SECRET
docker compose up --build     # Postgres 16 + the app, migrations applied on start-up
```

The application is on http://localhost:3000. The design-token showcase, development only,
is on http://localhost:3000/dev/tokens.

Without Docker, point `DATABASE_URL` at your own PostgreSQL and run:

```bash
npm ci
npx prisma generate
npm run db:deploy
npm run dev
```

## Scripts

| Command                                   | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                             | Development server                                             |
| `npm run build` / `npm start`             | Production build and server                                    |
| `npm run lint` / `npm run lint:fix`       | ESLint, including the layering and RTL rules                   |
| `npm run format` / `npm run format:check` | Prettier                                                       |
| `npm run typecheck`                       | `tsc --noEmit`, strict                                         |
| `npm run test:unit`                       | Vitest                                                         |
| `npm run seed:extract`                    | Re-parse the HTML prototype into `seed/data/`                  |
| `npm run db:migrate`                      | Create and apply a migration (development)                     |
| `npm run db:deploy`                       | Apply pending migrations (any environment)                     |
| `npm run db:check`                        | Fail if `schema.prisma` and `prisma/migrations/` have diverged |

## Architecture

```
src/
├── domain/           business rules and types — imports no framework
├── application/      use cases, orchestration
├── infrastructure/   Prisma, HTTP, storage adapters
├── app/              routes (App Router)
├── components/       UI, built against the tokens
├── lib/              cross-cutting helpers (env, fonts)
└── styles/tokens.css the design system, as CSS custom properties
```

Dependencies point inwards. `src/domain` may not import Next, React, Prisma or an
adapter, and ESLint enforces it (ADR-019).

Two further rules are enforced rather than remembered:

- **RTL safety** — physical CSS direction properties (`margin-left`, `pl-*`, `left`) are
  banned in favour of logical ones (`margin-inline-start`, `ps-*`, `inset-inline-start`),
  so every component mirrors correctly in Arabic (ADR-029).
- **Server-side validation** — every server boundary parses its input with Zod, even where
  the client already validated (ADR-014).

## Conventions

- No secret in the repository. `.env.example` documents every variable; `.env` is ignored.
- Migrations are versioned. `prisma db push` is for a throwaway local database only.
- Nothing extracted from the prototype is retyped by hand — re-run `npm run seed:extract`.
- Business content is never machine-translated. Untranslated fields fall back to French
  with a visible "translation pending" affordance (ADR-025).

## Languages

French is the design and content language, Arabic adds RTL, English carries the
international industrial vocabulary. Routes are locale-prefixed: `/fr/…`, `/ar/…`,
`/en/…`.

- `messages/fr.json` is the source of truth; `ar.json` and `en.json` mirror its key
  structure, and `npm run i18n:check` fails CI on a missing key, an orphaned key or a
  dropped ICU placeholder.
- `lang` and `dir` come from the URL, so a link states its own language.
- Physical CSS direction properties are banned by lint; layouts mirror on their own.
- Arabic uses Noto Kufi Arabic and Noto Sans Arabic — Playfair Display has no Arabic
  glyphs — and Western Arabic digits, so a document code or a phone extension reads
  identically in all three languages.
- **Business content is never machine-translated.** Extracted French stays French until
  the client supplies reviewed translations; the UI falls back to French with a visible
  "traduction en attente" marker.

## Security model

Rights are **role + scope**, never role alone. The seven profiles of CDC v0.1 §3 are
`TECH_ADMIN`, `BIZ_ADMIN_CE`, `HEAD_CE`, `HR`, `MANAGER`, `EMPLOYEE`, `VIEWER`.

- One decision point: `can(user, action, resource, scope)` in `src/domain/auth`. Every
  route, action and repository calls it; there is no second place a permission is decided.
- Scope is applied **in the query**, not in the UI: a manager's request returns their
  structures and what hangs beneath them, and nothing else.
- An out-of-scope read answers 404, so ids cannot be used to map the organization.
- Every sensitive mutation writes an audit row — actor, action, entity, before, after —
  in the same transaction as the change.
- Sessions are server-side and revocable on the next request; passwords are Argon2id.

`npm run test:api` asserts these over the wire, including the direct-URL and
direct-API-call cases, because a hidden link is not a security boundary.

## Data seeded from the prototype

`seed/data/` holds 14 validated JSON files extracted from the client's HTML prototype:
company identity, the four values (Arabic verbatim), the 2024–2026 strategy, the
`EN-012-DRH` job description, the organization, the management team, open recruitments,
the Kaizen missions and their 17 tracked actions, the QMS and HSE reference data, the
12-milestone onboarding checklist, the internal directory and the document list.
Counts are asserted by the extractor and re-asserted in CI.
