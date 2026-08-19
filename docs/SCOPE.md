# SOFICLEF Platform — Reconciled Scope

**Status:** working baseline for Parts 0–5. Every scope decision below is an `ASSUMPTION`
until confirmed by the business sponsor (M. Mostafa, Responsable Structure Compétences &
Emplois). See `DECISIONS.md` for the reasoning, `OPEN-QUESTIONS.md` for what is still unknown.

**Sources reconciled**

| Ref       | Document                                                                         | Nature                                                                                                            |
| --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| CDC v1    | `docs/sources/CDC-v1_Plateforme_SOFICLEF.pdf` — _CDC-SOFICLEF-DRH-2026-001 v1.0_ | Fixed onboarding portal for one person; 8 modules; AI agent with RAG; 4 one-week sprints                          |
| CDC v0.1  | `docs/sources/CDC-v0.1_Competences_Emplois.pdf`                                  | Generic structures / jobs / competencies / onboarding platform; AI explicitly out of MVP; 24 sections; 9–16 weeks |
| Prototype | `seed/source/SOFICLEF_Onboarding_Directeur_Production_.html`                     | Client-validated single-file HTML prototype, 15 pages, French only                                                |

---

## 1. Product definition

The platform is **CDC v0.1's generic Skills & Employment platform**, seeded with **CDC v1's
validated content**, wearing **CDC v1's validated visual identity**.

M. DJAOUDI Farid's onboarding is not a hardcoded portal. It is the **first instance** of a
reusable onboarding template attached to the _Directeur de Production_ job (`EN-012-DRH`)
inside the _Direction de Production_ organizational scope. Everything the prototype shows on
a fixed page becomes an entity that HR can create a second, third and tenth time.

**The prototype is the content source of truth, not a codebase.** Its business content and
its `:root` design tokens are ported; none of its JavaScript is.

## 2. MVP boundary

**In the MVP** (CDC v0.1 §24, cross-checked against CDC v1 §3)

- Secure authentication, 7 role profiles, organizational scope restriction, audit trail
- Organization / structures CRUD with history
- Jobs / positions / versioned job descriptions with a validation workflow
- Competency reference frame, levels, job↔competency matrix, gap computation
- Onboarding templates, instances, tasks, deadlines, validation
- Notification centre and reminders
- Role-aware dashboards, CSV/XLSX exports
- FR / AR / EN with Arabic RTL
- Document library with per-document ACLs
- Responsive UI on the SOFICLEF identity, WCAG 2.1 AA on main flows
- E2E tests on critical paths, deployment documentation

**Deferred to phase 2 — explicitly not dropped**

| Item                                                                       | Source                  | Why deferred                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI agent (RAG, chat, SSE streaming, `pgvector`, embeddings, system prompt) | CDC v1 §4, CDC v0.1 §22 | CDC v0.1 §22 forbids MVP dependency on an AI provider. No business feature may require an LLM to be reachable. The ingestion boundary is designed, nothing is built behind it. |
| SSO / OIDC, MFA                                                            | CDC v0.1 §14            | The existing SOFICLEF identity system is unknown (OQ-13). Auth is structured so OIDC drops in without touching call sites.                                                     |
| SIRH / ERP / BI connectors                                                 | CDC v0.1 §17, §22       | Contract-only; no integration in the MVP.                                                                                                                                      |
| Redis cache / queue, heavy async jobs                                      | CDC v0.1 §14            | Introduced only when an export or notification volume demands it.                                                                                                              |
| Antivirus scanning of uploads                                              | CDC v0.1 §14            | Requires client infrastructure decision (OQ-15).                                                                                                                               |
| E-mail notifications                                                       | CDC v0.1 §9             | In-app is mandatory, e-mail is "recommended"; needs an SMTP relay decision (OQ-15).                                                                                            |

**Out of scope entirely**

