# Architecture Decision Records — SOFICLEF Platform

Format: **Context → Decision → Consequences → Status**.

`ASSUMPTION` means the decision is a working assumption made to unblock building and is
**pending client confirmation**. `ACCEPTED` means the decision is internal to engineering and
needs no business sign-off. Nothing here is silently reversible: changing an `ASSUMPTION`
after the client answers is a scoped piece of work, noted per ADR under _Consequences_.

Index

| ADR                 | Title                                                             | Status     |
| ------------------- | ----------------------------------------------------------------- | ---------- |
| [ADR-001](#adr-001) | Build CDC v0.1's generic platform, seeded with CDC v1's content   | ASSUMPTION |
| [ADR-002](#adr-002) | Adopt CDC v0.1's phasing over CDC v1's four one-week sprints      | ASSUMPTION |
| [ADR-003](#adr-003) | AI agent deferred to phase 2                                      | ASSUMPTION |
| [ADR-004](#adr-004) | Gold/navy palette, behind a token layer                           | ASSUMPTION |
| [ADR-005](#adr-005) | Seven role profiles from CDC v0.1 §3                              | ASSUMPTION |
| [ADR-006](#adr-006) | Next.js App Router + React + TypeScript strict                    | ACCEPTED   |
| [ADR-007](#adr-007) | Tailwind CSS over CSS custom-property tokens                      | ACCEPTED   |
| [ADR-008](#adr-008) | Headless accessible primitives (Radix), no UI kit                 | ACCEPTED   |
| [ADR-009](#adr-009) | PostgreSQL                                                        | ACCEPTED   |
| [ADR-010](#adr-010) | Prisma with versioned migrations, no `db push` outside local dev  | ACCEPTED   |
| [ADR-011](#adr-011) | Credentials auth with a server-side session table                 | ASSUMPTION |
| [ADR-012](#adr-012) | Argon2id password hashing, configurable policy                    | ACCEPTED   |
| [ADR-013](#adr-013) | `next-intl` with locale-prefixed routes                           | ACCEPTED   |
| [ADR-014](#adr-014) | Zod validation at every server boundary                           | ACCEPTED   |
| [ADR-015](#adr-015) | Vitest for unit tests, Playwright for E2E                         | ACCEPTED   |
| [ADR-016](#adr-016) | Docker Compose for local infrastructure                           | ACCEPTED   |
| [ADR-017](#adr-017) | CI gates: lint, typecheck, unit, build, migration check           | ACCEPTED   |
| [ADR-018](#adr-018) | Locale-driven font stacks; Arabic display face chosen up front    | ACCEPTED   |
| [ADR-019](#adr-019) | Domain / application / infrastructure layering                    | ACCEPTED   |
| [ADR-020](#adr-020) | Single server-side authorization helper `can()`                   | ACCEPTED   |
| [ADR-021](#adr-021) | Scope filtering in the data layer, never in the UI                | ACCEPTED   |
| [ADR-022](#adr-022) | Audit entry on every mutation of a sensitive entity               | ACCEPTED   |
| [ADR-023](#adr-023) | No secrets in the repository                                      | ACCEPTED   |
| [ADR-024](#adr-024) | Translation strategy: per-field columns + a translations table    | ASSUMPTION |
| [ADR-025](#adr-025) | Business content is never machine-translated                      | ASSUMPTION |
| [ADR-026](#adr-026) | The HTML prototype is the content source of truth                 | ASSUMPTION |
| [ADR-027](#adr-027) | Extraction preserves French verbatim and asserts its own counts   | ACCEPTED   |
| [ADR-028](#adr-028) | Kaizen action count follows the prototype (17), not the brief's 5 | ASSUMPTION |
| [ADR-029](#adr-029) | Physical CSS direction properties are banned by lint              | ACCEPTED   |
| [ADR-030](#adr-030) | Status is never communicated by colour alone                      | ACCEPTED   |
| [ADR-031](#adr-031) | Navigation is filtered server-side by permission                  | ACCEPTED   |
| [ADR-032](#adr-032) | Western Arabic numerals in the Arabic locale                      | ASSUMPTION |

---

<a id="adr-001"></a>

## ADR-001 — Build CDC v0.1's generic platform, seeded with CDC v1's content

**Context.** Two specifications describe different products. CDC v1 specifies a fixed
onboarding portal for one named person (M. DJAOUDI Farid), 8 modules, all content hardcoded.
CDC v0.1 specifies a generic platform for structures, jobs, competencies and onboarding
journeys, reusable across the company. The client has approved the prototype, which is the
v1 shape. HR's stated intent (CDC v1 §1.4, CDC v0.1 §1) is both: get M. Djaoudi operational
fast _and_ obtain a reusable framework.

**Decision.** Build v0.1's generic architecture. Seed it with v1's content. M. Djaoudi's
onboarding becomes the first _instance_ of a reusable onboarding template attached to the
`EN-012-DRH` job, not a hardcoded page. v0.1 is a superset of v1: every v1 module maps onto a
v0.1 entity (see `SCOPE.md` §4).

**Consequences.** Slower to first screen than a hardcoded portal, because content lives in
the database behind roles and scopes rather than in markup. In exchange the second onboarding
costs configuration rather than development. Every v1 page becomes a query over seeded data,
so the extraction in Part 1 is on the critical path. If the client rejects this and wants only
the fixed portal, Parts 7–13 shrink drastically but Parts 0–5 are unaffected.

**Status.** ASSUMPTION — the underlying conflict is a business decision, not an engineering one.

<a id="adr-002"></a>

## ADR-002 — Adopt CDC v0.1's phasing over CDC v1's four one-week sprints

**Context.** CDC v1 §6 estimates 4 sprints of one week for the whole platform including the
RAG agent. CDC v0.1 §20 estimates 9–16 weeks across 7 phases.

**Decision.** Follow v0.1's phasing.

**Consequences.** The 4-week figure does not cover authentication, RBAC with organizational
scope, i18n, RTL, the audit trail or a competency engine — all of which CDC v0.1 makes
mandatory in the MVP (§24) and none of which can be retrofitted cheaply. Committing to 4 weeks
would mean cutting exactly the requirements the client's own second specification calls
non-negotiable. Planning, budget and client expectation must be reset against v0.1's phases.

**Status.** ASSUMPTION — the client set the 4-week expectation and must be told it is not held.

<a id="adr-003"></a>

## ADR-003 — AI agent deferred to phase 2

**Context.** CDC v1 §4 specifies a full RAG agent in Sprint 3: ingestion pipeline, 512-token
chunking, pgvector, hybrid retrieval, an Anthropic API call, SSE streaming, and a system
prompt. CDC v0.1 §2 and §22 place the AI agent explicitly outside the MVP and state that no
business feature may depend on an AI provider. The prototype calls `api.anthropic.com`
directly from the browser with no API key — which works only in a sandbox and fails on CORS
and authentication anywhere else.

**Decision.** Phase 2. In Parts 0–13 there are no LLM calls, no API keys, no vector storage
and no `pgvector` extension. The document-ingestion boundary is designed so the agent can be
added server-side later without a rewrite; nothing is built behind it.

**Consequences.** The prototype's "Assistant IA" page does not appear in the Part 5
navigation. When the agent arrives it will be server-side only and the browser will never hold
a key. The client sees a feature disappear relative to the prototype they were shown — this
must be said explicitly, not discovered.

**Status.** ASSUMPTION.

<a id="adr-004"></a>

## ADR-004 — Gold/navy palette, behind a token layer

**Context.** CDC v1 §5.1 and the prototype's `:root` specify gold `#8b6914` with industrial
navy `#1e4d8c` on a sand background. CDC v0.1 §13 proposes SOFICLEF red `#C8102E` with
anthracite `#30343B`, taken from the public website's logo, and flags the exact value as
still to be retrieved from the brandbook.

**Decision.** Gold/navy, lifted verbatim from the prototype's `:root`. Every colour is
consumed through a CSS custom property in `src/styles/tokens.css`; no component hardcodes a
hex value.

**Consequences.** The client has already approved gold/navy on screen, so this is the lower-risk
default. Should the brandbook mandate red/anthracite, the change is one file — the token
values — plus a contrast re-check of status colours against the new background. Enforced by
review: a raw hex in a component is a defect.

**Status.** ASSUMPTION — pending the vector logo / brandbook (OQ-22).

<a id="adr-005"></a>

## ADR-005 — Seven role profiles from CDC v0.1 §3

**Context.** CDC v1 §2.3 defines 4 roles (`ADMIN_DRH`, `DIR_PROD`, `EXECUTIVE`,
`CADRE_PROD`). CDC v0.1 §3 defines 7 profiles and adds the rule that a user must never see
the whole reference frame merely by being authenticated.

**Decision.** Implement v0.1's 7 profiles: `TECH_ADMIN`, `BIZ_ADMIN_CE`, `HEAD_CE`, `HR`,
`MANAGER`, `EMPLOYEE`, `VIEWER`. CDC v1's roles map on:
`ADMIN_DRH` → `BIZ_ADMIN_CE`; `DIR_PROD` → `EMPLOYEE` + `MANAGER`; `EXECUTIVE` → `VIEWER`;
`CADRE_PROD` → `MANAGER`.

**Consequences.** v1's roles are expressible without loss. `DIR_PROD` needs two role
assignments, which is correct: M. Djaoudi is simultaneously the subject of an onboarding
journey (`EMPLOYEE`, own data) and the head of a structure (`MANAGER`, scoped data). Rights
are always role + scope, never role alone.

**Status.** ASSUMPTION — the person-to-role assignment list must be confirmed by HR (OQ-12).

<a id="adr-006"></a>

## ADR-006 — Next.js App Router + React + TypeScript strict

**Context.** CDC v1 §2.1 recommends React/Next.js 14+ or Vue/Nuxt. CDC v0.1 §14 proposes
Next.js + React + TypeScript. Both require SSR, i18n routing and RTL.

**Decision.** Next.js (App Router), React, TypeScript with `strict: true` and path aliases.
Server Components by default; client components only where interaction demands it.

**Consequences.** Locale-prefixed routing, per-segment loading/error boundaries and
server-side permission filtering all come from the framework rather than from custom code.
`strict: true` from commit one avoids a later migration.

**Status.** ACCEPTED.

<a id="adr-007"></a>

## ADR-007 — Tailwind CSS over CSS custom-property tokens

**Context.** Both specifications name Tailwind. The palette may change (ADR-004) and the
prototype's identity must be reproduced exactly.

**Decision.** Tailwind, configured so that its colour, radius and shadow scales resolve to the
custom properties declared in `src/styles/tokens.css`. Components use Tailwind utilities;
utilities resolve to tokens; tokens are the only place a literal colour appears.

**Consequences.** A palette swap is a single-file change. Dark mode, should it ever be asked
for, is a second token block rather than a component sweep.

**Status.** ACCEPTED.

<a id="adr-008"></a>

## ADR-008 — Headless accessible primitives (Radix), no heavyweight UI kit

**Context.** CDC v0.1 §13 requires cards, tables, tabs, badges, timeline, stepper, modal,
drawer; §18 requires WCAG 2.1 AA; §12.1 requires RTL. CDC v1 §2.1 suggests Headless UI or
shadcn.

**Decision.** Radix primitives for behaviour (focus trap, roving tabindex, dismissal,
labelling), our own markup and tokens for appearance. No MUI/AntD-class kit.

**Consequences.** Accessibility and RTL behaviour are inherited rather than reimplemented,
while the industrial visual identity stays fully ours. More component code than a kit, and
that is the point: a kit's opinions would fight the identity.

**Status.** ACCEPTED.

<a id="adr-009"></a>

## ADR-009 — PostgreSQL

**Context.** Both specifications name PostgreSQL. The data is relational and audit-heavy.

**Decision.** PostgreSQL 16. JSONB for audit before/after snapshots.

**Consequences.** Referential integrity, partial indexes and JSONB in one engine. `pgvector`
is _not_ installed — see ADR-003; adding it later is an extension, not a migration of data.

**Status.** ACCEPTED.

<a id="adr-010"></a>

## ADR-010 — Prisma with versioned migrations, no `db push` outside local dev

**Context.** CDC v0.1 §14 requires versioned migrations and strong typing; §16.1 requires
history-preserving models.

**Decision.** Prisma. Every schema change ships as a migration in `prisma/migrations/`.
`prisma db push` is permitted only against a throwaway local database, never against shared
environments, and CI fails when the schema and the migrations diverge (ADR-017).

**Consequences.** Schema history is reviewable and reversible; staging and production can be
rebuilt from zero.

**Status.** ACCEPTED.

<a id="adr-011"></a>

## ADR-011 — Credentials auth with a server-side session table

**Context.** CDC v0.1 §14 prefers SSO/OIDC "if available", otherwise local secure auth. What
SOFICLEF runs today is unknown (OQ-13). CDC v1 §2.3 asks for JWT/OAuth2.

**Decision.** Credentials (professional e-mail + password) with an opaque session token stored
hashed in a `Session` table, delivered in an httpOnly + secure + sameSite cookie, with sliding
expiry and server-side revocation. All authentication is reached through one module so an
OIDC provider can be added later without touching call sites.

**Consequences.** Revocation is immediate and real, which a stateless JWT cannot offer —
CDC v0.1 §19 requires that revoking a session takes effect on the next request. One database
read per request, which is negligible at this scale. If SSO exists at SOFICLEF, the login
screen changes and nothing else does.

**Status.** ASSUMPTION — pending the identity-system answer (OQ-13).

<a id="adr-012"></a>

## ADR-012 — Argon2id password hashing, configurable policy

**Context.** CDC v0.1 §15 requires robust hashing; §2.1 requires parameters not to be
hardcoded where the business may change them.

**Decision.** Argon2id. Memory, iteration and parallelism parameters, plus the password policy
(length, character classes, reuse, expiry), come from configuration, not from constants in
code.

**Consequences.** Parameters can be raised as hardware improves without a code change, and
SOFICLEF's IT security can impose its own policy.

**Status.** ACCEPTED.

<a id="adr-013"></a>

## ADR-013 — `next-intl` with locale-prefixed routes

**Context.** CDC v1 §2.2 names i18next or next-intl. CDC v0.1 §12 makes FR/AR/EN mandatory for
navigation and administrable reference data, with RTL for Arabic.

**Decision.** `next-intl`, routes prefixed `/fr`, `/ar`, `/en`, French default.
`messages/fr.json` is the source of truth; `ar.json` and `en.json` mirror its key structure
exactly and CI fails on a missing or orphaned key.

**Consequences.** Locale is part of the URL, so a page is shareable in a given language and
server components can resolve messages without a client round trip. Key parity is mechanical
rather than a review burden.

**Status.** ACCEPTED.

<a id="adr-014"></a>

## ADR-014 — Zod validation at every server boundary

**Context.** CDC v0.1 §14.2: validate server-side even when the client already validates.

**Decision.** Every server action, route handler, seed file and environment variable is parsed
by a Zod schema before use. Types are inferred from the schemas, so a validated payload and
its TypeScript type cannot drift apart.

**Consequences.** A client-side bypass reaches a rejection, not the database. Seed data that
does not match its schema fails the extractor loudly (ADR-027).

**Status.** ACCEPTED.

<a id="adr-015"></a>

## ADR-015 — Vitest for unit tests, Playwright for E2E

**Context.** CDC v0.1 §19 requires unit tests on business rules and E2E on critical paths,
plus explicit security and i18n test types.

**Decision.** Vitest for domain rules, authorization and schema tests; Playwright for
authenticated journeys, locale switching, RTL rendering and screenshots.

**Consequences.** Fast feedback on the layer that carries the business rules; real-browser
proof for the layer that carries the accessibility and RTL requirements.

**Status.** ACCEPTED.

<a id="adr-016"></a>

## ADR-016 — Docker Compose for local infrastructure

**Context.** CDC v0.1 §14 requires Docker + CI/CD, and hosting constraints are unknown
(OQ-14, OQ-15).

**Decision.** `docker-compose.yml` brings up PostgreSQL 16 with a named volume and the
application. A developer needs Docker and nothing else.

**Consequences.** Identical database version everywhere. On-premise deployment, which is
plausible for an Algerian industrial site with VPN constraints, stays open.

**Status.** ACCEPTED.

<a id="adr-017"></a>

## ADR-017 — CI gates: lint, typecheck, unit tests, build, migration check

**Context.** CDC v0.1 §14.2 and §18 require maintainability, tests and CI/CD.

**Decision.** Every push runs, in order: ESLint → `tsc --noEmit` → Vitest → `next build` →
`prisma migrate diff` (schema vs. migrations) → i18n key parity. A red gate blocks the merge.

**Consequences.** The migration check catches the classic "edited `schema.prisma`, forgot the
migration" defect before it reaches an environment with data.

**Status.** ACCEPTED.

<a id="adr-018"></a>

## ADR-018 — Locale-driven font stacks; Arabic display face chosen up front

**Context.** CDC v1 §5.2 specifies Playfair Display for titles, Inter for UI, JetBrains Mono
for data. **Playfair Display has no Arabic coverage** — an Arabic page would silently fall
back to a system serif and lose the identity.

**Decision.** Latin: Playfair Display (display), Inter (UI), JetBrains Mono (data). Arabic:
Noto Kufi Arabic (display), Noto Sans Arabic (UI); JetBrains Mono is kept for digits and codes
since Western Arabic numerals are used (ADR-032). Font selection is bound to the active
locale in the root layout, not chosen per component.

**Consequences.** Arabic pages keep a deliberate typographic identity instead of a fallback.
Font files are self-hosted through `next/font` so no request leaves the network at runtime —
which also matters if SOFICLEF deploys on-premise behind a restricted network.

**Status.** ACCEPTED.

<a id="adr-019"></a>

## ADR-019 — Domain / application / infrastructure layering

**Context.** CDC v0.1 §14.2 requires a clear separation.

**Decision.** `src/domain` holds business rules and types and imports no framework — no Next,
no Prisma, no React. `src/application` holds use cases and orchestrates. `src/infrastructure`
holds Prisma, HTTP, storage and other adapters. Dependencies point inwards only, and a lint
rule enforces it.

**Consequences.** Business rules are unit-testable without a database and survive a change of
ORM or framework. The cost is indirection where a direct Prisma call would be shorter; that
cost is accepted for the rules layer only, not for read-only view queries.

**Status.** ACCEPTED.

<a id="adr-020"></a>

## ADR-020 — Single server-side authorization helper `can()`

**Context.** CDC v0.1 §3 and §19 require that authorization holds against a direct URL or API
call, not merely a hidden link.

**Decision.** One function, `can(user, action, resource, scope)`, in the domain layer. Every
route, server action and query calls it. There is no second place where a permission is
decided.

**Consequences.** Authorization is auditable by reading one file and testable exhaustively.
Any new endpoint that forgets the call is visible in review, and the security suite asserts
direct-access rejection per role.

**Status.** ACCEPTED.

<a id="adr-021"></a>

## ADR-021 — Scope filtering in the data layer, never in the UI

**Context.** CDC v0.1 §3: "a user must never automatically see the whole reference frame
merely because they are authenticated."

**Decision.** Scope predicates are applied in the repository query. A `MANAGER` querying jobs
receives only the jobs inside their organizational scope; the UI never receives a fuller set
to filter down.

**Consequences.** No over-fetch, so no accidental exposure through an API response, an export,
a cache or a React devtools inspection. Repositories take the acting user as a parameter,
which is deliberate friction: a query without a caller cannot be written by accident.

**Status.** ACCEPTED.

<a id="adr-022"></a>

## ADR-022 — Audit entry on every mutation of a sensitive entity

**Context.** CDC v0.1 §15, §19.1 and success indicator "100 % of sensitive operations
historised".

**Decision.** `AuditLog` records actor, action, entity type, entity id, before and after
snapshots as JSONB, IP and timestamp. Writes cover login, logout, failed login, permission
change, role assignment and every create/update/delete on a scoped entity, in the same
transaction as the mutation. The table is append-only to the application: no update path, no
delete path.

**Consequences.** "Who changed this job description, when, from what to what" is answerable.
Storage grows with activity; retention is a business decision (OQ-16) and is _not_ silently
chosen by engineering.

**Status.** ACCEPTED.

<a id="adr-023"></a>

## ADR-023 — No secrets in the repository

**Context.** CDC v0.1 §14.2.

**Decision.** `.env.example` documents every variable with a description and a safe
placeholder. `.env*` is git-ignored except the example. No key, password or connection string
is ever committed — including in tests, fixtures and CI files, which use environment
variables or ephemeral values.

**Consequences.** A leaked repository leaks no credential. Onboarding a developer means
copying the example and filling it in.

**Status.** ACCEPTED.

<a id="adr-024"></a>

## ADR-024 — Translation strategy: per-field columns + a translations table

**Context.** CDC v0.1 §12 requires FR/AR/EN on navigation, administrable reference data and
descriptions. CDC v0.1 §16 lists a `Translation` entity "if a centralised strategy is
adopted". Two techniques compete: per-field columns and a generic translations table.

**Decision.** Both, by content shape.
_Per-field columns_ (`nameFr`, `nameAr`, `nameEn`) for short labels on reference entities —
roles, structures, competencies, competency levels, job titles, statuses. These are queried,
sorted and filtered constantly and are cheap to keep as columns.
_A `Translation` table_ keyed by (entityType, entityId, field, locale) for long-form content —
job-description sections, onboarding task instructions, remarks, document descriptions. These
are optional, numerous and edited on a review workflow.

**Consequences.** Lists and filters stay simple SQL with no join per label; long-form content
does not spread a triple of `TEXT` columns across every table and can carry per-locale review
state. The boundary must be respected: adding a fourth locale means one migration for labels
and no migration at all for long-form content.

**Status.** ASSUMPTION — the set of locales for historical business data is unconfirmed (OQ-19).

<a id="adr-025"></a>

## ADR-025 — Business content is never machine-translated

**Context.** The extracted content is HR material: a job description, QMS process ownership,
HSE safety rules. CDC v0.1 §12 requires AR/EN support; nobody has supplied AR/EN versions of
this content.

**Decision.** Extracted French stays French, verbatim. Arabic and English values are `null`
until the client supplies reviewed translations. The UI falls back to French and shows a
"translation pending" affordance. No machine translation is displayed, ever — not as a
placeholder, not behind a disclaimer.

**Consequences.** Arabic and English pages are partly French at launch, which is honest and
visible rather than plausible and wrong. A mistranslated HSE rule or job responsibility is a
liability in a certified industrial environment; a visibly missing translation is a task.

**Status.** ASSUMPTION — the client must supply translations and a reviewer (OQ-19).

<a id="adr-026"></a>

## ADR-026 — The HTML prototype is the content source of truth

**Context.** The same facts appear in CDC v1's PDF and in the prototype, and they disagree in
places — most visibly the Arabic value strings, which are corrupted in the PDF by a font
encoding fault, and the Kaizen action list (ADR-028).

**Decision.** Where the prototype and a PDF disagree on _content_, the prototype wins and the
divergence is recorded. Where they disagree on _requirements_, neither wins silently: it is
raised in `OPEN-QUESTIONS.md`.

**Consequences.** Extraction has one input, so re-running it is deterministic. The client has
seen and validated the prototype's content on screen, which the PDF text cannot claim.

**Status.** ASSUMPTION — the client should confirm, in particular the Arabic strings (OQ-21).

<a id="adr-027"></a>

## ADR-027 — Extraction preserves French verbatim and asserts its own counts

**Context.** Nothing from the prototype may be retyped by hand, and the client may send a
revised HTML.

**Decision.** `seed/extract-html.ts` parses the HTML with a DOM parser, writes one JSON file
per domain into `seed/data/`, validates each against a Zod schema in `seed/schemas/`, and
asserts an expected count per domain. On any mismatch it prints the actual-vs-expected table
and exits non-zero. It never corrects, rephrases or translates. It is idempotent: two runs on
the same input produce byte-identical output.

**Consequences.** A revised prototype is a re-run, not a retype. A silently changed count
becomes a build failure instead of a missing card noticed in UAT.

**Status.** ACCEPTED.

<a id="adr-028"></a>

## ADR-028 — Kaizen action count follows the prototype (17), not the brief's 5

**Context.** The build brief states the prototype contains 5 tracked Kaizen actions with
owner / deadline / status. It does not: that figure is CDC v1 §3.5's condensed five-row
summary table. The prototype carries **two** action plans — Mission 1 with 7 actions and
Mission 3 with 10 — totalling **17**, each with owner, deadline and status.

**Decision.** Extract all 17 and tag each with its mission. The extractor asserts 17. CDC v1's
five-row table is a view over the Mission 3 plan, not a separate dataset, and is reproduced as
such rather than stored twice.

**Consequences.** The Kaizen module (Part 8) shows the full action history rather than an
executive extract; an executive extract remains available as a filter. Anyone checking the
delivery against the brief's inventory will see 17 where 5 was expected — hence this ADR and
OQ-23.

**Status.** ASSUMPTION — flagged to the client; see `CONTENT-INVENTORY.md` and OQ-23.

<a id="adr-029"></a>

## ADR-029 — Physical CSS direction properties are banned by lint

**Context.** CDC v0.1 §12.1 requires full RTL. Every component built after Part 4 must be
RTL-safe by construction, and "remember to use logical properties" is not a mechanism.

**Decision.** `margin-inline-start` not `margin-left`; `padding-inline` not
`padding-left/right`; `inset-inline-start` not `left`; `text-align: start` not `left`. The
lint configuration rejects the physical forms, in CSS and in Tailwind class names alike.
Exceptions require an inline justification comment.

**Consequences.** RTL correctness is enforced at commit time rather than discovered in an
Arabic screenshot. Genuinely physical cases — a shadow offset, a hero decoration — are
explicit and reviewable.

**Status.** ACCEPTED.

<a id="adr-030"></a>

## ADR-030 — Status is never communicated by colour alone

**Context.** CDC v0.1 §7.1 and §13 require accessible level and status indicators; WCAG 2.1 AA
(§18) forbids colour as the only carrier of meaning. The prototype signals vacancy with red
text alone.

**Decision.** Every status carries a text label or an icon in addition to its colour. A vacant
post reads "Responsable VACANT" with a warning icon; a validated item reads "Validée". The
`StatusBadge` component makes the label mandatory in its API — there is no colour-only variant
to reach for.

**Consequences.** Usable by colour-blind readers and in monochrome print, which matters for a
document a production director may pin to a wall.

**Status.** ACCEPTED.

<a id="adr-031"></a>

## ADR-031 — Navigation is filtered server-side by permission

**Context.** CDC v0.1 §3 rights model; Part 5 requires a `VIEWER` not to see routes they
cannot open.

**Decision.** The navigation tree is computed on the server from the signed-in user's
permissions. Entries they cannot open are not sent to the browser.

**Consequences.** Hidden links are a UX nicety on top of the real boundary, never instead of
it: the route itself independently calls `can()` (ADR-020), so a guessed URL is rejected with
403 whether or not the link was rendered.

**Status.** ACCEPTED.

<a id="adr-032"></a>

## ADR-032 — Western Arabic numerals in the Arabic locale

**Context.** Arabic can render digits as Western Arabic (0–9) or Eastern Arabic (٠–٩). The
client has expressed no preference. Algerian industrial and administrative practice
predominantly uses Western Arabic numerals, and the platform's data includes document codes
(`EN-012-DRH`), extensions (`Poste 121`) and KPI figures that also appear in French.

**Decision.** Western Arabic numerals in `ar`, configured in one place in the formatting
layer.

**Consequences.** A phone extension or a document code reads identically in all three locales,
which is what a directory is for. If the client prefers Eastern Arabic numerals, it is a
formatter configuration change, not a content change.

**Status.** ASSUMPTION — flagged as OQ-24.
