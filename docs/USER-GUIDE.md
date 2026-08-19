# How the platform works — users, rights and pages

This is the functional guide: who each kind of user is, what they can see, what they can
do, and what they deliberately cannot. It describes the platform as built, not as
planned — every permission listed here is the one the code enforces
(`src/domain/auth/permissions.ts`), and the security suite asserts them over HTTP.

For scope and open business questions, see `SCOPE.md` and `OPEN-QUESTIONS.md`.
For the technical build, see the root `README.md`.

---

## 1. The two rules everything else follows

**Rights are role + scope, never role alone.** Holding a permission says *what* somebody
may do; the scope attached to their assignment says *where*. A structure manager and an
HR director can both hold `job:read`; only HR sees every structure.

There are three scopes:

| Scope                 | Means                                                    | Who has it                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `GLOBAL`              | The whole organization                                   | Technical admin, business admin, Head C&E, HR, Reader |
| `ORGANIZATION_UNIT`   | One structure **and everything beneath it**              | Manager                                       |
| `SELF`                | Only their own records                                   | Employee                                      |

**The page is the boundary, not the menu.** A link a user cannot open is never sent to
their browser — but hiding a link is a courtesy, not security. Typing the URL directly
answers **404**, and calling the API directly answers **403**. Scope is applied inside the
database query, so a manager's request returns their structures and nothing else; there is
no "fetch everything, hide the rest in the UI" anywhere in the platform.

An out-of-scope read answers 404 rather than 403 on purpose: 403 would confirm the record
exists, which lets someone map the organization by trying ids.

---

## 2. Anyone — no account needed

Four pages are public. They carry the company's own presentation, the same material
already published on soficlef.com, and read only from tables with no personal data.

| Page              | URL             | What it shows                                                          |
| ----------------- | --------------- | ---------------------------------------------------------------------- |
| Home              | `/fr`           | Who SOFICLEF is, key figures, vision and mission, the four values      |
| Company           | `/fr/entreprise`| Identity, certification, activities, the values in Arabic/French/English |
| Strategy          | `/fr/strategie` | The 2024–2026 plan: objectives by market, the PS-01…PS-04 projects     |
| Careers           | `/fr/carrieres` | Positions currently open, and how to apply                             |

A visitor can switch language (`/ar/…`, `/en/…`) and sign in. They can do nothing else:
no organization chart, no directory, no employee, no document, no journey.

> **Note on language.** The interface translates into Arabic and English. The business
> text inside it stays French, because business content is never machine-translated — a
> plausible-but-wrong translation of a strategic objective is worse than an untranslated
> one. It is shown as French text marked as such, so screen readers and the bidi algorithm
> both handle it correctly. Only the four company values were supplied trilingually by the
> client, and those appear in all three.

---

## 3. The seven user types

Each section says what the person is, what they can do, and — where it matters — what they
deliberately cannot.

### 3.1 Collaborateur — `EMPLOYEE`

**Who.** Anyone with an account and no managerial responsibility. The new Directeur de
Production holds this role for his own onboarding, alongside a manager role for his
structure — two assignments, which is exactly right.

**Scope: SELF.** Their own records only.

**Can:**

- Read the reference frame: company, strategy, structures, jobs, job descriptions, QMS, HSE, the internal directory, documents.
- **Run their own 30-day onboarding journey.** Tick a step as done, mark one *in progress*, or flag it *blocked* — which is what tells HR something is stuck. Deadlines and lateness are shown per step.
- **See their own competency assessment** — the level their job requires, the level they were assessed at, and the gap.
- **Write in the remarks journal**, addressed to HR and the DG, and delete their own entries. They can export the journal as a text file.
- Read and clear their own notifications.

