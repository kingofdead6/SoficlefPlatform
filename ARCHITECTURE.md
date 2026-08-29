# How this codebase is put together

A map of the platform: what each file does, where it lives, and what depends on what.

For *what the product does*, read [USER-GUIDE.md](USER-GUIDE.md). For *why* particular
choices were made, read [DECISIONS.md](DECISIONS.md). This file answers a third question —
where do I go to change X.

---

## 1. The one rule that explains the shape

Dependencies point **inwards**, and never back out:

```
  app/  ──▶  application/  ──▶  domain/
   │              │
   │              ▼
   └──────▶  infrastructure/
```

- **`domain/`** imports nothing. No database, no React, no framework. Pure rules.
- **`application/`** imports `domain` and `infrastructure`. It orchestrates a use case.
- **`infrastructure/`** talks to the outside world: Postgres, cookies, hashing, files.
- **`app/`** is the web layer: routes, pages, server actions, API handlers.

Why it matters in practice: **`domain/` is testable without standing anything up.** The
unit and security suites — 411 assertions — run in about a second because they never touch a
database. The moment a rule needs `prisma`, it stops being a domain rule and moves outward.

---

## 2. Directory map

| Path | What lives there |
| --- | --- |
| `src/domain/` | Business rules, as pure functions (17 files) |
| `src/application/` | Use cases: read this, write that, with permissions applied (23) |
| `src/infrastructure/` | Database, auth, sessions, settings, storage (14) |
| `src/app/` | Routes, pages, server actions, API handlers (109) |
| `src/components/` | React components, grouped by feature (62) |
| `src/lib/` | Small shared helpers: env, formatting, motion, class names (6) |
| `src/i18n/` | Locale config, routing, request resolution (4) |
| `src/styles/` | Design tokens and global CSS (2) |
| `prisma/` | Schema (67 models), 13 migrations, the seed |
| `seed/` | Data extracted from the client's HTML prototype, with zod schemas |
| `tests/` | Unit, security, API and end-to-end suites (26 files) |
| `messages/` | `fr.json`, `ar.json`, `en.json` — 225 keys each, kept in lockstep |
| `docs/` | This file, the decisions log, open questions, scope, user guide |
| `scripts/` | `check-messages.ts` — fails the build if a locale is missing a key |

---

## 3. `src/domain/` — the rules

Nothing here imports a framework. Each file answers one question.

| File | The question it answers |
| --- | --- |
| **`auth/authorization.ts`** | **May this user do this?** The single decision point. |
| `auth/permissions.ts` | Which permission does each role hold? (the table `can()` reads) |
| `auth/roles.ts` | The four roles: ADMIN, HR, MANAGER, EMPLOYEE |
| `auth/password-policy.ts` | Is this password acceptable? |
| `auth/session-rules.ts` | Is this session still valid; should it be renewed? |
| `navigation/navigation.ts` | The 58 routes, their groups, and the permission each needs |
| `onboarding/task.ts` | Task states, which transitions are legal, what counts as late |
| `manager/alerts.ts` | What reaches a manager as an alert, and in what order |
| `survey/satisfaction.ts` | Turning answers into a score |
| `competency/gap.ts` | Expected level minus acquired level |
| `training/quiz.ts` | Scoring an attempt against the pass mark |
| `workflow/job-description.ts` | The validation circuit's legal transitions |
| `assistant/agents.ts` | The five agents, what each may read, the citation rule |
| `admin/connectors.ts` | The six external systems and what state each is in |
| `audit/actions.ts` | The list of auditable actions |
| `hr/indicators.ts` | The Module 10 KPI definitions |
| `kaizen/status.ts` | Kaizen action states |

### The file to understand first

**`domain/auth/authorization.ts`** is the heart of the platform. Every route, every server
action and every repository read goes through it:

```ts
can(user, 'update', 'assignment', { organizationUnitId: 'abc' })
```

Two axes decide the answer:

