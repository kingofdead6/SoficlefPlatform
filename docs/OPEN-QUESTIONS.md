# Open Questions — SOFICLEF Platform

OQ-01 … OQ-20 are the twenty business questions of **CDC v0.1 §23**, reproduced verbatim in
French. OQ-21 onwards are ambiguities hit while building; this file is updated as new ones
appear.

**Rule.** Every question carries a _proposed default_. An unanswered question never halts the
build: we proceed on the default, record it as an `ASSUMPTION` in `DECISIONS.md` where it
touches architecture, and change it when the client answers.

**Audience.** OQ-01…OQ-20 are for the workshop with M. Mostafa (Responsable Structure
Compétences & Emplois). OQ-21…OQ-28 are for whoever validated the prototype.

| #     | Blocks                  | Status |
| ----- | ----------------------- | ------ |
| OQ-01 | Part 7                  | Open   |
| OQ-02 | Part 7                  | Open   |
| OQ-03 | Parts 6, 11             | Open   |
| OQ-04 | Part 11                 | Open   |
| OQ-05 | Part 11                 | Open   |
| OQ-06 | Part 11                 | Open   |
| OQ-07 | Parts 11, 13            | Open   |
| OQ-08 | Part 13                 | Open   |
| OQ-09 | Part 9                  | Open   |
| OQ-10 | Parts 9, 12             | Open   |
| OQ-11 | Part 13                 | Open   |
| OQ-12 | Part 3                  | Open   |
| OQ-13 | Part 3                  | Open   |
| OQ-14 | Part 12 + deployment    | Open   |
| OQ-15 | Deployment              | Open   |
| OQ-16 | Part 3 (audit), Part 12 | Open   |
| OQ-17 | Part 13                 | Open   |
| OQ-18 | Parts 10, 12, 13        | Open   |
| OQ-19 | Part 4                  | Open   |
| OQ-20 | Recette                 | Open   |
| OQ-21 | Part 1                  | Open   |
| OQ-22 | Part 2                  | Open   |
| OQ-23 | Parts 1, 8              | Open   |
| OQ-24 | Part 4                  | Open   |
| OQ-25 | Part 5                  | Open   |
| OQ-26 | Parts 5, 9              | Open   |
| OQ-27 | Parts 6, 7              | Open   |
| OQ-28 | Parts 6, 13             | Open   |

---

## CDC v0.1 §23 — Questions métier à valider

### OQ-01

> Quel est le périmètre exact des structures et emplois à gérer au lancement ?

**Why it blocks.** Determines whether the organizational tree covers only the Direction de
Production or all of SOFICLEF, which changes the scope model, the seed volume and the meaning
of "global" rights.
**Blocks.** Part 7 (organization module), and the realism of Part 3's scope tests.
**Proposed default.** Launch scope = Direction de Production (3 structures, 2 production
units, 2 functional cells) plus the directions named in the internal directory (DG, DRH, SMQ,
HSE, Commercial, Achats, Moyens Généraux, Parc Auto, Cyber Sécurité) as leaf structures
without job detail. The model is generic, so widening later is data entry, not development.

### OQ-02

> Dispose-t-on déjà d'un organigramme officiel et d'un référentiel d'emplois ?

**Why it blocks.** If an official org chart exists (the prototype references
`Organigramme_General_SOFICLEF_2025.pdf` and an A3 production org chart), it is the
authoritative source and must be imported rather than re-keyed.
**Blocks.** Part 7.
**Proposed default.** Seed from the prototype's org data; treat the referenced PDFs as pending
inputs (see OQ-10) and provide a CSV/XLSX import with preview and error report as required by
CDC v0.1 §5.

### OQ-03

> Quelle différence métier faut-il appliquer entre emploi, poste et fonction ?