**Cannot:** validate their own onboarding steps (that is the manager's act), assess
themselves, see anybody else's journey, remarks or assessments, or open the Kaizen module.

### 3.2 Manager / Responsable de structure — `MANAGER`

**Who.** The head of a structure — Fabrication, Contrôle Qualité, Maintenance.

**Scope: ORGANIZATION_UNIT.** Their structure *and its descendants*: the head of
Fabrication also covers the Coffre and Brouette units, automatically.

**Can, within their perimeter:**

- Everything an employee can, plus:
- **Assess a competency** for someone in their structures — recording a level, a date and a comment. Assessments are append-only, so progression over time survives.
- **Validate an onboarding step** a collaborator has marked done. This sends that person a notification.
- **Update a Kaizen action's status** where the programme is theirs.
- See the dashboard for their perimeter: journeys, late tasks, blocked steps, competency gaps — all counted over their structures only.

**Cannot:** see a sibling structure (the platform answers 404, not an empty list), read
the remarks journal at all — that is deliberate: it is a collaborator's own observations to
HR and the DG, and a structure head is not on that distribution list.

### 3.3 DRH / RH — `HR`

**Who.** The Human Resources department.

**Scope: GLOBAL.**

**Can:**

- **Create and manage onboarding journeys**: instantiate a template for a new arrival, adjust it, follow every journey in the organization from one table with its progress and alerts.
- Update onboarding tasks across the organization.
- **Validate a job description.**
- Read the remarks journal — it is addressed to them.
- Add documents to the library.
- Read the competency frame and every assessment; export reports.

**Cannot:** assess a competency themselves (that is the manager's judgement, on someone
they actually work with), create or restructure organizational units, or administer
accounts and roles.

### 3.4 Responsable Compétences & Emplois — `HEAD_CE`

**Who.** The business sponsor — M. Mostafa. The arbitration and validation authority over
the reference frame.

**Scope: GLOBAL.**

**Can:**

- **Validate a job description** — approve it, or send it back with corrections.
- **Validate a competency** definition.
- **Validate an onboarding journey** and its steps.
- Update jobs and job descriptions.
- Read everything in the business reference frame, including the remarks journal; export reports.

**Cannot:** create structures, competencies or templates from scratch — that is the
business administrator's job. This split is deliberate: **the person who writes a job
description is not the person who signs it off.**

### 3.5 Administrateur métier C&E — `BIZ_ADMIN_CE`

**Who.** The person who maintains the reference frame day to day — CHANANE Mohamed Rafik
in the seeded cast.

**Scope: GLOBAL.**

**Can — this is the widest business role:**

- **Structures**: create, edit, archive. Nothing is ever deleted; archiving preserves the history a reorganization would otherwise erase, and is refused while active children or jobs still hang off the unit.
- **Jobs**: create, edit, archive.
- **Job descriptions**: create and edit, and open a new version with a stated motive.
- **Competencies**: create, edit, archive; build the job↔competency matrix.
- **Onboarding templates**: create and edit the reusable journeys HR then instantiates.
- **Kaizen actions**: create and update.
- Documents: add and edit. Reports: export.

**Cannot:** **validate anything.** They draft and submit a job description; the "Valider"
button is not shown to them and the server refuses the action if called directly. They also
cannot administer accounts or roles.

### 3.6 Lecteur / Direction — `VIEWER`

**Who.** General management — M. CHARIKHI Sofiane. Oversight without operational
involvement.

**Scope: GLOBAL, read-only.**

**Can:** read the dashboard, the reference frame, structures, jobs, validated job
descriptions, competencies, documents, and reports.

**Cannot: change anything at all.** Every mutating action is refused, and the security
suite asserts this exhaustively — for every mutating action on every resource, a reader
gets 403. They also cannot see the remarks journal, the Kaizen module, or anyone's
onboarding checklist.

### 3.7 Administrateur technique — `TECH_ADMIN`

**Who.** IT. Runs the platform; does not run the business.

**Scope: GLOBAL.**

**Can:**

- **Accounts**: create, edit, suspend, reactivate, delete. Suspending an account also drops its sessions, so "suspended" means signed out on the next request rather than whenever the cookie happens to expire.
- **Roles**: grant a role, with a perimeter. A `MANAGER` grant requires a structure — a manager role with no perimeter is exactly what the security model forbids.
- **Audit trail**: read and export every recorded event.
- **Settings**: read and update platform parameters.

**Cannot — and this is intentional:**

- **Validate a job description, or assess a competency.** Signing off business content is a business act. IT running the servers does not make IT the authority on whether someone is competent.
- **Grant a role to themselves.** The attempt is refused *and written to the audit log*, so an administrator quietly widening their own access is both blocked and visible.
- **Suspend their own account**, which would lock the platform's administrator out of it.

---

## 4. Rights at a glance

`R` read · `W` create/update · `V` validate · `—` no access.
Read this alongside the scope column: two roles with `R` see different amounts of data.

| Resource                    | Employee | Manager | HR     | Head C&E | Biz admin | Reader | Tech admin |
| --------------------------- | -------- | ------- | ------ | -------- | --------- | ------ | ---------- |
| Scope                       | self     | unit    | global | global   | global    | global | global     |
| Structures                  | R        | R       | R      | R        | **W**     | R      | R          |
| Jobs                        | R        | R       | R      | **W**    | **W**     | R      | —          |
| Job descriptions            | R        | R       | R + **V** | **W** + **V** | **W** | R  | —          |
| Competency frame            | R        | R       | R      | R + **V**| **W**     | R      | —          |
| Assessments                 | R (own)  | R + **W** | R    | R        | —         | —      | —          |
| Onboarding templates        | —        | —       | R      | R        | **W**     | —      | —          |
| Onboarding journeys         | R (own)  | R       | **W**  | R + **V**| **W**     | R      | R          |
| Onboarding tasks            | **W** (own) | **W** + **V** | **W** | R + **V** | **W** | — | —      |
| Remarks journal             | **W** (own) | —    | R      | R        | R         | —      | —          |
| Kaizen actions              | —        | R + **W** | —    | R        | **W**     | —      | —          |
| Documents                   | R        | R       | **W**  | R        | **W**     | R      | —          |
| Dashboard & reports         | R        | R       | R      | R        | R         | R      | R          |
| Users & roles               | —        | —       | —      | —        | —         | —      | **W**      |
| Audit log                   | —        | —       | —      | —        | —         | —      | R          |
| Settings                    | —        | —       | —      | —        | R         | —      | **W**      |

Three separations are worth stating plainly, because they are the point of the model:

1. **Writing ≠ validating.** The business administrator drafts; Head C&E and HR validate.
2. **Business ≠ technical.** The technical administrator manages accounts and cannot sign off a job description or rate a competency.
3. **Nobody escalates their own access.** Self-assignment of a role is refused and audited.

---

## 5. The pages

Seventeen routes in six groups. Each declares the permission it needs, so the menu and the
route agree by construction.

| Group          | Page                      | Who sees it                                   | What it does                                                       |
| -------------- | ------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Pilotage       | Tableau de bord           | all seven                                     | Role-aware KPIs; each block appears only if you hold its permission |
| Onboarding     | Bienvenue                 | all seven                                     | The welcome message, key dates, the first day's agenda             |
| Onboarding     | Entreprise                | all seven                                     | Identity, values, activities                                       |
| Onboarding     | Plan Stratégique          | all seven                                     | The 2024–2026 plan and its four projects                           |
| Onboarding     | Fiche de Poste            | all but technical admin                       | The `EN-012-DRH` fiche, its versions, its validation circuit       |
| Direction      | Structures & Organisation | all seven (each within their own scope)       | The organization tree; create/edit/archive with the right permission |
| Direction      | Équipe Encadrement        | all seven (own scope)                         | Structure heads and their priorities                               |
| Direction      | Recrutements en cours     | all but technical admin                       | Open positions and internal mobility                               |
| Direction      | Projet Kaizen             | manager, business admin, Head C&E             | The consultant's missions, gaps and tracked actions                |
| Référentiels   | SMQ · ISO 9001            | all but technical admin                       | The PR02 process, responsibilities, the process map                |
| Référentiels   | HSE                       | all but technical admin                       | Site safety rules, PPE, restricted zones                           |
| Référentiels   | Interlocuteurs            | all seven                                     | The internal directory with extensions                             |
| Référentiels   | Documents                 | all but technical admin                       | The reference document library                                     |
| Outils         | Checklist 30 jours        | all but technical admin and reader            | The interactive journey, plus oversight for managers and HR        |
| Outils         | Bilan Compétences         | all but technical admin                       | The job↔competency matrix and gaps                                 |
| Outils         | Remarques                 | employee, HR, Head C&E, business admin        | The observations journal, with export                              |
| Administration | Administration            | technical admin only                          | Accounts, roles, audit trail                                       |

The technical administrator sees fewer business pages than anyone else, which is the model
working as intended: running the platform is not a reason to read its HR content. The
reader (DG) sees the reference frame but neither the checklist nor the remarks journal.

---

## 6. Two workflows worth knowing

### The 30-day onboarding journey

```
À faire → En cours → Bloquée → Terminée → Validée
```

The collaborator moves their own steps. **Only a manager or Head C&E moves a step to
Validée**, and doing so notifies the person. A step cannot jump to Validée without being
completed first. Deadlines come from the journey's start date plus each milestone's day
offset; lateness is computed when the page is read, never stored, so a task cannot stay
flagged as late after it has been finished.

`Bloquée` is a real state rather than a note, because the dashboard counts blocked steps —
free text cannot be counted, and a stuck onboarding is exactly what HR needs to see.

### The job-description validation circuit

```
Brouillon → En revue → À corriger → Validée → Archivée
```

The business administrator drafts and submits; **Head C&E or HR validates**. A validated
job description **cannot be edited** — editing it means opening a new version with a stated
motive, and the validated one stays exactly as it was signed. Each version keeps an
immutable snapshot of its content, so a later change to the live data can never rewrite
what somebody approved. Only one version may be open at a time, so two people cannot
silently overwrite each other.

---

## 7. What is recorded

Every sensitive change writes an audit row — who, when, what, the value before and the
value after — in the same database transaction as the change itself. An audited change
that did not happen, and a change nobody can see, are both defects.

Recorded: sign-ins and failures, account and role changes (including **refused**
self-assignments), structure and job changes, validations, assessments, remarks, and
document or report exports. The trail is append-only: nothing in the application can edit
or delete a row. The technical administrator reads it from Administration → Journal
d'audit.

Passwords are hashed with Argon2id and never stored or logged in any other form. Sessions
live on the server and can be revoked, taking effect on the signed-in person's next request.

---

## 8. Demo accounts

The seed creates one account per profile so the whole model can be walked through. They
share a password set by `SEED_DEMO_PASSWORD` at seed time — never written in the
repository. If it is unset, the seed generates one and prints it once.

| Account                      | Role(s)                       | Useful for showing                            |
| ---------------------------- | ----------------------------- | --------------------------------------------- |
| `djaoudi@soficlef.local`     | Employee + Manager (DPR)      | Both sides at once: own journey, and a perimeter |
| `oudni@soficlef.local`       | Manager (DPR-FABRICATION)     | Scope: sees one structure, not its siblings   |
| `drh@soficlef.local`         | HR                            | Oversight of every journey                    |
| `mostafa@soficlef.local`     | Head C&E                      | Validation authority                          |
| `chanane@soficlef.local`     | Business admin C&E            | The widest business rights, and no validation |
| `charikhi@soficlef.local`    | Reader (DG)                   | Read-only: every mutation refused             |
| `tech.admin@soficlef.local`  | Technical admin               | Accounts, roles, audit — and no business rights |
| `boubenia@soficlef.local`    | Employee                      | The narrowest profile                         |

A good five-minute demonstration: sign in as **oudni** and note the dashboard counts one
vacant structure; sign in as **drh** and note the same tile reads three. Nothing was
hidden in the interface — the two queries genuinely returned different rows.