1. **Permission** — does the role hold `assignment:update`? (from `permissions.ts`)
2. **Scope** — GLOBAL sees everything, ORGANIZATION_UNIT sees its own structures, SELF sees
   only its own rows.

`canAnyScope()` is the variant for shared reference content — a training course belongs to
no unit and no person, so there is no target to name.

---

## 4. `src/application/` — the use cases

Each file takes an `AuthenticatedUser`, applies the scope **in the SQL query**, and returns
data. That is the rule worth internalising: **a manager's query never returns rows they then
have to be prevented from seeing.**

### The most important file

**`application/shared/mutate.ts`** — every write in the platform goes through it:

```
authenticate → re-validate with Zod → authorize against the resolved target
             → run and write the audit row, in one transaction
```

Four things that must never be forgotten, forgotten in one place instead of sixteen. A new
server action cannot skip one by accident.

### By feature

| Area | Files |
| --- | --- |
| Auth | `auth/login.ts`, `auth/logout.ts`, `auth/assign-role.ts` |
| Employee space | `me/overview.ts`, `me/task-detail.ts` |
| Manager | `manager/team.ts` |
| HR | `hr/dashboard.ts`, `hr/directory.ts` |
| Admin | `admin/console.ts`, `admin/directory.ts` |
| Onboarding | `onboarding/journey.ts` |
| Org model | `organization/assignments.ts`, `organization/parents.ts` |
| Surveys | `survey/rounds.ts` |
| Training | `training/catalogue.ts` |
| Competencies | `competency/matrix.ts` |
| Dashboards | `dashboard/kpis.ts` |
| Navigation | `navigation/build-navigation.ts` |
| Assistant | `assistant/orientation.ts` |
| Public pages | `public/presentation.ts` |

---

## 5. `src/infrastructure/` — the outside world

| File | Purpose |
| --- | --- |
| `db/client.ts` | The Prisma client, one instance |
| `auth/current-user.ts` | Resolves the signed-in user; cached per request |
| `auth/password.ts` | Argon2id hashing |
| `auth/session-token.ts` | Cookie handling; only the token's hash is stored |
| `repositories/user-repository.ts` | Loads a user with roles and scopes resolved |
| `repositories/position-repository.ts` | `getVisibleTree()` — the org chart, scoped in SQL |
| `repositories/organization-unit-repository.ts` | Structures, with descendant resolution |
| `repositories/session-repository.ts` | Session lookup and revocation |
| `repositories/audit-repository.ts` | Append-only audit writes |
| `security/csrf.ts` | CSRF token issue and check |
| `security/rate-limit.ts` | Login attempt throttling |
| `settings/app-settings.ts` | Administrable values, clamped |
| `storage/file-storage.ts` | File storage — **unwired**, awaiting OQ-14/OQ-15 |
| `http/route-handler.ts` | Shared wrapper for API routes |

---

## 6. `src/app/` — the web layer

### Route groups

```
src/app/[locale]/
├── layout.tsx            root: locale, fonts, direction
├── login/                sign-in
├── pending/              an account with no post lands here
├── (public)/             no session needed: /, /entreprise, /strategie, /carrieres
├── (app)/                everything behind a session
│   ├── layout.tsx        THE GUARD — see below
│   ├── app/me/           13 routes: the new arrival
│   ├── app/manager/      11 routes: the manager
│   ├── app/hr/           19 routes: HR
│   ├── admin/            12 routes: the administrator
│   └── (16 content routes: company, strategy, qms, hse, contacts…)
└── dev/                  design-system pages, off in production
```

### The guard

**`src/app/[locale]/(app)/layout.tsx`** is the boundary. Three things, in order:

1. No session → redirect to `/login`.
2. `lifecycleState === 'PENDING_ASSIGNMENT'` → redirect to `/pending`.
3. Route not resolvable, or not permitted → `notFound()`.