**Why it blocks.** CDC v0.1 §6 distinguishes _emploi_ (generic) from _poste_ (concrete,
possibly held by a person) "when the business confirms it". The distinction changes the data
model and every job screen.
**Blocks.** Part 6 (job-description page), Part 11 (authoring and versioning).
**Proposed default.** Keep all three: `Job` (emploi générique, e.g. Directeur de Production,
`EN-012-DRH`), `Position` (poste concret, one per seat, possibly vacant), `JobDescription`
(fiche de poste versionnée, attached to the `Job`). _Fonction_ is treated as a synonym of
_emploi_ and not modelled separately until the client says otherwise.

### OQ-04

> Existe-t-il des fiches de poste officielles à importer ?

**Why it blocks.** Determines whether Part 11 needs a bulk importer at launch or only an
editor.
**Blocks.** Part 11.
**Proposed default.** One official job description is known and extracted: Directeur de
Production, `EN-012-DRH`, dated 19.08.2018. Assume others exist on paper; build the editor
first and the importer behind it.

### OQ-05

> Quel référentiel de compétences est déjà utilisé (interne / externe) ?

**Why it blocks.** The competency reference frame is the heart of the platform (CDC v0.1 §7)
and no competency data exists in any source document. The prototype's own "Bilan Compétences"
page says the grid is still being finalised by HR.
**Blocks.** Part 11.
**Proposed default.** Assume no formal frame exists. Ship an empty, fully administrable frame
with the families named in CDC v0.1 §7 (technique, comportementale, management, sécurité,
qualité, outils) and seed the illustrative Directeur de Production competencies of §7.2 as
**drafts**, clearly marked "à valider", never as validated content.

### OQ-06

> Quelle échelle de niveaux de compétence doit être utilisée ?

**Why it blocks.** The scale drives gap computation, the matrix rendering and every
assessment.
**Blocks.** Part 11.
**Proposed default.** Configurable scale, default 1–4 (1 Notions, 2 Application, 3 Maîtrise,
4 Expertise), each level carrying a label and a definition in FR/AR/EN. Changing the scale is
an administration action, not a migration.

### OQ-07

> Qui peut créer, relire et valider une fiche de poste ?

**Why it blocks.** Defines the permission matrix for the job-description workflow and the
meaning of a validated version.
**Blocks.** Part 11, Part 13 (workflow engine).
**Proposed default.** Create/edit: `BIZ_ADMIN_CE` and `HR`. Review: `MANAGER` of the owning
structure. Validate/publish: `HEAD_CE` (M. Mostafa). Read validated versions: everyone in
scope. A validated version cannot be edited — a new version is created (CDC v0.1 §19.1).

### OQ-08

> Le workflow varie-t-il selon la structure ou le niveau hiérarchique ?

**Why it blocks.** A per-structure workflow means a configurable state machine; a single
workflow means a fixed one.
**Blocks.** Part 13.
**Proposed default.** One workflow for all structures in the MVP, with the states of CDC v0.1
§9, stored as configuration rather than code so per-structure variants can be added without a
schema change.

### OQ-09

> Quelles sont exactement les étapes et tâches de l'onboarding Directeur Production ?

**Why it blocks.** The 12 checklist milestones extracted from the prototype are the only known
onboarding definition, and the prototype is a communication artefact, not a validated HR
procedure.
**Blocks.** Part 9.
**Proposed default.** Use the 12 extracted milestones (J+1 ×2, J+2, J+3 ×2, J+5, J+7, J+8,
J+10, J+15, J+20, J+30) as the seeded template `ONBOARD-DIRPROD-V1`, editable by HR before
M. Djaoudi's start date. The J+30 milestone keeps its "Recommandé" flag as an optional task.

### OQ-10

> Quels documents doivent être demandés / téléversés pendant l'onboarding ?

