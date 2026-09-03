# SOFICLEF — Plateforme d'intégration

Onboarding and HR platform for **SOFICLEF SARL** (Si Mustapha, Boumerdès — locks and
locking solutions, ISO 9001:2015): organizational structure, job descriptions,
competencies and the new-hire onboarding journey, in French, English and Arabic (RTL).

**Live**
- App: https://soficlef-platform.vercel.app
- API: https://soficlefplatform.onrender.com/api/v1

## What it does

Four portals, one platform, each scoped to what that role may see and do:

| Portal | Route | For |
| --- | --- | --- |
| New hire | `/app/me` | Onboarding journey, org chart, job description, team, documents, training, surveys, quests from their manager |
| Manager | `/app/manager` | Their direct reports' onboarding, evaluations, probation, calendar, quests, job descriptions, documents |
| HR | `/app/hr` | Employee directory, assignment, positions, probation review queue, templates, documents, training, surveys, analytics, alerts |
| Admin | `/admin` | Accounts, roles, org structure, audit log, backups, security, integrations, AI config, GDPR register |

Plus a public marketing site (home, company, strategy, org chart) that needs no login.

Every account also gets an AI assistant, scoped to what that account can already see:
retrieval always runs first against the platform's own data, and an answer either cites a
real source or says it found nothing — it never invents a SOFICLEF-specific fact. If
retrieval finds nothing, it may answer from general knowledge instead, but that answer is
visibly labelled as such and never presented as platform data.

## Demo accounts

Every account below uses the password **`Soficlef#2026Demo`** (or the value of
`SEED_DEMO_PASSWORD` if the deployment overrides it).

| Email | Role | Portal |
| --- | --- | --- |
| `admin@soficlef.local` | ADMIN | `/admin` |
| `rh@soficlef.local` | HR | `/app/hr` |
| `manager@soficlef.local` | MANAGER | `/app/manager` |
| `employe@soficlef.local` | EMPLOYEE | `/app/me` |

## Architecture

Two deployable pieces, developed and shipped separately:

```
Client/   React 19 + Vite + Tailwind v4 — deployed to Vercel
server/   Express + Prisma 7 + PostgreSQL — deployed to Render
```

```
Client/src/
├── api/         one module per resource, thin fetch wrappers over the shared client
├── auth/        session context, protected-route gating
├── pages/       one file per route, grouped by portal (me/, manager/, hr/, admin/, public/)
├── components/  shared UI — shell (sidebar/topbar), org chart, manager widgets, assistant chat
├── i18n/        react-i18next setup, fr/en/ar catalogues, the language switcher
└── lib/         permissions mirror, nav tree, date/locale helpers, motion presets

server/src/
├── domain/          auth (permissions, scoping), navigation, workflow rules — no framework import
├── application/      use cases: onboarding, assistant, job descriptions, shared mutate() helper
├── infrastructure/   Prisma client, session/auth middleware, Cloudinary, audit log
└── routes/            one Express router per resource, mounted under /api/v1
```

Authorization is **role + scope**, decided in one place (`can()` /
`assertCan()` / `assertCanAnyScope()` in `server/src/domain/auth/authorization.js`) and
re-applied on every route — the client-side nav filter is a courtesy, never the boundary.
Every mutation goes through `application/shared/mutate.js`, which authenticates,
re-validates with Zod, authorizes against the resolved target, runs the change and writes
an audit row in one transaction.

## Requirements

- Node.js 22.x (pinned — Prisma 7's generated client has an ESM interop issue on Node 24)
- PostgreSQL (a Neon connection string works out of the box)

## Getting started

**Server**

```bash
cd server
cp .env.example .env     # fill in DATABASE_URL, AUTH_SESSION_SECRET, APP_URL, CORS_ORIGIN
npm install               # postinstall runs `prisma generate` automatically
npm run db:deploy         # apply migrations
npm run db:seed           # creates the four demo accounts above
npm run dev                # http://localhost:5000
```

**Client**

```bash
cd Client
npm install
npm run dev                # http://localhost:5173
```

The client's API base URL is hardcoded in `Client/api.js`, not read from `.env` — point it
at your local server (`http://localhost:5000/api/v1`) for local development, and back at
the Render URL before deploying.

## Cross-origin auth

Client and server are deployed on different origins (Vercel, Render), so the session
cookie is set with `SameSite=None; Secure` whenever `APP_URL` is `https://` — required for
the cookie to survive a cross-site fetch at all. `CORS_ORIGIN` must match the deployed
client's exact origin (no wildcard is possible with `credentials: true`).

## Languages

French, English and Arabic, switchable from any authenticated page or the public site.
`document.dir` follows the active language, so Arabic renders right-to-left — the app uses
logical CSS properties (`ps-`/`pe-`/`start-`/`end-`) throughout rather than physical
`left`/`right`, and directional glyphs (arrows) mirror with the layout. The three
catalogues (`Client/src/i18n/locales/{fr,en,ar}.json`) are kept in exact key parity.

## Quests

A manager can assign an ad-hoc task ("quest") to any of their direct reports, independent
of the onboarding journey — unlike the onboarding-scoped manager tasks, a quest works for
an already-onboarded employee too. Only the assignee can mark it done.

## Scripts

**server/**

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (`node --watch`) |
| `npm start` | Production server |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (any environment) |
| `npm run db:seed` | Seed roles, permissions and the four demo accounts |

**Client/**

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | oxlint |

## Security notes

- Passwords are hashed with Argon2id; sessions are server-side and revocable.
- Every sensitive mutation writes an audit row (actor, action, entity, before/after) in the
  same transaction as the change.
- An out-of-scope read answers 404 or 403, not a filtered 200 — a hidden UI link is never
  the security boundary.
- No secret lives in the repository. `server/.env.example` documents every server
  variable; the real `server/.env` is git-ignored. The client has no `.env` at all — its
  only configurable value is the API URL in `Client/api.js`.
