# SOFICLEF platform — audit against the target architecture

**Date:** 2026-08-26 · **Branch:** `feat/platform-modules` · **Status:** Phase 1 complete, awaiting approval

This audits the existing build against the target architecture (three-table org model,
two-step provisioning chain, role-prefixed routes, five AI agents, mock↔production
toggle). Findings are stated with file paths and, where a claim is about behaviour rather
than code, with the probe that established it.

---

## 1. Stack inventory

| Layer | Target permits | Actually used | Divergence |
| --- | --- | --- | --- |
| Front end | React / Next.js | Next.js 16 App Router, React 19 | none |
| Styling | Tailwind **or** Bootstrap | Tailwind 4 + Radix primitives | none — one side of the "or" was chosen |
| Back end | Node.js **or** ASP.NET Core | Node.js (Next server actions + route handlers) | none |
| Database | PostgreSQL **or** SQL Server | PostgreSQL 16 (Neon), Prisma 7 | none |
| Auth | Microsoft Entra ID / AD | Local: Argon2id, server-side sessions, RBAC + scope | **diverges** — see §6 |
| AI | Azure OpenAI / Copilot Studio / AI Foundry | none installed | **diverges** — see §7 |
| i18n | FR / EN / AR | next-intl, three locales, RTL | none |

Nothing in the stack needs replacing. Both divergences are blocked on client-side
prerequisites rather than on engineering.

---

## 2. Route coverage

Routes today are **flat and locale-prefixed** (`/fr/onboarding`), filtered per role by one
nav table (`src/domain/navigation/navigation.ts`), not organised under `/app/me`,
`/app/manager`, `/app/hr`. See §10 Q1 — this is an open question, not an oversight.

### Exists and correct

| Target | Today | File |
| --- | --- | --- |
| `/login` | `/{locale}/login` | `src/app/[locale]/login/page.tsx` |
| `/app/me/journey` | `/{locale}/onboarding` | `(app)/onboarding/page.tsx` |
| `/app/me/training` | `/{locale}/training` | `(app)/training/page.tsx` |
| `/app/me/training/[moduleId]` | `/{locale}/training?module=CODE` | same file |
| `/app/me/surveys` | `/{locale}/surveys` | `(app)/surveys/page.tsx` |
| `/app/me/position` | `/{locale}/job-description` | `(app)/job-description/page.tsx` |
| `/app/me/documents` | `/{locale}/documents` | `(app)/documents/page.tsx` |
| `/app/hr` (dashboard) | `/{locale}/dashboard` | `(app)/dashboard/page.tsx` — role-aware, one page serves all |
| `/app/hr/organigram` | `/{locale}/organization` | `(app)/organization/page.tsx` |
| `/app/hr/analytics` | `/{locale}/dashboard` (HR block) | `application/dashboard/kpis.ts` |
| `/admin/users`, `/admin/roles`, `/admin/audit` | `/{locale}/admin` (tabs) | `(app)/admin/page.tsx` |
| — (not in target) | `/{locale}/competencies` | job↔competency matrix, CDC v0.1 §7 |

Plus a public tier the target does not mention but which is correct to keep: `/{locale}`,
`/entreprise`, `/strategie`, `/carrieres`.

### Incomplete

| Target | Today | What is wrong |
| --- | --- | --- |
| `/app/me` dashboard | `/{locale}/dashboard` | Shared dashboard; no progress ring, no D-Day countdown, no phase badge |
| `/app/me/journey/[taskId]` | inline row on `/onboarding` | No task detail page: no attachments, no e-signature, no comment thread |
| `/app/me/organigram` | `/{locale}/organization` | Shows the scope-filtered unit tree, not a tree centred on the user with peers |
| `/app/hr/documents` | `/{locale}/documents` | Listing only; no upload, no versioning, no per-role visibility, no acknowledgment tracking |
| `/app/hr/training` | `/{locale}/training` | Read-only catalogue; no authoring, no quiz builder |
| `/app/hr/surveys` | `/{locale}/surveys` | Answering and aggregate work; milestones and questions are fixed constants, not configurable |
| `/admin/*` | `/{locale}/admin` | Users, roles, audit only |

### Missing entirely