Step 3 **refuses rather than skips** when a route resolves to no nav entry. `navItemGoverning()`
walks up to the closest ancestor so `/app/hr/employees/<uuid>` inherits the employees
permission — matching whole segments, so `/app/hr/employees-archive` cannot inherit by
string overlap.

Each page then re-checks its own permission. The sidebar hiding a link is a courtesy; the
page is the boundary.

### Server actions — `src/app/actions/`

16 files, named by what they change: `assignments.ts`, `evaluations.ts`, `onboarding.ts`,
`survey.ts`, `training.ts`, `remarks.ts`, and so on.

Fifteen of them call `mutate()`. **`auth.ts` is the one exception**, and necessarily so:
sign-in cannot authorize an already-authenticated user, because there isn't one yet. It
delegates to `application/auth/login.ts`, which does its own rate-limiting, password
verification and audit write. If you add an action, it goes through `mutate()`.

### API routes — `src/app/api/v1/`

Seven handlers, for things a browser form cannot do: login, logout, session check,
organization-unit CRUD, role grants, remarks export.

---

## 7. `src/components/` — the interface

| Directory | Contents |
| --- | --- |
| **`ui/`** (14) | The primitives: `Card`, `KpiTile`, `DataTable`, `StatusBadge`, `Tabs`, `ProgressBar`, `Timeline`, `Modal`, `Drawer`, `Stepper`, `SectionTitle`, `EmptyState`, `LevelMeter` |
| **`shell/`** (11) | The frame: `AppShell`, `SidebarNav`, `NavIcon`, `TopBarTitle`, `UserMenu`, `LocaleSwitcher`, `Brand`, `MobileNav`, `Breadcrumbs`, `DayBadge`, `SignOutButton` |
| **`motion/`** (7) | Page transitions, stagger, count-up — all honouring `prefers-reduced-motion` |
| `me/`, `manager/`, `hr/`, `admin/` | Role-specific: progress ring, position tree, assignment forms, evaluation form |
| `onboarding/`, `survey/`, `training/`, `competency/`, `organization/`, `remarks/`, `kaizen/`, `job-description/`, `notifications/`, `public/`, `auth/`, `i18n/` | Feature components |

Everything imports from `@/components/ui` rather than restyling a `<div>`, which is what
keeps a card on the HR dashboard identical to one on the admin console.

---

## 8. The data model

`prisma/schema.prisma` — 67 models. The ones that carry the platform:

### The org model — three tables, deliberately separate

| Table | Owner | Holds |
| --- | --- | --- |
| `user` | Admin | Identity, credentials, role(s), account state |
| `position` | Admin (structure) + HR (content) | The **seat**: title, mission, unit, `parentPositionId` |
| `assignment` | HR | **Who holds which seat, over which dates** |

The separation is the point: a person changes job without the chart being rebuilt, and
"who held this post in March" stays answerable. Assignments are **never deleted** — a
reassignment closes the row with an end date. A partial unique index enforces at most one
*open* assignment per person.

### Two axes on an account, not one

- `status` — ACTIVE / SUSPENDED / DISABLED: *may this account be used at all?*
- `lifecycleState` — PENDING_ASSIGNMENT / ASSIGNED / ARCHIVED: *has HR placed this person?*

Collapsing them would make a suspended-but-assigned employee unrepresentable.

### The rest

`OnboardingTemplate` → `OnboardingMilestone` → `OnboardingInstance` → `OnboardingTaskCompletion`
· `SurveyRound` / `SurveyResponse` · `TrainingModule` / `TrainingQuestion` / `TrainingAttempt`
· `Evaluation` (D+30 / D+90 / probation end) · `ManagerTask` · `Competency` / `Assessment`
· `Document` / `DocumentAcknowledgement` / `PersonalFile` · `AccountRequest` · `AuditLog`
· `AppSetting` · `Session` · `Role` / `Permission` / `Scope`

---

## 9. Seed data

`prisma/seed.ts` builds a working platform from `seed/data/*.json` — 14 files extracted from
the client's HTML prototype, each validated by a zod schema in `seed/schemas/`.