**Why it blocks.** Distinguishes documents _provided to_ the newcomer from documents _required
from_ them, which have opposite ACLs and different retention rules.
**Blocks.** Part 9 (task attachments), Part 12 (library).
**Proposed default.** The 9 reference PDFs listed in the prototype are provided _to_ the
newcomer. The 7 pending documents are tracked as "to be supplied by the business". No document
is requested _from_ the employee in the MVP — personal HR documents raise law 18-07 obligations
that must be settled before any such upload exists (see OQ-16).

### OQ-11

> Quels KPI le Responsable C&E doit-il voir chaque matin ?

**Why it blocks.** Defines the default dashboard, which is the landing screen for the sponsor.
**Blocks.** Part 13.
**Proposed default.** Job-description coverage, competency-matrix coverage, gap distribution by
criticality, onboarding progress with late tasks, items awaiting the viewer's validation, data
quality (missing / duplicate / obsolete) — i.e. CDC v0.1 §10 exactly, until the sponsor
reorders them.

### OQ-12

> Quelles données doivent être cloisonnées entre RH, managers et direction ?

**Why it blocks.** Sets what a `MANAGER` sees about their team versus what stays with HR, and
is the input to Part 3's scope tests.
**Blocks.** Part 3.
**Proposed default.** Managers see structure-scoped organizational and competency data, never
another structure's. Assessments and remarks are visible to their author, the concerned
employee's HR chain and `HEAD_CE`. `VIEWER` sees consolidated, validated data only — no
individual assessment. Applied strictly at the query layer (ADR-021) so a wrong default is a
configuration correction, not a leak.

### OQ-13

> Quel système d'identité/SSO existe aujourd'hui chez SOFICLEF ?

**Why it blocks.** Decides whether login is local or delegated; retrofitting SSO after
call sites are written is expensive.
**Blocks.** Part 3.
**Proposed default.** Local credentials with a server-side session table (ADR-011), behind one
authentication module so an OIDC provider can be added without touching call sites. Contact
for the answer: MERAH Rafik, Responsable Cyber Sécurité (Poste 150).

### OQ-14

> Où seront hébergés les documents et la base de données ?

**Why it blocks.** On-premise versus cloud changes the storage adapter, the backup procedure
and the network assumptions.
**Blocks.** Part 12, deployment.
**Proposed default.** Assume on-premise or Algerian hosting, given the AEO status and HR data
sensitivity. Storage is behind an adapter interface with a local-filesystem implementation and
an S3-compatible implementation, selected by configuration.

### OQ-15

> Quelles contraintes IT / réseau / VPN / on-premise devons-nous respecter ?

**Why it blocks.** Determines whether the runtime may reach the internet at all — which
decides fonts, e-mail relay, CDN and update strategy.
**Blocks.** Deployment.
**Proposed default.** Assume no outbound internet access from the application server. Fonts
are self-hosted (ADR-018), no CDN is used, no external service is called at runtime. E-mail
notifications stay out of the MVP until an internal SMTP relay is confirmed.

### OQ-16

> Quelle politique de conservation des données RH doit être appliquée ?

**Why it blocks.** Algerian law 18-07 on personal data protection applies, and CDC v0.1 §15
defers retention to the business and legal owners. Audit rows and HR documents accumulate
indefinitely without a rule.
**Blocks.** Part 3 (audit retention), Part 12 (document retention).
**Proposed default.** Retain everything for the MVP, delete nothing automatically, and expose
no bulk-delete path. Retention and purge are implemented only once a written policy exists —
engineering does not choose a retention period for HR data.

### OQ-17

> Quels imports/exports Excel sont indispensables dès le MVP ?

**Why it blocks.** Sizes the export work and decides CSV-only versus XLSX with formatting.
**Blocks.** Part 13.
**Proposed default.** CSV export mandatory on every table (CDC v0.1 §10), XLSX on structures,
jobs and the competency matrix. Import: CSV/XLSX for structures and jobs, with preview and an
error report before commit.

### OQ-18

> Quel niveau de personnalisation des documents PDF/Word est attendu ?