`/pending` · `/onboarding/welcome` wizard · `/app/me/team` · `/app/me/files` ·
`/app/me/training/certificates` · `/app/me/assistant` · all of `/app/manager/*` (dashboard,
recruits, recruit detail, task assign, evaluations, interview prep, team, reports,
assistant) · `/app/hr/employees*` (directory, unassigned queue, assignment form, request
account) · `/app/hr/positions` · `/app/hr/templates` + builder · `/app/hr/surveys/results` ·
`/app/hr/analytics/reports` · `/app/hr/alerts` · `/app/hr/ai-knowledge` ·
`/admin/users/provisioning` · `/admin/organization` · `/admin/integrations` · `/admin/ai` ·
`/admin/security` · `/admin/backups` · `/admin/gdpr` · `/admin/settings`

---

## 3. Delete candidates — **approval required, nothing removed yet**

| Item | File | References | Why |
| --- | --- | --- | --- |
| `OrgChartNode` model | `prisma/schema.prisma` | **1 usage** — `(app)/management/page.tsx:107` | A second org tree parallel to `OrganizationUnit.parentId`. `/organization` queries units directly; only `/management` reads this one. **Not a safe delete today** — it would be superseded by `Position.parentPositionId`, so retire it *after* the migration re-points `/management`, not before. |
| `ModulePlaceholder` | `src/components/shell/page-shell.tsx` | **0 usages** | Dead since the content pages were built. See §4 — its permission check should be *harvested*, not discarded. |
| `SeedContent` model | `prisma/schema.prisma` | Written by seed; read by nothing | Legacy generic JSON store, superseded by the per-domain tables. |

Recommendation: harvest the check from `ModulePlaceholder` before deleting it.

Verified by grep, excluding the generated Prisma client (`src/infrastructure/db/generated`),
which mentions every model by construction: `ModulePlaceholder` 0 usages, `SeedContent` 0,
`OrgChartNode` 1. My first pass counted the generated client and would have proposed
deleting a model that `/management` still reads — corrected above.

---

## 4. RBAC findings

### Correction to my own first reading — the boundary holds

Nine of nineteen authenticated pages carry no permission re-check: `company`, `contacts`,
`documents`, `hse`, `management`, `qms`, `recruitment`, `strategy`, `welcome`. Each queries
Prisma with no `getCurrentUser`, no `can()`, no `notFound()`.

I expected this to be exploitable and **probed it rather than assuming**. It is not:

```
── TECH_ADMIN (holds no document:read, no job:read) ──
  /fr/qms              nav:no  http:404 → refused
  /fr/hse              nav:no  http:404 → refused
  /fr/documents        nav:no  http:404 → refused
  /fr/recruitment      nav:no  http:404 → refused
  /fr/job-description  nav:no  http:404 → refused
  … 11 of 11 refused
```

Refused on direct URL entry **and** on genuine client-side link navigation. The `(app)`
layout gate is doing its job: the proxy matcher `/((?!api|_next|_vercel|.*\..*).*)` covers
every page route, so `PATHNAME_HEADER` is always present, and all 19 hrefs resolve in
`NAV_ITEMS`.

**Severity: defence-in-depth gap, not an active vulnerability.** Two latent conditions make
it worth fixing anyway:

1. `if (item && !canOpen(user, item))` — when `navItemByHref()` returns `undefined` the
   check is **skipped, not failed**. Today every route resolves; the first nested route
   (`/organization/[id]`) would not, because the lookup is exact-match
   (`NAV_ITEMS.find(i => i.href === href)`).
2. The nine pages have no second line of defence if the layout is ever bypassed or
   refactored.

### Correct today

- One decision point: `can()` in `src/domain/auth/authorization.ts`. Status checked before
  permissions, so a suspended account fails everything.
- Scope enforced **in SQL**, not the UI (ADR-021) — `organization-unit-repository.ts`,
  `journey.ts` (summaries), `rounds.ts`, `parents.ts`.
- Out-of-scope reads answer **404, not 403**, so ids cannot be used to map the org.
- Every server action passes through `mutate()`: authenticate → Zod re-validate → authorize
  against a resolved target → run and audit **in one transaction**.
- Self-assignment of a role is refused **and audited** (`canAssignRole`).
- Roles are already many-to-many (`UserRole` → `Role` × `Scope`). The target's "migrate off
  a single role string" **does not apply**.

### Genuine holes

