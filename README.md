# SOFICLEF — Plateforme Compétences & Emplois

Internal platform for **SOFICLEF SARL** (Si Mustapha, Boumerdès — locks and locking
solutions, ISO 9001:2015): organizational structures, jobs, job descriptions,
competencies and onboarding journeys, in French, Arabic (RTL) and English.

The first onboarding journey it carries is that of the new Directeur de Production. It is
an instance of a reusable template, not a hardcoded portal — see `docs/SCOPE.md`.

## Documentation

| File                        | What it holds                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `docs/USER-GUIDE.md`        | **How the platform works**: each user type, what they can and cannot do, the pages, the two workflows |
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

## Running the test suites

`npm run test:unit` needs nothing but the repository. The **E2E and API suites apply
migrations and reseed**, which resets every demo account's password, so they require
`TEST_DATABASE_URL` to point at a separate, throwaway database and refuse to start if it
is unset or resolves to the same host, port and database name as `DATABASE_URL`
(`tests/support/test-database.ts`).

```bash
npm run test:unit                     # no database needed
TEST_DATABASE_URL=… npm run test:e2e  # builds, seeds a throwaway database, runs Playwright
TEST_DATABASE_URL=… npm run test:api  # the security suite, over HTTP
```

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

## Application shell

A fixed 268px sidebar, a 52px top bar and a scrolling content area — the prototype's
structure, rebuilt with logical properties so it mirrors in Arabic. Below tablet width the
sidebar becomes a drawer.

- Seventeen routes in six groups. Each declares the permission it needs, so the menu and the
  route agree by construction: entries a user cannot open are never sent to the browser,
  and typing the URL answers 404.
- Every route is a real page with an empty state that names what will live there and what
  unblocks it — never "coming soon".
- Shared components (`Card`, `SectionTitle`, `DataTable`, `StatusBadge`, `Tabs`, `Timeline`,
  `Stepper`, `Modal`, `Drawer`, `EmptyState`, `KpiTile`) are documented on `/dev/components`,
  built on the tokens, RTL-safe and keyboard-navigable.
- Lighthouse accessibility scores 100 on the shell in French and Arabic and on the sign-in
  form; the E2E suite also runs axe with the WCAG 2.1 AA rule set.

The AI assistant is deliberately absent from the navigation: it is phase 2, and the
prototype's browser-side implementation could not have worked outside a sandbox (ADR-003).

## Modules

| Route              | What it does                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Public pages       | `/`, `/entreprise`, `/strategie`, `/carrieres` — no session needed. See `docs/USER-GUIDE.md` §2   |
| `/dashboard`       | Role-aware KPIs: onboarding health, competency gaps, job-description coverage, data quality       |
| `/organization`    | The structure tree, with create / edit / archive. Nothing is deleted — archival preserves history |
| `/onboarding`      | The 30-day journey: task states, deadlines, lateness, manager validation, and an oversight table  |
| `/competencies`    | The job↔competency matrix, gaps against a configurable level scale, and assessment recording      |
| `/remarks`         | The collaborator's journal to HR and the DG, with an audited text export                          |
| `/hr`              | The queue of unplaced accounts, and assignment to a post. `HR` only                               |
| `/pending`         | Where an account with no post lands: a message and the HR contact, no sidebar, no data            |
| `/admin`           | Accounts, roles and the audit trail. `TECH_ADMIN` only                                            |
| `/job-description` | The `EN-012-DRH` fiche, its versions, and the §6.1 validation circuit                             |
| Content routes     | Company, strategy, management, recruitment, Kaizen, QMS, HSE, contacts, documents                 |

### The provisioning chain

An account reaches the platform through two roles, never one. `TECH_ADMIN` creates it on
`/admin`; `HR` gives it a post on `/hr`. Until that second step the account is
`PENDING_ASSIGNMENT` and every route redirects to `/pending`.

The split is enforced in the permission table, not by hiding buttons: HR does not hold
`user:create`, and `TECH_ADMIN` does not hold `assignment:create`. `/hr` is gated on
*creating* an assignment rather than reading one, because an administrator legitimately
reads assignments and must still never be offered the screen that makes one.

Assigning is a single transaction: it closes any open assignment, opens the new one, marks
the seat occupied, flips the lifecycle state, and creates the onboarding journey with its
J+7/30/60/90 surveys. Reassignment closes the previous row rather than deleting it — the
history is what the turnover reporting reads.

### The org model

`Position` is the seat, `Assignment` is who holds it and when. A person's placement is not
free text on their record: it is a row with dates, which is what makes "who held this post
in March" answerable and lets a post be reassigned without rebuilding the chart. A partial
unique index enforces at most one *open* assignment per person.

`getVisibleTree()` returns the slice of the chart a given user may see — the whole thing for
a global reader, their own sub-tree for a manager, and a configurable window (levels up,
levels down, peers) for everyone else. The limits come from `AppSetting`, and the narrowing
happens in the SQL, not in the component.

Every mutation goes through one helper (`src/application/shared/mutate.ts`) that
authenticates, re-validates the payload with Zod, authorizes against the resolved target
and writes the audit row in the same transaction — so a new action cannot forget one of
the four.

The public pages are a sibling route group, `src/app/[locale]/(public)/`, deliberately not
a child of `(app)`: the `(app)` layout resolves the session and refuses anonymous
visitors, so a page that must stay public cannot live under it. Their reads are isolated in
`src/application/public/presentation.ts`, where every query names its columns explicitly —
adding a field to a table can therefore never widen what an anonymous visitor sees.

Two gaps are deliberate and documented in `docs/SCOPE.md`: field-level editing of a job
description's §6.2 content (the versioning and validation workflow around it is complete),
and document upload with per-document ACLs, which awaits the storage decision (OQ-15).

The AI assistant is structure only, and deliberately so (ADR-003): `src/domain/assistant/`
declares the five agents of CDC-2026 §4, what each may read, and the rule that an answer
either cites a source the reader can check or admits it found nothing. Agent 1
(`src/application/assistant/orientation.ts`) answers "who do I talk to about X" by
retrieval over the asker's *own* visible org tree and the contact directory — no model, no
API key, no vector storage anywhere in the codebase.

Set `DEMO_DATA=true` to badge every page as demonstration data, so seeded people are not
mistaken for colleagues.

## Data seeded from the prototype

`seed/data/` holds 14 validated JSON files extracted from the client's HTML prototype:
company identity, the four values (Arabic verbatim), the 2024–2026 strategy, the
`EN-012-DRH` job description, the organization, the management team, open recruitments,
the Kaizen missions and their 17 tracked actions, the QMS and HSE reference data, the
12-milestone onboarding checklist, the internal directory and the document list.
Counts are asserted by the extractor and re-asserted in CI.


admin@soficlef.local — ADMIN
rh@soficlef.local — HR
manager@soficlef.local — MANAGER
nouveau.1@ through nouveau.4@soficlef.local — four EMPLOYEE recruits, plus attente@soficlef.local