**Why it blocks.** A branded, letterhead-quality PDF of a validated job description is
substantially more work than a plain server-rendered PDF.
**Blocks.** Part 10 (remarks export), Part 12, Part 13 (reports).
**Proposed default.** Server-side PDF with SOFICLEF letterhead, document code, version and
validation date in the footer. No Word output in the MVP; no per-user template editor.

### OQ-19

> Quelles langues doivent être disponibles pour les données métier historiques ?

**Why it blocks.** Decides whether existing French content must be translated at all, and by
whom — which is the difference between a translation backlog and a display rule.
**Blocks.** Part 4.
**Proposed default.** Historical business content stays French. AR/EN are mandatory for the
interface and for administrable labels only. Untranslated content falls back to French with a
visible "traduction en attente" affordance. Nothing is machine-translated (ADR-025).

### OQ-20

> Quels utilisateurs participeront à la recette et qui donne le GO de production ?

**Why it blocks.** Without a named acceptance owner, "done" is undefined.
**Blocks.** Recette and go-live.
**Proposed default.** Recette by M. Mostafa (sponsor) and M. CHANANE Mohamed Rafik (Poste 434)
for HR, M. DJAOUDI Farid as pilot user, MERAH Rafik (Poste 150) for IT security. Production GO
by the sponsor, with the DG (M. CHARIKHI Sofiane) informed.

---

## Questions raised while building

### OQ-21 — Are the Arabic value strings correct?

**Context.** The four company values carry Arabic strings. In CDC v1's PDF these are corrupted
by a font-encoding fault — value 01 is truncated (`الحزم والاحتر`) and values 03 and 04 have no
Arabic text at all. The prototype's HTML carries clean strings:
01 `الحزم والاحترام`, 02 `التعاون وروح الفريق`, 03 `الرشادة والإتقان`,
04 `الابتكار والتطوير المستمر`.
**Why it blocks.** These are the only Arabic business content in the entire corpus and they
appear on the company page in all three locales. Publishing a wrong rendering of the
management charter is a visible error.
**Blocks.** Part 1 (extraction), and the company page in Part 6.
**Proposed default.** Take the prototype's strings verbatim, per ADR-026. Ask the client to
confirm them against the signed Charte de Management.

### OQ-22 — Gold/navy or red/anthracite?

**Context.** CDC v1 and the prototype specify gold `#8b6914` / navy `#1e4d8c` on sand. CDC
v0.1 §13 proposes SOFICLEF red (`#C8102E` as a mock-up fallback) with anthracite `#30343B`,
noting the exact value must come from the brandbook or the vector logo.
**Why it blocks.** It is the platform's whole visual identity.
**Blocks.** Part 2.
**Proposed default.** Gold/navy, since the client has approved it on screen (ADR-004). All
colours pass through `src/styles/tokens.css`, so a switch to red/anthracite is a one-file
change plus a contrast re-check. Please supply the vector logo and the brandbook.

### OQ-23 — Five Kaizen actions or seventeen?

**Context.** The build brief's content inventory expects 5 tracked Kaizen actions. The
prototype contains 17: Mission 1's action plan (7 actions) and Mission 3's consolidated plan
(10 actions), each with owner, deadline and status. CDC v1 §3.5 shows a condensed five-row
table that is a subset of Mission 3's plan.
**Why it blocks.** It changes what the Kaizen module shows and whether history is preserved.
**Blocks.** Part 1 (count assertion), Part 8.
**Proposed default.** Extract and keep all 17, tagged by mission (ADR-028). CDC v1's five-row
table is offered as an executive filter over the same data, not as a second dataset.

### OQ-24 — Western or Eastern Arabic numerals?

**Context.** The Arabic locale can render digits as 0–9 or ٠–٩. No source document states a
preference, and the data includes document codes and phone extensions shared across locales.
**Why it blocks.** It affects every number, date and code displayed in Arabic.
**Blocks.** Part 4.
**Proposed default.** Western Arabic numerals (ADR-032), configurable in one place.