| # | Where | Issue |
| --- | --- | --- |
| R1 | `application/onboarding/journey.ts` `loadJourney` | For `scope.kind === 'units'` there is **no unit predicate** — `options.subjectUserId` is used as given. A manager could read a journey outside their perimeter by id. `loadJourneySummaries` does it correctly; copy that. |
| R2 | `api/v1/remarks/export/route.ts` | `units` scope falls to `{}` — unfiltered. Currently harmless (no role holds `remark:read` with unit scope) but wrong by construction. |
| R3 | `(app)/layout.tsx:46` | Unresolvable route ⇒ check skipped. Should refuse. |
| R4 | nine pages | No page-level re-check. |
| R5 | `application/navigation/build-navigation.ts` + `application/training/catalogue.ts` | **Found by the verification probe, not by reading.** The sidebar asked "do you hold this permission *anywhere*"; the training loader asked "do you hold it *on your own row*" (`{ ownerUserId: user.id }`). Those disagree for every unit-scoped role, so the menu offered HR, MANAGER, HEAD_CE and BIZ_ADMIN_CE a training catalogue that then threw `training:read` and rendered an empty state. Self-inflicted: the `ownerUserId` target was my earlier fix for the opposite symptom on EMPLOYEE. |

**R5 resolution.** Neither question was right on its own, because the training catalogue is
*shared reference content* — the modules belong to no unit and to no person; only the
progress shown against them is the caller's. `canAnyScope()` / `assertCanAnyScope()` now
state that case once in `domain/auth/authorization.ts`, and both the navigation and the
loader ask it, so the sidebar and the boundary cannot drift apart again. `can()` with a
target remains mandatory for anything a person or a unit actually owns — the helper waives
the *target*, never the permission, and still refuses a suspended account.

**Verification.** 133 route/role combinations (seven test accounts × nineteen routes),
attempted by direct URL against a production build: every refused route answers 404, every
offered route opens, **0 leaks**. The three new assertions in `tests/unit/navigation.test.ts`
were mutation-tested — reintroducing the target makes them fail.

---

## 5. Data model diff

| Target | Today | Gap |
| --- | --- | --- |
| `users` + state `CREATED_PENDING_ASSIGNMENT`/`ASSIGNED`/`ARCHIVED` | `User` + `UserStatus{ACTIVE,SUSPENDED,DISABLED}` | Different axis. `UserStatus` answers "may this account be used"; the target's answers "has HR placed this person". **Both are needed** — collapsing them makes a suspended-but-assigned user unrepresentable. |
| `positions` with `parent_position_id` | Tree on `OrganizationUnit.parentId`; `Job` has no self-relation | No position tree. `Job` is the post but hierarchy lives one level up on the unit. |
| `assignments` (user × position × dates) | **Absent.** Nearest: `UserRole` (RBAC only, `grantedAt`, no end date), `OnboardingInstance` (user × template × startDate), free-text `User.positionTitleFr` + `managerId` | Nothing joins a person to a post over a date range, so turnover and reassign-without-rebuilding cannot work. |

### Migration

```
+ enum LifecycleState { PENDING_ASSIGNMENT, ASSIGNED, ARCHIVED }
+ User.lifecycleState  LifecycleState @default(ASSIGNED)   // existing rows are placed
+ User.archivedAt      DateTime?

+ model Position {
+   id, code @unique, titleFr, missionFr?
+   organizationUnitId -> OrganizationUnit     // RBAC scope anchor, unchanged
+   parentPositionId   -> Position (self)      // the reporting tree
+   requiredSkills Json?, assignedEquipment Json?
+   defaultTemplateId  -> OnboardingTemplate?
+   isVacant Boolean, archivedAt DateTime?
+ }

+ model Assignment {
+   id, userId -> User, positionId -> Position
+   startDate, endDate DateTime?               // null = current; never hard-deleted
+   managerOverrideId -> User?
+   templateId -> OnboardingTemplate?
+   @@index([userId, endDate]) @@index([positionId, endDate])
+ }
```

`Job` is **migrated into** `Position` (it already carries `code`, `titleFr`,
`organizationUnitId`, `isVacant`) rather than duplicated — ground rule 3. Backfill
`Assignment` from `User.managerId` + `positionTitleFr` + existing `OnboardingInstance` rows.
`OrganizationUnit` stays as the scope anchor: every `can()` call resolves against it, and
moving that would touch the whole security model for no gain.

---

## 6. Provisioning chain

