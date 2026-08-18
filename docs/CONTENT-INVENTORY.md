# Content Inventory — extracted from the HTML prototype

Source: `seed/source/SOFICLEF_Onboarding_Directeur_Production_.html` (93 591 bytes, 15 pages).
Producer: `seed/extract-html.ts` — `npm run seed:extract`.
Output: `seed/data/*.json`, each validated against `seed/schemas/*.ts`.

The extractor asserts every count below and exits non-zero on a mismatch, so this table
cannot drift away from the data. French text is copied verbatim; Arabic strings are copied
byte for byte; nothing is translated (ADR-025, ADR-027).

## Counts — expected vs actual

Expected = the build brief's content inventory. Actual = last run.

| Domain          | Content                                                                   | Source page      | Expected | Actual | File                                   |
| --------------- | ------------------------------------------------------------------------- | ---------------- | -------- | ------ | -------------------------------------- |
| Company         | Identity, vision, mission, activities, logistics                          | `entreprise`     | 1        | 1      | `company.json`                         |
| Values          | Trilingual pillars, Arabic + French                                       | `entreprise`     | 4        | 4      | `values.json`                          |
| Strategy        | Market table (market, strategy, share target, revenue target)             | `strategie`      | 5        | 5      | `strategy.json`                        |
| Strategy        | Strategic projects PS-01 … PS-04                                          | `strategie`      | 4        | 4      | `strategy.json`                        |
| Job description | Directeur de Production, `EN-012-DRH`, 19.08.2018                         | `poste`          | 1        | 1      | `job-description.json`                 |
| Job description | Permanent tasks                                                           | `poste`          | 14       | 14     | `job-description.json`                 |
| Org             | Structures (Fabrication, Contrôle Qualité, Maintenance), all heads vacant | `structures`     | 3        | 3      | `organization.json`                    |
| Org             | Production units (Coffre, Brouette)                                       | `structures`     | 2        | 2      | `organization.json`                    |
| Org             | Functional cells (Planification & Ordonnancement, Études & Méthodes)      | `structures`     | 2        | 2      | `organization.json`                    |
| Management team | OUDNI Yassine, ATTOU Fares, BELLAL Yousfi, FOUFOU Nadjib                  | `encadrement`    | 4        | 4      | `management-team.json`                 |
| Recruitment     | Open posts under the Production Department                                | `recrutements`   | 4        | 4      | `recruitment.json`                     |
| Kaizen          | Documented missions (Mission 1 Apr 2025, Mission 3 May 2026)              | `kaizen`         | 2        | 2      | `kaizen.json`                          |
| Kaizen          | Tracked actions with owner / deadline / status                            | `kaizen`         | **5**    | **17** | `kaizen.json` — see _Divergence_ below |
| QMS             | PR02 ownership, process map, responsibilities                             | `smq`            | 1        | 1      | `qms.json`                             |
| QMS             | Mapped processes (PM01–PM04, PR01–PR03, PS01–PS03)                        | `smq`            | 10       | 10     | `qms.json`                             |
| HSE             | Traffic rules, mandatory PPE, zones, risk areas                           | `hse`            | 1        | 1      | `hse.json`                             |
| Onboarding      | Checklist milestones, J+1 → J+30                                          | `checklist`      | 12       | 12     | `onboarding-checklist.json`            |
| Contacts        | Internal directory with extensions                                        | `interlocuteurs` | 10       | 10     | `contacts.json`                        |
| Documents       | Reference PDFs available                                                  | `docs`           | 9        | 9      | `documents.json`                       |
| Documents       | Reference PDFs pending                                                    | `docs`           | 7        | 7      | `documents.json`                       |

Milestone sequence asserted in order: J+1, J+1, J+2, J+3, J+3, J+5, J+7, J+8, J+10, J+15,
J+20, J+30 — the last flagged "Recommandé". Both assertions pass.

## Divergence from the brief's inventory

**Kaizen tracked actions: the brief expects 5, the prototype contains 17.**
The prototype carries two action-plan tables — Mission 1's plan (7 actions) and Mission 3's
consolidated plan (10 actions) — each row with action, owner (_pilote_), deadline (_délai_)
and status. The figure 5 is CDC v1 §3.5's condensed executive table, which is a subset of
Mission 3's plan, not a separate dataset. All 17 are extracted and tagged by mission; the
five-row view is reproducible as a filter. Recorded as ADR-028 and OQ-23; the client should
confirm which view they expect on screen.

## Entities extracted, per file