- Replacing a full HRIS (payroll, leave, time tracking) — CDC v0.1 §2 is explicit.
- Public-facing website or catalogue features (soficlef.com stays as it is).
- Native mobile applications. Mobile is a responsive-web concern only.

## 3. Module list

| #   | Module                                                                                                              | MVP          | Built in   | Origin                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | --------------------------------- |
| M01 | Authentication, RBAC, scope, audit                                                                                  | Yes          | Part 3     | v0.1 §3, §15; v1 §2.3             |
| M02 | i18n FR/AR/EN + RTL                                                                                                 | Yes          | Part 4     | v0.1 §12; v1 §2.2                 |
| M03 | Application shell, navigation, design system                                                                        | Yes          | Parts 2, 5 | v0.1 §4, §13; v1 §5               |
| M04 | Onboarding content pages (welcome, company, strategy, job description, management, recruitment, QMS, HSE, contacts) | Yes          | Part 6     | v1 §3.1–3.3, §3.6, §3.8; v0.1 §6  |
| M05 | Organization / structures + org chart                                                                               | Yes          | Part 7     | v0.1 §5; v1 §3.4                  |
| M06 | Kaizen / operational-excellence tracking                                                                            | Yes          | Part 8     | v1 §3.5                           |
| M07 | Onboarding engine (templates, instances, tasks, checklist)                                                          | Yes          | Part 9     | v0.1 §8; v1 §3.7                  |
| M08 | Remarks & recommendations journal with export                                                                       | Yes          | Part 10    | v1 §3.7                           |
| M09 | Competencies, levels, matrix, gaps                                                                                  | Yes          | Part 11    | v0.1 §7                           |
| M10 | Document library (GED) with ACLs                                                                                    | Yes          | Part 12    | v0.1 §8 (documents), §15; v1 §3.8 |
| M11 | Workflows, notifications, dashboards, exports                                                                       | Yes          | Part 13    | v0.1 §9, §10, §11                 |
| M12 | AI agent (RAG)                                                                                                      | No — phase 2 | Part 14    | v1 §4; v0.1 §22                   |

## 4. Mapping — CDC v1 modules → Parts

Nothing in CDC v1 is dropped. Where an item moves, the destination is named.