**Not implemented.** Today one admin screen (`/admin`) both creates accounts and grants
roles; HR has no account-related action at all; there is no lifecycle state and no
`/pending`.

| Rule | Status |
| --- | --- |
| SI creates, sets email/phone/platform roles | Partial — `/admin` creates and grants |
| HR assigns position, department, manager, hire date, template | **Missing** |
| HR cannot create or delete accounts | Holds today, by absence rather than by rule |
| Admin cannot assign position/manager/path | Holds today, by absence |
| No path before HR assignment | **Not enforced** — `OnboardingInstance` can be created independently |
| State gates routing server-side | **Missing** |

Entra ID answers OQ-13 (the target identity system is now known) but needs a tenant, an app
registration and IT-issued credentials that do not exist. Auth sits behind one module
(ADR-011), so OIDC drops in without touching call sites.

---

## 7. AI agents

**None of the five exist.** A repo-wide grep for `openai|anthropic|azure|llm|rag|assistant|
copilot|embedding` returns one hit, and it is the comment in
`src/domain/navigation/navigation.ts` recording the deliberate absence. No AI SDK in
`package.json`, no vector column, no `pgvector`.

This is ADR-003, not an oversight: CDC v0.1 §22 forbids MVP dependence on an AI provider.
Neither requirement the brief flags as often-missed is implemented — no source citation, no
org-tree-aware contact answers — because there is nothing to implement them in.

Resolution: build the structure with no provider calls, which is what the target's own
"Plug & Play" clause asks for.

---

## 8. Mock mode

**Seed data is already isolated** — `seed/data/*.json` → zod schemas → `prisma/seed.ts` →
Postgres. No file under `src/` imports from `seed/`. There is no business data hardcoded in
components; what looks like it is enum→label maps and DataTable column descriptors.

**The connector indirection is missing.** Every page calls `prisma` directly; there is no
interface with mock and production implementations, no toggle, no "Demo data" badge. The
nearest analogue is the per-row `TrainingModule.isPlaceholder`, which the training UI does
surface.

Seed coverage gaps against the target: one division only, no vacant position as a node, one
user with two roles (DJAOUDI — present), no account in `PENDING_ASSIGNMENT`, recruits at two
stages rather than D+5 / D+20 / D+45 / D+95.

---

## 9. Prioritized fix plan

**(a) Security — defence in depth.** Effort: small.
R3 layout refuses unresolvable routes · R4 re-check on nine pages · R1 `loadJourney` unit
predicate · R2 remarks export · API tests over the wire for each.

**(b) Structural — cheaper now than later.** Effort: large.
`Position` + `Assignment` + `Job` migration and backfill · `lifecycleState` · connector
layer + Demo-data badge · seed coverage.

**(c) Missing features.** Effort: large, sequenced.
Provisioning chain and `/pending` · `getVisibleTree` + org-chart depth cap · manager surface
· HR employee/assignment surface · template builder · document upload (**blocked on
OQ-14/OQ-15**) · admin console · AI agent structure.

**(d) Cosmetic.** Effort: small.
`/organization` hardcodes French copy instead of using next-intl · `OrgTree` indent
accumulates unboundedly with no depth cap · `DISABLED` status has no UI path.

---

## 10. Open questions

**Q1 — Route prefixes.** The target wants `/app/me`, `/app/manager`, `/app/hr`. Today routes
are flat and filtered per role by one nav table. Renaming 19 routes is churn with no security
benefit: the boundary is `can()`, not the URL, and one role-aware dashboard already serves
what the target splits three ways. **Recommend keeping flat routes.** Confirm?

**Q2 — Two dashboards or one?** The target gives each role its own. Today one page renders
per-role blocks. Splitting duplicates the scope logic three times.

**Q3 — `UserStatus` vs lifecycle.** Recommend keeping both as orthogonal axes (decided: add
alongside). Recorded here because it diverges from the target's single field.

**Q4 — Entra ID timing.** Needs a tenant. Build the OIDC adapter unwired now, or wait?

**Q5 — Document storage.** OQ-14/OQ-15 have been open since Part 12. Upload, versioning,
`/app/me/files` and acknowledgment tracking all depend on the answer.

**Q6 — `positionTitleFr` after migration.** Once `Assignment` exists, the free-text fields on
`User` (`directionFr`, `serviceFr`, `positionTitleFr`) become a second source of truth.
Recommend deriving them from the active assignment and dropping the columns — confirm.