| File                        | Records                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `welcome.json`              | 1 welcome record: recipient, start date 2026-06-07, DG message, signature, 4 KPI stats, 4 J+1 agenda items                          |
| `company.json`              | 1 company record + 3 activity blocks (Production, Distribution exclusive, Logistique)                                               |
| `values.json`               | 4 values, each with `nameFr`, `nameAr`, `nameEn`                                                                                    |
| `strategy.json`             | plan label, global objective, 5 market rows, 4 strategic projects, 4 contribution progress rows                                     |
| `job-description.json`      | 1 job description: positioning (4 fields), requirements (4 fields), 2 missions, 14 permanent tasks, 6 professional responsibilities |
| `organization.json`         | 3 structures, 2 production units, 2 functional cells, 5 org-chart nodes                                                             |
| `management-team.json`      | 4 structure heads with perimeter and J+30 priority, 4 recommended first-contact actions (J+2, J+5, J+8, J+15)                       |
| `recruitment.json`          | 4 open posts, internal-mobility note, recommended J+3 action                                                                        |
| `kaizen.json`               | programme summary, 2 missions (5 + 6 results, 5 + 4 journal days, 5 + 6 gaps), 17 tracked actions, 6 J+30 priority actions          |
| `qms.json`                  | 1 QMS record: certification, PR02 ownership, process map `ID-03-DG`, 5 priority responsibilities, 10 processes                      |
| `hse.json`                  | 1 HSE record: 5 traffic rules, 5 mandatory-PPE items, zones, high-voltage risk area, circulation-plan note                          |
| `onboarding-checklist.json` | 12 milestones with day offset, title, detail, `isRecommended`                                                                       |
| `contacts.json`             | 10 directory entries keyed by extension (`poste-145` … `poste-120`), priority rank S1/S2                                            |
| `documents.json`            | 9 available PDFs (file name kept for the Part 12 library), 7 pending documents                                                      |

## Beyond the brief's inventory

- **`welcome.json`** is not in the brief's table but is real prototype content — the DG's
  welcome message, the four KPI tiles and the four J+1 agenda entries. Part 6's `/welcome`
  route needs it, so it is extracted rather than retyped later.
- **Sub-counts** (14 permanent tasks, 10 QMS processes, journal days, gap tables, priority
  actions) are extracted and asserted even where the brief counts only the parent record.
  They are the substance of the pages that will render them.

## Identifiers

Business codes are preserved as-is and used as keys where they exist:
`EN-012-DRH`, `PS-01`…`PS-04`, `PR02`, `ID-03-DG`, the QMS process codes, and the phone
extensions (`poste-121`, `poste-434`, …). Everything else gets a deterministic slug derived
from its French label (`structure-fabrication`, `unite-coffre`, `kaizen-mission-1`,
`jalon-07`), so re-running the extractor produces identical identifiers and the seed can be
re-applied without duplicating rows.

## Presentation stripped from labels

The prototype prefixes some headings with a decorative emoji (`🏭 Structure Fabrication`,
`📋 Mission 1 — …`). The glyph is stored in a separate `icon` field rather than inside the
French label, so a heading can be rendered without it and sorting is not affected by an
invisible-width character. Emoji inside prose and list items (HSE PPE lines, for instance)
are left untouched — there they are content.

## Needs manual review

Nothing failed to parse. The parser raises on anything it cannot read confidently, and the
last run reported no such item. The open points below are about _meaning_, not parsing:

| Item                                     | Why                                                                                                                                                                                                                                                                                                                                                                    | Tracked as     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Arabic value strings                     | The only Arabic business content in the corpus. CDC v1's PDF corrupts them (value 01 truncated, values 03–04 empty); the prototype's copy is clean and is what we took. Client must confirm against the signed Charte de Management.                                                                                                                                   | OQ-21          |
| English value names                      | Not in the prototype. Taken from CDC v1 §1.2, a client document — not translated by us. Marked in the extractor with the citation.                                                                                                                                                                                                                                     | ADR-025        |
| Mission 2 report                         | The Kaizen page states "3 missions réalisées à ce jour" but documents only Missions 1 and 3. Mission 2's report is absent from every source.                                                                                                                                                                                                                           | OQ-26          |
| Mission 3 reference `SOFICLEF-M2-2026`   | The reference names M2 while the heading says Mission 3. Extracted verbatim, not corrected.                                                                                                                                                                                                                                                                            | OQ-26          |
| Kaizen action count                      | 17 in the prototype, 5 in the brief.                                                                                                                                                                                                                                                                                                                                   | ADR-028, OQ-23 |
| Structure head names vs. management team | All three structure heads are "VACANT", yet four managers are listed as _Responsable Fabrication_, _Responsable Maintenance_, _Responsable Contrôle Qualité_, _Responsable Développement Industriel_. Both statements are extracted as they stand; whether these people are acting heads pending recruitment, or the org chart is out of date, is a business question. | OQ-27          |
| Document file sizes                      | `PDF · 12 Mo`, `PDF · A3 · 2026` etc. are free text in the prototype, not metadata. Kept verbatim in `detailFr`; real file metadata will come from the files themselves in Part 12.                                                                                                                                                                                    | —              |
| Progress percentages                     | The four "Contribution DPR" bars (40 %, 70 %, 20 %, 15 %) have no stated source or as-of date. Extracted as-is; they must not be presented as measured KPIs until the business confirms them.                                                                                                                                                                          | OQ-28          |

## Re-running

`npm run seed:extract` is idempotent — two runs over the same input produce byte-identical
files (verified). If the client sends a revised prototype, replace
`seed/source/SOFICLEF_Onboarding_Directeur_Production_.html` and re-run: changed counts fail
the assertions and the diff shows exactly what moved.