| CDC v1 section                                    | Content                                                                  | Destination                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| §1.1 Company presentation                         | Identity, vision, mission, activities, logistics                         | Part 1 (extraction) → Part 6 (`/company`)                                                           |
| §1.2 Trilingual values                            | 4 pillars, AR/FR/EN                                                      | Part 1 → Part 6; Arabic strings taken from the prototype, not the PDF (font-encoding fault) — OQ-21 |
| §1.3 Strategic stakes 2024–2026                   | 8 Bn DZD, +60% production, PS-01…PS-04                                   | Part 1 → Part 6 (`/strategy`)                                                                       |
| §1.4 Platform objectives                          | Time-to-autonomy, journey tracking, Kaizen capitalization, AI assistance | Objectives 1–3 → Parts 6–13; objective 4 (AI) → Part 14                                             |
| §2.1 Architecture & stack                         | Next.js, Tailwind, PostgreSQL, Prisma                                    | Part 2 — pinned in ADR-006…ADR-016                                                                  |
| §2.1 Vector DB / LLM rows                         | pgvector, Anthropic API                                                  | Part 14 only. Not installed, not configured, no key anywhere.                                       |
| §2.2 Multilingual                                 | FR / AR (RTL) / EN                                                       | Part 4                                                                                              |
| §2.3 Security & RBAC (4 roles)                    | ADMIN_DRH, DIR_PROD, EXECUTIVE, CADRE_PROD                               | Part 3, remapped onto v0.1's 7 profiles (ADR-005)                                                   |
| §3.1 Module 01 — Onboarding & executive dashboard | Hero, KPI widgets, J+1 agenda                                            | Part 5 (shell) + Part 6 (`/welcome`); role dashboards Part 13                                       |
| §3.2 Module 02 — Institutional & strategy         | Company, values, market table, PS projects                               | Part 6                                                                                              |
| §3.3 Module 03 — Job description & competencies   | `EN-012-DRH`, requirements, missions                                     | Part 6 (display) + Part 11 (competency frame)                                                       |
| §3.4 Module 04 — Organization & dynamic org chart | 3 structures, 2 units, 2 cells, management team                          | Part 7                                                                                              |
| §3.5 Module 05 — Kaizen & operational excellence  | Missions 1 & 3, gaps, action plans                                       | Part 8                                                                                              |
| §3.6 Module 06 — QMS ISO 9001 & HSE               | PR02 ownership, process map, HSE rules                                   | Part 6                                                                                              |
| §3.7 Module 07 — Integration tools                | 30-day checklist, remarks with export                                    | Part 9 (checklist) + Part 10 (remarks)                                                              |
| §3.8 Module 08 — Directory & document library     | 10 contacts, 9 + 7 PDFs                                                  | Part 6 (`/contacts`) + Part 12 (`/documents`)                                                       |
| §4.1–4.4 AI agent                                 | Mission, RAG, system prompt, `POST /api/ai/chat` SSE                     | Part 14 — phase 2. Ingestion boundary designed in Part 12, nothing built.                           |
| §5.1 Colour palette                               | Gold / navy / sand                                                       | Part 2 — `src/styles/tokens.css`                                                                    |
| §5.2 Typography                                   | Playfair Display, Inter, JetBrains Mono                                  | Part 2; Arabic faces added because Playfair has no Arabic coverage (ADR-018)                        |
| §6 Planning — 4 sprints                           | Sprint 1–4                                                               | Superseded by CDC v0.1 §20 phasing (ADR-002)                                                        |

## 5. Mapping — CDC v0.1 sections → Parts

All 24 sections plus the annex appear.

| CDC v0.1 section                              | Destination                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| §1 Context, vision, objectives                | This document; success indicators tracked in Part 13 dashboards                                                               |
| §2 Functional perimeter                       | This document §3                                                                                                              |
| §3 User profiles and rights                   | Part 3 (7 roles, RBAC + scope)                                                                                                |
| §4 Functional architecture / navigation       | Part 5 (shell), extended by Part 13 (dashboard, workflows, reports, administration)                                           |
| §5 Organization / structures module           | Part 7                                                                                                                        |
| §5.1 Organizational view / org chart          | Part 7                                                                                                                        |
| §6 Jobs / positions / job descriptions        | Part 6 (read) + Part 11 (authoring, versioning, workflow)                                                                     |
| §6.1 Job description workflow                 | Part 11 with Part 13's workflow engine                                                                                        |
| §6.2 Recommended job-description content      | Part 11 — field-level model                                                                                                   |
| §7 Competencies / frames / matrices           | Part 11                                                                                                                       |
| §7.1 Job–competency matrix                    | Part 11                                                                                                                       |
| §7.2 Directeur de Production example          | Part 11 — seeded from Part 1 extraction; final labels await the client (OQ-05)                                                |
| §8 Onboarding / integration                   | Part 9                                                                                                                        |
| §8.1 Recommended views                        | Part 9 (journey, checklist/kanban, employee summary, manager, direction)                                                      |
| §9 Workflow, validation, notifications        | Part 13                                                                                                                       |
| §10 Dashboards, reporting, exports            | Part 13                                                                                                                       |
| §11 Administration & settings                 | Part 13 (`/admin`), with the user/role screens landing in Part 3                                                              |
| §12 Multilingual FR/AR/EN                     | Part 4                                                                                                                        |
| §12.1 RTL constraints                         | Part 4                                                                                                                        |
| §13 UX/UI and visual identity                 | Part 2 (tokens) + Part 5 (components). Palette overridden to gold/navy — ADR-004                                              |
| §13.1 Key screens                             | Login (Part 3), shell + component library (Part 5), remainder Parts 6–13                                                      |
| §14 Full-stack technical architecture         | Part 2                                                                                                                        |
| §14.1 Logical architecture                    | Part 2 (layering), Part 3 (audit as append-only), Part 13 (jobs)                                                              |
| §14.2 Code principles                         | Part 2 — TS strict, domain/application/infrastructure split, server-side validation, versioned migrations, no secrets         |
| §15 Security, privacy, compliance (law 18-07) | Part 3, extended by Part 12 for document ACLs                                                                                 |
| §16 Data & conceptual model                   | Part 3 (User…AuditLog), Parts 7–12 (business entities)                                                                        |
| §16.1 Modelling principles                    | Part 2/3 — UUIDs, business codes, validity dates, soft delete, indexes, versioning                                            |
| §17 API & integrations                        | Part 3 onwards — versioned server actions / route handlers; connectors deferred                                               |
| §18 Non-functional requirements               | Part 2 (CI, responsive), Part 5 (a11y ≥ 95), Part 13 (performance on lists/exports)                                           |
| §19 Tests, acceptance criteria                | Part 2 (Vitest/Playwright wiring), Part 3 (security suite), Part 4 (i18n suite), Part 5 (E2E)                                 |
| §19.1 Acceptance criteria examples            | Part 3 (scope), Part 11 (versioning, archived competency), Part 9 (late tasks), Part 4 (locale switch), Part 3 (auditability) |
| §20 Planning and method                       | ADR-002 — v0.1's phasing adopted                                                                                              |
| §21 Expected deliverables                     | Docs in Part 0/2; code and tests across all Parts; admin/user guides in Part 13                                               |
| §22 Out of scope / future evolutions          | This document §2 — AI and connectors, phase 2                                                                                 |
| §23 Business questions to validate            | `OPEN-QUESTIONS.md` — OQ-01…OQ-20                                                                                             |
| §24 Annex — minimum MVP requirements          | This document §2 "In the MVP"                                                                                                 |