---

## 11. Execution log — group (b), positions and assignments

### The rename, not a rewrite

`Job` already *was* a position: code, title, unit, vacancy. It was renamed in place
(`ALTER TABLE "job" RENAME TO "position"`), so the existing row, its job description and
its twelve competency links survived untouched — verified by row count before and after.
`parentPositionId`, `missionFr`, `order`, `occupancy` and `occupancyFr` were added; nothing
was dropped and recreated.

`OrgChartNode` is now retired, but **not** as the redundant second tree the audit first
called it. Reading its seed data showed its rows were *posts* — `labelFr` held a person's
name where the seat was filled and a post title where it was not. That is precisely the
conflation `Position` + `Assignment` exists to undo, so its five rows were migrated into
`position` (title from `roleFr` when occupied, from `labelFr` when vacant) rather than
discarded. This corrects the delete-list entry in §3: it was not dead weight, it was the
right model under the wrong name.

### What the verification caught

Three defects, none of them found by reading the code:

1. **Duplicate seats.** The org chart and the employee records describe the same posts from
   two source files, and keying on a slugified code produced a second, empty copy of every
   shared title — three "Directeur de Production" rows at the worst point. Both seeding
   passes now reconcile on title first. One orphan row from the buggy run was deleted after
   confirming it had no assignment, no children, no competencies, no template and no job
   description.
2. **A flat chart.** Fourteen of seventeen posts had `parentPositionId = NULL`, so the
   peers clause (`parentPositionId IS NOT DISTINCT FROM NULL`) matched every unparented
   post in the company: a collaborator "saw" fifteen posts instead of a window. The demo
   cast now carries a `reportsToEmail` reporting line, wired in a second pass once every
   seat exists. The collaborator now sees five.
3. **The pending account reached everything.** `lifecycleState` existed as a column but
   nothing enforced it, so an unplaced account opened seventeen routes. `/pending` now
   exists outside the `(app)` route group, the app layout redirects `PENDING_ASSIGNMENT`
   there, and `/pending` redirects an assigned user back — neither direction loops.

### `getVisibleTree`

In `infrastructure/repositories/position-repository.ts`, enforced in the query (ADR-021),
not by fetching the chart and hiding rows. Three audiences: a global reader sees
everything; a manager sees their own sub-tree without depth limit; everybody else gets a
window — *n* levels up, *m* down, peers optional — with the depths read from `AppSetting`
via `infrastructure/settings/app-settings.ts`, clamped, because the value is JSON and an
unbounded depth is an unbounded recursive walk. An unplaced account has no anchor and
therefore sees nothing, which is the same answer the `/pending` gate gives.

### Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint .`, `check-messages` | clean · 177 keys, three locales |
| `vitest run` | 362 passed (13 files) |
| `next build` | compiled, 88 static pages |
| Seed idempotency | three consecutive runs, stable at 17 positions / 15 assignments |
| One open assignment per person | partial unique index refuses a second — asserted live |
| Visible tree | HR 19 · manager 4 · collaborator 5 · unplaced 0 |
| RBAC matrix | 152 route/role combinations (8 accounts × 19 routes) — **0 leaks** |
| Provisioning gate | all 19 app routes → 307 `/pending`; assigned user at `/pending` → 307 `/dashboard` |


---

## 12. Execution log — group (c), the provisioning chain and the assistant

### Separation of duties, enforced rather than described

The chain has two steps and two owners: SI creates the account (`/admin`, `user:create`),
HR gives it a post (`/hr`, `assignment:create`). Neither role can do both, so no single
person can put a working account into the platform.