### OQ-25 — Is removing the "Assistant IA" entry from the navigation acceptable?

**Context.** The prototype the client has seen shows an AI assistant in the sidebar. CDC v0.1
§22 places it outside the MVP, and the prototype's implementation cannot work outside a
sandbox: it calls `api.anthropic.com` from the browser with no API key, so it would fail on
CORS and authentication in any real deployment.
**Why it blocks.** A visible feature disappears relative to a demo the client has already
seen. That must be a decision, not a surprise.
**Blocks.** Part 5.
**Proposed default.** The entry is absent from the navigation (ADR-003). Phase 2 restores it,
server-side, with the key held by the server. If the client wants a visible placeholder
instead, that is a small change — but it should be their explicit choice.

### OQ-26 — Onboarding day badge, target start date, and the third Kaizen mission

**Context.** Three loose ends in the prototype's content. (a) M. Djaoudi's start date is stated
as 07.06.2026, in the future relative to this build; the topbar day badge is hardcoded to
"J+1 · 07.06.2026". (b) The prototype's Kaizen page states "3 missions réalisées à ce jour"
but documents only Missions 1 and 3 — Mission 2's report is missing. (c) Mission 3 carries the
reference `SOFICLEF-M2-2026`, which names M2 while the heading says Mission 3.
**Why it blocks.** (a) decides what the badge shows before the start date; (b) and (c) are
content gaps that would surface as a hole in the Kaizen history.
**Blocks.** Part 5 (day badge), Part 9, Part 8.
**Proposed default.** (a) The day badge is computed from the signed-in user's onboarding start
date; before that date it shows the countdown (`J-12`) rather than a fixed J+1. (b) Mission 2
is recorded as a known gap in `CONTENT-INVENTORY.md`; please supply its report. (c) The
reference is extracted verbatim as `SOFICLEF-M2-2026` with the mission numbered 3 as titled,
and the mismatch is flagged rather than corrected.

### OQ-27 — Are the four named managers the acting heads of the vacant structures?

**Context.** The prototype states that all three structures — Fabrication, Contrôle Qualité,
Maintenance — have a **vacant** head, and separately lists four managers whose titles are
_Responsable Fabrication_ (OUDNI Yassine), _Responsable Maintenance_ (ATTOU Fares),
_Responsable Contrôle Qualité_ (BELLAL Yousfi) and _Responsable Développement Industriel_
(FOUFOU Nadjib). Both statements are extracted as they stand.
**Why it blocks.** It decides whether the org chart shows three vacancies with acting heads,
three genuine vacancies plus four people attached elsewhere, or an out-of-date chart. It also
decides who holds `MANAGER` rights on which scope (Part 3's data), and it interacts with the
four open recruitments.
**Blocks.** Part 6 (management page), Part 7 (org chart), and the role/scope assignment data.
**Proposed default.** Model them as _acting_ heads: the post stays `VACANT` — which is what
drives the recruitment priority — and the person is attached to the structure as its current
`MANAGER` scope holder. Both facts are then visible instead of one overwriting the other.

### OQ-28 — What are the four "Contribution DPR" progress figures, and as of when?

**Context.** The strategy page shows four progress bars: production share of revenue 40 %,
Plaque & Clé capacity 70 %, Direction de Production structuring 20 %, Porte SOFICLEF launch
15 %. No source, measurement method or as-of date is given anywhere in the corpus.
**Why it blocks.** Displayed next to the 8 Bn DZD objective they read as measured KPIs. If
they are illustrative, presenting them as measurements misleads the DG.
**Blocks.** Part 6 (strategy page), Part 13 (dashboards).
**Proposed default.** Extracted verbatim and displayed with an explicit "valeur indicative —
à confirmer" qualifier and no as-of date, until the business supplies the source. They are not
fed into any dashboard KPI.