## 6. Part plan

| Part | Content                                              | State       |
| ---- | ---------------------------------------------------- | ----------- |
| 0    | Scope, decisions, open questions                     | Delivered   |
| 1    | Content extraction from the prototype                | Delivered   |
| 2    | Foundations — Next.js, Docker, Prisma, tokens, CI    | Delivered   |
| 3    | Auth, RBAC, scope, audit                             | Delivered   |
| 4    | i18n and RTL                                         | Delivered   |
| 5    | Application shell, navigation, component library     | Delivered   |
| 6    | Business content pages                               | Delivered   |
| 7    | Organization and org chart                           | Delivered   |
| 8    | Kaizen tracking                                      | Delivered   |
| 9    | Onboarding engine                                    | Delivered   |
| 10   | Remarks                                              | Delivered   |
| 11   | Competency matrix                                    | Delivered   |
| 12   | Document library                                     | Partial — listing only, no upload or per-document ACL |
| 13   | Workflows, notifications, dashboards, administration | Partial — see below |
| 14   | AI agent — phase 2                                   | Not started |

### What remains inside the delivered Parts

The Parts above are marked delivered where the module is usable end to end. Three
deliberate gaps remain, each with its reason:

| Gap | Part | Why it is still open |
| --- | ---- | -------------------- |
| Field-level editing of a job description's §6.2 content | 11 | The §6.1 workflow is complete — versions, states, validation, separation of duties, an immutable snapshot per version. A new version currently forks the current content with a stated motive; editing the mission and task text in the browser is the remaining step, and it awaits confirmation of who may author what (OQ-07). |
| Document upload, per-document ACLs, CSV/XLSX exports | 12 / 13 | Upload needs the storage decision (OQ-15: object storage, antivirus, retention). The remarks journal exports as text today; tabular CSV/XLSX exports await confirmation of which reports the business actually needs (OQ-17). |