Two new resources carry this: `position` (administered by BIZ_ADMIN_CE — defining what a
job *is* is a business act) and `assignment` (HR's). TECH_ADMIN *reads* both and writes
neither.

**A mistake worth recording.** The first cut gave HR `user:read` so the screen could show
names. `/admin` is gated on exactly that permission, so it silently handed HR the whole SI
console — caught by an existing test asserting HR never sees `admin`. HR reads people
through `assignment:read` instead, which is narrower and is what `/hr` is gated on. A
second, related choice followed: `/hr` is gated on `assignment:**create**`, not `read`,
because TECH_ADMIN legitimately reads assignments but must never be offered the screen that
makes one.

### `assignToPosition`

One transaction: close any open assignment, open the new one, flip the seat's occupancy,
set `lifecycleState`, and create the onboarding journey with its four survey rounds through
the existing `ensureRoundsFor`. A half-applied assignment would leave an account `ASSIGNED`
with nowhere to be, or a journey with no surveys — both worse than a clean failure.

Reassignment closes the previous row rather than deleting it. Verified live: the partial
unique index refuses a second open row, the vacated seat returns to `VACANT`, and both
history rows survive.

### The assistant — structure only

ADR-003 holds: no provider call, no key, no vector storage anywhere in this work. What
exists is `domain/assistant/agents.ts` (the five agents, what each may read, and the rule
that an answer either cites a checkable source or admits it found nothing) and Agent 1,
`application/assistant/orientation.ts`, which is real retrieval with no model behind it.

Agent 1 searches **the asker's own visible tree**, not every post — both the correct privacy
behaviour and the better answer, since the nearest relevant person beats the most senior.
Observed in the probe: a collaborator asking about "compétences" is answered from the
contact directory because that post is outside their window, while HR gets the position
rows themselves.

One flaw found by probing and fixed: good answers were padded with weak matches — "responsable
HSE" returned the right person and then every other "Responsable" scoring on that one shared
word. A relevance threshold now keeps only what ties with the best match.

### Also in this group

- Org-tree indentation is capped at four levels; the inset compounded per level and pushed
  labels off a narrow screen, with no horizontal scroll to rescue them.
- `/organization`'s hardcoded French moved to next-intl (186 keys, three locales).

### Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint .`, `check-messages` | clean · 186 keys, three locales |
| `vitest run` | 386 passed (14 files) |
| `next build` | compiled |
| Assignment flow, end to end in the browser | pending account → assigned; seat occupied; journey + J+7/30/60/90 created; audited as `user.assigned` |
| Gate release | after assignment the account reaches `/dashboard`; `/pending` bounces it back out |
| Reassignment | second open row refused; old row closed not deleted; seat re-vacated |
| RBAC matrix | 160 combinations (8 accounts × 20 routes) — **0 leaks**, no JS errors |
| Separation of duties | HR is the only role opening `/hr`; TECH_ADMIN opens `/admin` and is refused `/hr` |


---

## 13. Execution log — group (d), demonstration mode and the docs

### A live credential in a tracked file

`.env.example` carried a real Neon connection string, password included — in the very file
whose header cites ADR-023 ("never put a real credential in this file"). Replaced with the
local placeholder plus a comment showing the `sslmode`/`channel_binding` form managed
Postgres needs, which was the only useful thing the real URL demonstrated. `.env` is
untouched.

**Still outstanding, and it needs your decision:** the credential remains reachable in git
history at `c0739b4`. Removing it there means rewriting history, which is not something to
do unilaterally. **Rotating the Neon password is the faster and safer remedy** and does not
depend on the rewrite.

### Demonstration mode

`DEMO_DATA=true` badges every page with "Données de démonstration". It changes no behaviour
beyond the badge, and that is deliberate: the plan's mock↔production connector would mean a
second data path to keep correct, when the actual risk is a seeded person being mistaken for
a colleague or a demo figure for a KPI. Saying so on screen addresses that risk; a parallel
implementation would not. Flagged here rather than silently substituted.

### Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint .`, `check-messages` | clean · 187 keys, three locales |
| `vitest run` | 386 passed (14 files) |
| `next build` | compiled |
| Browser sweep | 18 routes × {fr, ar} × {390px, 1280px} — no horizontal overflow, no console errors |
| Demo badge | renders in French and Arabic |

---

## 14. What remains

| Item | Why it is not done |
| --- | --- |
| Document upload | Blocked on OQ-14/OQ-15 — the storage backend is undecided, and picking one is your call, not a default to guess. The library around it is built. |
| Entra ID / OIDC | Needs a tenant that does not exist. Auth sits behind one module, so it drops in without touching call sites. |
| Agents 2–5 | Structure declared, retrieval unimplemented. Agent 1 is the one that works without a model; the others need the generation step ADR-003 defers. |
| `positionTitleFr` on `User` | Redundant with `Assignment → Position.titleFr`, kept with documented precedence because a contract title and a post title are not always the same words (Q6). |
| Route prefixes `/app/me` etc. | Recommended against and flagged as Q1: renaming twenty routes is churn with no security benefit, since the boundary is `can()`, not the URL. Still your call. |