**Eight accounts**, all `@soficlef.local`:

| Account | Role |
| --- | --- |
| `admin@` | ADMIN |
| `rh@` | HR |
| `manager@` | MANAGER (scoped to Fabrication) |
| `nouveau.1@` … `nouveau.4@` | EMPLOYEE, staggered at D+5 / D+20 / D+45 / D+95 |
| `attente@` | EMPLOYEE, deliberately **unplaced** |

The stagger matters: one recruit on day one leaves the checklist, the surveys and the
probation reporting each showing a single empty state, demonstrating none of them.

The seed is **idempotent** and prunes accounts and roles the code no longer knows about.

---

## 10. Tests

| Suite | What it covers | Needs a database? |
| --- | --- | --- |
| `tests/unit/` (12) | Domain rules, navigation, settings, i18n, tokens | No |
| `tests/security/` (2) | The authorization matrix, exhaustively | No |
| `tests/api/` (3) | Permissions over the wire | Yes — `TEST_DATABASE_URL` |
| `tests/e2e/` (3) | Browser flows: shell, public pages, RTL | Yes |

**411 tests** currently pass. The API and E2E suites refuse to run unless `TEST_DATABASE_URL`
points at a *different* database from `DATABASE_URL` — they reseed, which would reset every
password on a working database.

---

## 11. How a request flows

Following `/fr/app/manager/recruits/<id>` end to end:

```
1. src/proxy.ts                     negotiates locale, forwards the path as a header
2. app/[locale]/layout.tsx          sets lang and direction
3. app/[locale]/(app)/layout.tsx    session? placed? permitted? — else redirect or 404
4. .../manager/recruits/[id]/page.tsx
      └─ navItemByHref + canOpen    the page re-checks its own permission
      └─ loadRecruit(user, id)      application layer
            └─ perimeterOf(user)    domain: scopeFilterFor()
            └─ prisma.user.findFirst({ where: { id, ...perimeter } })
                                    ↑ the scope is IN the query
5. Renders with components/ui primitives
```

Out of perimeter is **not found**, never found-and-refused: a 403 would confirm the row
exists.

---

## 12. Where to make a change

| To change… | Go to |
| --- | --- |
| What a role may do | `src/domain/auth/permissions.ts` |
| The routes, or which permission one needs | `src/domain/navigation/navigation.ts` |
| A page's content | `src/app/[locale]/(app)/…/page.tsx` |
| How something is read | `src/application/<feature>/…` |
| How something is written | `src/app/actions/<feature>.ts` |
| The data model | `prisma/schema.prisma` + a migration |
| Colours, spacing, radii | `src/styles/tokens.css` |
| Any user-visible text | `messages/{fr,ar,en}.json` — **all three** |
| A shared component | `src/components/ui/` |

---

## 13. Conventions worth knowing

- **Scope is enforced in the query**, never by filtering afterwards.
- **Every mutation goes through `mutate()`** — nothing writes without an audit row. The
  single exception is sign-in, which has no authenticated user to authorize.
- **Nothing is hard-deleted** where history matters: archived, or closed with a date.
- **All three locales move together** — `check-messages.ts` fails the build otherwise.
- **Logical CSS properties** (`ps-4`, not `pl-4`) so Arabic RTL mirrors for free.
- **Status is never colour alone** — a badge always carries a label.
- **No secrets in the repo**; every value comes from `.env`, parsed once in `lib/env.ts`.
- **No LLM provider is called anywhere.** The assistant structure exists; generation does
  not (see DECISIONS.md, ADR-003).

---

## 14. Commands

```bash
npm run dev              # development server
npm run build            # production build
npm run db:seed          # seed (idempotent)
npx prisma migrate deploy
npx vitest run           # 411 tests, ~1s
npx tsc --noEmit         # typecheck
npx eslint .             # lint
npx tsx scripts/check-messages.ts   # locale parity
```
