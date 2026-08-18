/**
 * One-off parser for the client's HTML prototype, kept in the repository because the
 * client may send a revised file (ADR-027).
 *
 *   npm run seed:extract
 *
 * Contract
 *  - Input:  seed/source/SOFICLEF_Onboarding_Directeur_Production_.html
 *  - Output: one JSON file per domain in seed/data/, each validated against its Zod
 *            schema in seed/schemas/ and each carrying a provenance envelope.
 *  - French text is copied verbatim. Nothing is corrected, rephrased or translated;
 *    translation is a later, human-reviewed step (ADR-025).
 *  - Counts are asserted. A mismatch prints the actual-vs-expected table and exits 1.
 *  - Idempotent: two runs over the same input produce byte-identical files.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { z } from 'zod';

import { SeedMeta } from './schemas/common';
import { CompanyFile } from './schemas/company';
import { ContactsFile } from './schemas/contacts';
import { DocumentsFile } from './schemas/documents';
import { HseFile } from './schemas/hse';
import { JobDescriptionFile } from './schemas/job-description';
import { KaizenFile } from './schemas/kaizen';
import { ManagementTeamFile } from './schemas/management-team';
import { OnboardingFile } from './schemas/onboarding';
import { OrganizationFile } from './schemas/organization';
import { QmsFile } from './schemas/qms';
import { RecruitmentFile } from './schemas/recruitment';
import { StrategyFile } from './schemas/strategy';
import { ValuesFile } from './schemas/values';
import { WelcomeFile } from './schemas/welcome';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_NAME = 'SOFICLEF_Onboarding_Directeur_Production_.html';
const SOURCE = join(HERE, 'source', SOURCE_NAME);
const OUT_DIR = join(HERE, 'data');

/* ────────────────────────────── parsing helpers ───────────────────────────── */

/** Collapse whitespace without touching the characters themselves. */
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Visible text of an element, whitespace-collapsed, entities decoded. */
const text = (el: Cheerio<Element>): string => clean(el.text());

/**
 * Split an element's inner HTML on <br>, strip the remaining tags and drop empty
 * lines. Used for the prototype's "<strong>Label :</strong> value<br>…" card bodies.
 */
function lines($: CheerioAPI, el: Cheerio<Element>): string[] {
  const html = el.html() ?? '';
  return html
    .split(/<br\s*\/?>/i)
    .map((chunk) => clean(cheerio.load(`<div>${chunk}</div>`)('div').text()))
    .filter((line) => line.length > 0);
}

/** Read "Label : value" lines into a map keyed by the label without its colon. */
function labelled($: CheerioAPI, el: Cheerio<Element>): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines($, el)) {
    const match = /^([^:]+?)\s*:\s*(.+)$/.exec(line);
    if (match) map.set(clean(match[1]), clean(match[2]));
  }
  return map;
}

/** Read a required label, failing loudly rather than guessing. */
function need(map: Map<string, string>, key: string, where: string): string {
  const value = map.get(key);
  if (value === undefined) {
    throw new ExtractionError(`missing "${key}" in ${where}`, [...map.keys()].join(' | '));
  }
  return value;
}

/**
 * The prototype prefixes some headings with a decorative emoji ("🏭 Structure
 * Fabrication"). The glyph is presentation, not label text, so it is separated into its
 * own field rather than being carried inside every French name.
 */
function splitIcon(raw: string): { icon: string | null; label: string } {
  const match = /^([\p{Extended_Pictographic}\u{FE0F}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]+)\s+(.*)$/u.exec(raw);
  return match ? { icon: match[1], label: clean(match[2]) } : { icon: null, label: raw };
}

/** Deterministic slug so re-runs produce identical identifiers. */
function slug(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  // A slug of purely non-Latin text would be empty; fall back to a content hash so
  // the identifier is still stable across runs.
  return base.length > 0 ? base : `x-${createHash('sha1').update(input).digest('hex').slice(0, 10)}`;
}

/** Sequentially numbered identifier, e.g. mission-permanente-03. */
const seqId = (prefix: string, index: number): string =>
  `${prefix}-${String(index + 1).padStart(2, '0')}`;

class ExtractionError extends Error {
  constructor(message: string, public readonly detail?: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/** Anything the parser cannot read confidently lands here and in CONTENT-INVENTORY.md. */
const needsManualReview: string[] = [];

/* ───────────────────────────── source & page access ───────────────────────── */

const html = readFileSync(SOURCE, 'utf8');
const $ = cheerio.load(html);

function page(id: string): Cheerio<Element> {
  const el = $(`#page-${id}`);
  if (el.length !== 1) throw new ExtractionError(`page #page-${id} not found`);
  return el as Cheerio<Element>;
}

/** Find the card whose .card-title matches, e.g. the Mission 3 action plan. */
function cardByTitle(scope: Cheerio<Element>, pattern: RegExp): Cheerio<Element> {
  const found = scope
    .find('.card')
    .filter((_, el) => pattern.test(clean($(el).find('.card-title').first().text())));
  if (found.length === 0) throw new ExtractionError(`no card matching ${pattern}`);
  return found.first() as Cheerio<Element>;
}

/** Rows of a table as arrays of cell text. */
function tableRows(scope: Cheerio<Element>): string[][] {
  return scope
    .find('tbody tr')
    .toArray()
    .map((tr) =>
      $(tr)
        .find('td')
        .toArray()
        .map((td) => text($(td) as Cheerio<Element>)),
    );
}

/** <li> texts of a mission-list, in document order. */
function listItems(scope: Cheerio<Element>): string[] {
  return scope
    .find('li')
    .toArray()
    .map((li) => text($(li) as Cheerio<Element>));
}

/* ─────────────────────────────── extractors ───────────────────────────────── */

function extractWelcome() {
  const p = page('bienvenue');
  const hero = p.find('.hero').first() as Cheerio<Element>;
  const messageParts = lines($, hero.find('.hero-msg').first() as Cheerio<Element>);
  if (messageParts.length < 2) {
    throw new ExtractionError('welcome message and signature not separable');
  }

  return {
    recipientFr: 'DJAOUDI Farid',
    recipientRoleFr: text(hero.find('.hero-title').first() as Cheerio<Element>),
    // The sidebar footer states the start date as 07.06.2026 (dd.mm.yyyy).
    startDate: '2026-06-07',
    startDateSourceFr: text($('.sidebar-footer .prise-poste').first() as Cheerio<Element>),
    greetingFr: text(hero.find('.hero-greeting').first() as Cheerio<Element>),
    messageFr: messageParts.slice(0, -1).join(' '),
    signatureFr: messageParts[messageParts.length - 1],
    stats: hero
      .find('.hero-stat')
      .toArray()
      .map((el) => {
        const stat = $(el) as Cheerio<Element>;
        const labelFr = text(stat.find('.lbl').first() as Cheerio<Element>);
        return {
          id: slug(labelFr),
          valueFr: text(stat.find('.val').first() as Cheerio<Element>),
          labelFr,
        };
      }),
    agenda: p
      .find('.agenda-item')
      .toArray()
      .map((el) => {
        const item = $(el) as Cheerio<Element>;
        const titleFr = text(item.find('.agenda-title').first() as Cheerio<Element>);
        return {
          id: slug(titleFr),
          titleFr,
          detailFr: text(item.find('.agenda-desc').first() as Cheerio<Element>),
        };
      }),
  };
}

function extractCompany() {
  const p = page('entreprise');
  const identity = labelled($, p.find('.card').eq(0).find('.card-body').first() as Cheerio<Element>);
  const visionMission = lines($, p.find('.card').eq(1).find('.card-body').first() as Cheerio<Element>);

  const visionIndex = visionMission.findIndex((l) => /^Vision\s*:/.test(l));
  const missionIndex = visionMission.findIndex((l) => /^Mission\s*:/.test(l));
  if (visionIndex < 0 || missionIndex < 0) {
    throw new ExtractionError('vision/mission labels not found on page "entreprise"');
  }

  const founded = need(identity, 'Fondée', 'company identity card'); // "1994 · Alger"
  const foundedMatch = /^(\d{4})\s*·\s*(.+)$/.exec(founded);
  if (!foundedMatch) throw new ExtractionError('unexpected "Fondée" format', founded);

  return {
    id: 'soficlef-sarl',
    legalName: 'SOFICLEF SARL',
    legalForm: need(identity, 'Forme', 'company identity card'),
    foundedYear: Number(foundedMatch[1]),
    foundedCity: foundedMatch[2],
    headquarters: need(identity, 'Siège', 'company identity card'),
    generalManager: need(identity, 'DG', 'company identity card'),
    certification: need(identity, 'Certification', 'company identity card'),
    status: need(identity, 'Statut', 'company identity card'),
    website: need(identity, 'Web', 'company identity card'),
    visionFr: visionMission.slice(visionIndex + 1, missionIndex).join(' '),
    missionFr: visionMission.slice(missionIndex + 1).join(' '),
    activities: p
      .find('.grid-3 .card')
      .toArray()
      .map((el) => {
        const card = $(el) as Cheerio<Element>;
        const labelFr = text(card.find('.card-title').first() as Cheerio<Element>);
        return {
          id: slug(labelFr),
          labelFr,
          contentFr: text(card.find('.card-body').first() as Cheerio<Element>),
        };
      }),
  };
}

/**
 * English value names come from CDC v1 §1.2, a client document — they are not a
 * translation produced here (ADR-025). The Arabic strings come from the prototype,
 * which is the good copy; CDC v1's PDF corrupts them (ADR-026, OQ-21).
 */
const VALUE_NAMES_EN_FROM_CDC_V1: Record<string, string> = {
  '01': 'Firmness & Respect',
  '02': 'Cooperation & Team Spirit',
  '03': 'Rigor & Excellence',
  '04': 'Innovation & Continuous Improvement',
};

function extractValues() {
  return page('entreprise')
    .find('.value-card')
    .toArray()
    .map((el) => {
      const card = $(el) as Cheerio<Element>;
      const num = text(card.find('.value-num').first() as Cheerio<Element>);
      const nameFr = text(card.find('.value-fr').first() as Cheerio<Element>);
      const nameEn = VALUE_NAMES_EN_FROM_CDC_V1[num] ?? null;
      if (nameEn === null) {
        needsManualReview.push(`Value ${num} "${nameFr}": no English name in CDC v1 §1.2`);
      }
      return {
        id: slug(nameFr),
        rank: Number(num),
        nameFr,
        // Verbatim, byte for byte. Do not normalise, reorder or re-encode.
        nameAr: card.find('.value-ar').first().text().trim(),
        nameEn,
      };
    });
}

function extractStrategy() {
  const p = page('strategie');
  const markets = tableRows(p.find('table').first() as Cheerio<Element>).map((cells) => {
    if (cells.length !== 4) throw new ExtractionError('market row is not 4 cells', cells.join(' | '));
    return {
      id: slug(cells[0]),
      marketFr: cells[0],
      strategyFr: cells[1],
      marketShareTargetFr: cells[2],
      revenueTargetFr: cells[3],
    };
  });

  const projects = p
    .find('.card')
    .toArray()
    .map((el) => $(el) as Cheerio<Element>)
    .filter((card) => /^PS-\d{2}\b/.test(clean(card.find('.card-title').first().text())))
    .map((card) => {
      const title = text(card.find('.card-title').first() as Cheerio<Element>);
      const match = /^(PS-\d{2})\s*—\s*(.+)$/.exec(title);
      if (!match) throw new ExtractionError('unexpected project title', title);
      return {
        code: match[1],
        titleFr: match[2],
        descriptionFr: text(card.find('.card-body').first() as Cheerio<Element>),
      };
    });

  const contributions = p
    .find('.prog-row')
    .toArray()
    .map((el) => {
      const row = $(el) as Cheerio<Element>;
      const label = row.find('.prog-label').first() as Cheerio<Element>;
      const targetFr = text(label.find('span').first() as Cheerio<Element>);
      const labelFr = clean(text(label).replace(targetFr, ''));
      const width = /width:\s*(\d+)%/.exec(row.find('.prog-fill').attr('style') ?? '');
      if (!width) throw new ExtractionError('progress width not readable', labelFr);
      return { id: slug(labelFr), labelFr, targetFr, progressPercent: Number(width[1]) };
    });

  return {
    planFr: text(p.find('.section-title').first() as Cheerio<Element>),
    globalObjectiveFr: text(p.find('.section-lead').first() as Cheerio<Element>),
    markets,
    projects,
    contributions,
  };
}

function extractJobDescription() {
  const p = page('poste');
  const positioning = labelled($, p.find('.card').eq(0).find('.card-body').first() as Cheerio<Element>);
  const requirements = labelled($, p.find('.card').eq(1).find('.card-body').first() as Cheerio<Element>);
  const listCards = p.find('.mission-list').toArray().map((el) => $(el) as Cheerio<Element>);
  if (listCards.length !== 3) {
    throw new ExtractionError('expected 3 lists on the job description page', String(listCards.length));
  }

  const asItems = (list: Cheerio<Element>, prefix: string) =>
    listItems(list).map((textFr, index) => ({ id: seqId(prefix, index), textFr }));

  return {
    code: 'EN-012-DRH' as const,
    jobTitleFr: 'Directeur de Production',
    // The prototype states "Date d'application 19.08.2018" (dd.mm.yyyy).
    applicationDate: '2018-08-19',
    applicationDateSourceFr: text(p.find('.section-lead').first() as Cheerio<Element>),
    positioning: {
      structureFr: need(positioning, 'Structure', 'job positioning card'),
      processFr: need(positioning, 'Processus', 'job positioning card'),
      reportsToFr: need(positioning, 'Hiérarchique', 'job positioning card'),
      subordinatesFr: need(positioning, 'Subordonnés', 'job positioning card'),
    },
    requirements: {
      educationFr: need(requirements, 'Formation', 'job requirements card'),
      additionalEducationFr: need(requirements, 'Complémentaire', 'job requirements card'),
      experienceFr: need(requirements, 'Expérience', 'job requirements card'),
      workPatternFr: need(requirements, 'Rythme', 'job requirements card'),
    },
    missions: asItems(listCards[0], 'mission'),
    permanentTasks: asItems(listCards[1], 'tache-permanente'),
    responsibilities: asItems(listCards[2], 'responsabilite'),
  };
}

function extractOrganization() {
  const p = page('structures');

  const structures = p
    .find('.struct-card')
    .toArray()
    .map((el) => {
      const card = $(el) as Cheerio<Element>;
      const { icon, label: nameFr } = splitIcon(
        text(card.find('.struct-name').first() as Cheerio<Element>),
      );
      const headLabelFr = text(card.find('.struct-badge').first() as Cheerio<Element>);
      const body = card.find('.card-body').first() as Cheerio<Element>;
      const critical = body.find('em').first();
      const criticalNoteFr = critical.length > 0 ? clean(critical.text()) : null;
      // The unit breakdown and the critical-post warning are stored as their own
      // records; the description keeps only what is not carried elsewhere.
      const unitLabels = listItems(body);
      const descriptionFr = lines($, body)
        .filter((line) => line !== criticalNoteFr)
        .filter((line) => !/^\d+ Unités de Production\s*:/.test(line))
        .filter((line) => !unitLabels.some((unit) => line.includes(unit)))
        .join(' ');
      return {
        id: slug(nameFr),
        icon,
        nameFr,
        descriptionFr,
        headOccupancy: /VACANT/i.test(headLabelFr) ? ('VACANT' as const) : ('OCCUPIED' as const),
        headLabelFr,
        criticalNoteFr,
      };
    });

  const fabrication = structures.find((s) => /Fabrication/i.test(s.nameFr));
  if (!fabrication) throw new ExtractionError('Structure Fabrication not found');

  const units = (p.find('.struct-card').first().find('.mission-list li').toArray() as Element[]).map(
    (el) => {
      const item = $(el) as Cheerio<Element>;
      const nameFr = clean(item.find('strong').first().text());
      return {
        id: slug(nameFr),
        parentStructureId: fabrication.id,
        nameFr,
        descriptionFr: clean(text(item).replace(nameFr, '').replace(/^\s*—\s*/, '')),
      };
    },
  );

  const cells = p
    .find('.grid-2 .card')
    .toArray()
    .map((el) => {
      const card = $(el) as Cheerio<Element>;
      const { icon, label: nameFr } = splitIcon(
        text(card.find('.card-title').first() as Cheerio<Element>),
      );
      const bodyLines = lines($, card.find('.card-body').first() as Cheerio<Element>);
      const staffing = bodyLines.find((l) => /^Effectif\s*:/.test(l));
      if (!staffing) throw new ExtractionError('cell staffing not found', nameFr);
      return {
        id: slug(nameFr),
        icon,
        nameFr,
        descriptionFr: bodyLines.filter((l) => l !== staffing).join(' '),
        staffingFr: staffing.replace(/^Effectif\s*:\s*/, ''),
      };
    });

  const director = p.find('.org-node.director').first() as Cheerio<Element>;
  const directorId = slug(clean(director.find('strong').text()));
  const orgChart = [
    {
      id: directorId,
      labelFr: clean(director.find('strong').text()),
      roleFr: text(director.find('.role').first() as Cheerio<Element>),
      occupancy: 'OCCUPIED' as const,
      parentId: null,
    },
    ...p
      .find('.org-node')
      .not('.director')
      .toArray()
      .map((el) => {
        const node = $(el) as Cheerio<Element>;
        const roleFr = text(node.find('.role').first() as Cheerio<Element>);
        const labelFr = clean(text(node).replace(roleFr, ''));
        return {
          id: slug(labelFr),
          labelFr,
          roleFr,
          occupancy: /VACANT/i.test(roleFr)
            ? ('VACANT' as const)
            : /pourvoir/i.test(roleFr)
              ? ('TO_FILL' as const)
              : null,
          parentId: directorId,
        };
      }),
  ];

  return {
    directorateFr: text(p.find('.section-title').first() as Cheerio<Element>),
    summaryFr: text(p.find('.section-lead').first() as Cheerio<Element>),
    structures,
    units,
    cells,
    orgChart,
  };
}

function extractManagementTeam() {
  const p = page('encadrement');
  const priorities = new Map(
    tableRows(p.find('table').first() as Cheerio<Element>).map((cells) => [cells[0], cells[2]]),
  );

  const members = p
    .find('.contact-card')
    .toArray()
    .map((el) => {
      const card = $(el) as Cheerio<Element>;
      const nameFr = text(card.find('.contact-name').first() as Cheerio<Element>);
      const priorityJ30Fr = priorities.get(nameFr);
      if (!priorityJ30Fr) throw new ExtractionError('no J+30 priority row for member', nameFr);
      const perimeterRow = tableRows(p.find('table').first() as Cheerio<Element>).find(
        (cells) => cells[0] === nameFr,
      );
      return {
        id: slug(nameFr),
        initials: text(card.find('.contact-avatar').first() as Cheerio<Element>),
        nameFr,
        roleFr: text(card.find('.contact-role').first() as Cheerio<Element>),
        scopeFr: text(card.find('.contact-phone').first() as Cheerio<Element>),
        tagFr: text(card.find('.contact-prio').first() as Cheerio<Element>),
        perimeterFr: perimeterRow ? perimeterRow[1] : '',
        priorityJ30Fr,
      };
    });

  const recommendedActions = listItems(
    cardByTitle(p, /Actions recommandées/) as Cheerio<Element>,
  ).map((raw, index) => {
    const match = /^J\+(\d+)\s*:\s*(.+)$/.exec(raw);
    if (!match) throw new ExtractionError('unexpected recommended action format', raw);
    return {
      id: seqId('rencontre', index),
      dayOffset: Number(match[1]),
      dayLabelFr: `J+${match[1]}`,
      textFr: match[2],
    };
  });

  return { members, recommendedActions };
}

function extractRecruitment() {
  const p = page('recrutements');
  const positions = tableRows(p.find('table').first() as Cheerio<Element>).map((cells) => ({
    id: slug(cells[0]),
    titleFr: cells[0],
    attachmentFr: cells[1],
    statusFr: cells[2],
  }));

  const mobility = lines($, cardByTitle(p, /Mobilités internes/).find('.card-body').first() as Cheerio<Element>);
  const recommended = mobility.find((l) => /^Action recommandée/.test(l));
  if (!recommended) throw new ExtractionError('internal mobility recommended action not found');

  return {
    positions,
    internalMobilityNoteFr: mobility.filter((l) => l !== recommended).join(' '),
    recommendedActionFr: recommended,
  };
}

function extractKaizen() {
  const p = page('kaizen');
  const grids = p.find('.grid-2').toArray().map((el) => $(el) as Cheerio<Element>);
  if (grids.length !== 2) throw new ExtractionError('expected 2 mission summary grids');

  const missionSpecs = [
    {
      number: 1,
      titlePattern: /Mission 1\b/,
      grid: grids[0],
      resultsTitle: /Résultats atteints/,
      journalTitle: /Journal de Mission — Semaine/,
      gapsTitle: /Tableau des écarts — Mission 1/,
      planTitle: /^Plan d'actions — Mission 1/,
    },
    {
      number: 3,
      titlePattern: /Mission 3\b/,
      grid: grids[1],
      resultsTitle: /Résultats de la mission/,
      journalTitle: /Journal de Mission — Du/,
      gapsTitle: /Tableau des écarts — Mission 3/,
      planTitle: /Plan d'actions consolidé — Mission 3/,
    },
  ];

  const missions = [];
  const actions = [];

  for (const spec of missionSpecs) {
    const heading = p
      .find('.section-title')
      .toArray()
      .map((el) => $(el) as Cheerio<Element>)
      .find((el) => spec.titlePattern.test(text(el)));
    if (!heading) throw new ExtractionError(`mission ${spec.number} heading not found`);

    const contextCard = spec.grid.find('.card').eq(0) as Cheerio<Element>;
    const contextLines = lines($, contextCard.find('.card-body').first() as Cheerio<Element>);
    const contextMap = labelled($, contextCard.find('.card-body').first() as Cheerio<Element>);
    const narrative = contextLines.filter((l) => !/^(Période|Projet|Référence|Pilote interne)\s*:/.test(l));

    const missionId = `kaizen-mission-${spec.number}`;
    const { icon, label: titleFr } = splitIcon(text(heading));
    missions.push({
      id: missionId,
      number: spec.number,
      icon,
      titleFr,
      periodFr: need(contextMap, 'Période', `mission ${spec.number} context card`),
      referenceFr: contextMap.get('Référence') ?? null,
      internalLeadFr: need(contextMap, 'Pilote interne', `mission ${spec.number} context card`),
      contextFr: narrative.join(' '),
      results: listItems(cardByTitle(spec.grid, spec.resultsTitle)).map((textFr, index) => ({
        id: `${missionId}-resultat-${String(index + 1).padStart(2, '0')}`,
        textFr,
      })),
      journal: tableRows(cardByTitle(p, spec.journalTitle)).map((cells, index) => ({
        id: `${missionId}-journal-${String(index + 1).padStart(2, '0')}`,
        dayFr: cells[0],
        activitiesFr: cells[1],
        outcomeFr: cells[2],
      })),
      gaps: tableRows(cardByTitle(p, spec.gapsTitle)).map((cells, index) => ({
        id: `${missionId}-ecart-${String(index + 1).padStart(2, '0')}`,
        domainFr: cells[0],
        observedFr: cells[1],
        targetFr: cells[2],
      })),
    });

    for (const [index, cells] of tableRows(cardByTitle(p, spec.planTitle)).entries()) {
      if (cells.length !== 4) throw new ExtractionError('action row is not 4 cells', cells.join(' | '));
      actions.push({
        id: `${missionId}-action-${String(index + 1).padStart(2, '0')}`,
        missionId,
        actionFr: cells[0],
        ownerFr: cells[1],
        deadlineFr: cells[2],
        statusFr: cells[3],
      });
    }
  }

  const priorityActionsJ30 = listItems(cardByTitle(p, /Actions prioritaires J\+30/)).map(
    (raw, index) => {
      const match = /^(J\+\d+)\s*:\s*(.+)$/.exec(raw);
      if (!match) throw new ExtractionError('unexpected J+30 priority format', raw);
      return { id: seqId('kaizen-priorite', index), dayLabelFr: match[1], textFr: match[2] };
    },
  );

  return {
    programmeFr: text(cardByTitle(p, /Programme d'Excellence Opérationnelle/).find('.card-body').first() as Cheerio<Element>),
    internalLeadFr: 'FOUFOU Nadjib',
    missions,
    actions,
    priorityActionsJ30,
  };
}

function extractQms() {
  const p = page('smq');
  const certification = labelled($, p.find('.card').eq(1).find('.card-body').first() as Cheerio<Element>);

  const processes = p
    .find('.process-block')
    .toArray()
    .map((el) => {
      const block = $(el) as Cheerio<Element>;
      const categoryLabelFr = text(block.find('.tag').first() as Cheerio<Element>);
      const code = text(block.find('.process-code').first() as Cheerio<Element>);
      const rawName = text(block.find('.process-name').first() as Cheerio<Element>);
      const isOwned = /Votre processus/i.test(rawName);
      const category =
        categoryLabelFr === 'Management'
          ? ('MANAGEMENT' as const)
          : categoryLabelFr === 'Réalisation'
            ? ('REALISATION' as const)
            : ('SUPPORT' as const);
      return {
        code,
        category,
        categoryLabelFr,
        nameFr: clean(rawName.replace(/←.*$/, '')),
        isOwnedByProductionDirector: isOwned,
      };
    });

  return {
    standardFr: need(certification, 'Norme', 'QMS certification card'),
    certificationBodyFr: need(certification, 'Organisme', 'QMS certification card'),
    certifiedSinceFr: need(certification, 'Depuis', 'QMS certification card'),
    certificationScopeFr: need(certification, 'Périmètre', 'QMS certification card'),
    ownedProcessCode: 'PR02' as const,
    ownedProcessNoteFr: text(p.find('.card').eq(0).find('.card-body').first() as Cheerio<Element>),
    processMapCode: 'ID-03-DG' as const,
    responsibilities: listItems(
      p.find('.card').eq(2) as Cheerio<Element>,
    ).map((textFr, index) => ({ id: seqId('smq-responsabilite', index), textFr })),
    processes,
  };
}

function extractHse() {
  const p = page('hse');
  const zonesCard = cardByTitle(p, /Bâtiments & zones principales/);
  const zoneLines = lines($, zonesCard.find('.card-body').first() as Cheerio<Element>);
  const riskLine = zoneLines.find((l) => /Zone haute tension/.test(l));
  const planLine = zoneLines.find((l) => /plan de circulation/i.test(l));
  if (!riskLine || !planLine) throw new ExtractionError('HSE risk area or circulation plan note not found');

  return {
    siteFr: text(p.find('.section-lead').first() as Cheerio<Element>),
    contactFr: 'MAKHNACHE Mohamed — Poste 123',
    trafficRules: listItems(cardByTitle(p, /Règles de circulation/)).map((textFr, index) => ({
      id: seqId('hse-circulation', index),
      textFr,
    })),
    mandatoryPpe: listItems(cardByTitle(p, /EPI obligatoires/)).map((textFr, index) => ({
      id: seqId('hse-epi', index),
      textFr,
    })),
    zonesFr: zoneLines[0],
    riskAreaFr: riskLine,
    circulationPlanNoteFr: planLine,
  };
}

function extractOnboarding() {
  return page('checklist')
    .find('.check-item')
    .toArray()
    .map((el, index) => {
      const item = $(el) as Cheerio<Element>;
      const dayLabelFr = text(item.find('.check-day').first() as Cheerio<Element>);
      const body = item.find('.check-text').first() as Cheerio<Element>;
      const titleFr = clean(body.find('strong').first().text());
      const detailFr = clean(text(body).replace(titleFr, '').replace(/^\s*—\s*/, ''));
      const dayMatch = /^J\+(\d+)$/.exec(dayLabelFr);
      if (!dayMatch) throw new ExtractionError('unexpected checklist day label', dayLabelFr);
      return {
        id: seqId('jalon', index),
        order: index + 1,
        dayLabelFr,
        dayOffset: Number(dayMatch[1]),
        titleFr,
        detailFr,
        isRecommended: item.find('.check-recmd').length > 0,
      };
    });
}

function extractContacts() {
  return page('interlocuteurs')
    .find('.contact-card')
    .toArray()
    .map((el) => {
      const card = $(el) as Cheerio<Element>;
      const phone = text(card.find('.contact-phone').first() as Cheerio<Element>);
      const extension = /(\d{3})/.exec(phone);
      if (!extension) throw new ExtractionError('no extension in contact', phone);
      const priorityFr = text(card.find('.contact-prio').first() as Cheerio<Element>);
      return {
        id: `poste-${extension[1]}`,
        extension: extension[1],
        initials: text(card.find('.contact-avatar').first() as Cheerio<Element>),
        nameFr: text(card.find('.contact-name').first() as Cheerio<Element>),
        roleFr: text(card.find('.contact-role').first() as Cheerio<Element>),
        priorityFr,
        priorityRank: priorityFr.startsWith('S1') ? ('S1' as const) : ('S2' as const),
      };
    });
}

function extractDocuments() {
  const p = page('docs');
  const available = p
    .find('.doc-item')
    .toArray()
    .map((el) => {
      const item = $(el) as Cheerio<Element>;
      const onclick = item.attr('onclick') ?? '';
      const fileMatch = /openDoc\('([^']+)'\)/.exec(onclick);
      if (!fileMatch) throw new ExtractionError('document file name not readable', onclick);
      return {
        id: slug(fileMatch[1].replace(/\.pdf$/i, '')),
        fileName: fileMatch[1],
        titleFr: text(item.find('.doc-name').first() as Cheerio<Element>),
        detailFr: text(item.find('.doc-size').first() as Cheerio<Element>),
        availability: 'AVAILABLE' as const,
      };
    });

  const pending = listItems(cardByTitle(p, /Documents à intégrer ultérieurement/)).map((titleFr) => ({
    id: slug(titleFr),
    titleFr,
    availability: 'PENDING' as const,
  }));

  return { available, pending };
}

/* ─────────────────────────────── writing & counts ─────────────────────────── */

type PageId = z.infer<typeof SeedMeta>['sourcePages'][number];

function write<T extends z.ZodTypeAny>(
  fileName: string,
  domain: string,
  sourcePages: PageId[],
  schema: T,
  data: unknown,
  count: number,
): void {
  const parsed = schema.safeParse({
    meta: { domain, sourceFile: SOURCE_NAME, sourcePages, extractedCount: count },
    data,
  });
  if (!parsed.success) {
    console.error(`\n✖ ${fileName} failed validation:\n`);
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, fileName), `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
}

interface Check {
  domain: string;
  expected: number;
  actual: number;
  note?: string;
}

function main(): void {
  const welcome = extractWelcome();
  const company = extractCompany();
  const values = extractValues();
  const strategy = extractStrategy();
  const jobDescription = extractJobDescription();
  const organization = extractOrganization();
  const managementTeam = extractManagementTeam();
  const recruitment = extractRecruitment();
  const kaizen = extractKaizen();
  const qms = extractQms();
  const hse = extractHse();
  const onboarding = extractOnboarding();
  const contacts = extractContacts();
  const documents = extractDocuments();

  write('welcome.json', 'welcome', ['bienvenue'], WelcomeFile, welcome, 1);
  write('company.json', 'company', ['entreprise'], CompanyFile, company, 1);
  write('values.json', 'values', ['entreprise'], ValuesFile, values, values.length);
  write('strategy.json', 'strategy', ['strategie'], StrategyFile, strategy, strategy.markets.length);
  write('job-description.json', 'job-description', ['poste'], JobDescriptionFile, jobDescription, 1);
  write('organization.json', 'organization', ['structures'], OrganizationFile, organization, organization.structures.length);
  write('management-team.json', 'management-team', ['encadrement'], ManagementTeamFile, managementTeam, managementTeam.members.length);
  write('recruitment.json', 'recruitment', ['recrutements'], RecruitmentFile, recruitment, recruitment.positions.length);
  write('kaizen.json', 'kaizen', ['kaizen'], KaizenFile, kaizen, kaizen.actions.length);
  write('qms.json', 'qms', ['smq'], QmsFile, qms, 1);
  write('hse.json', 'hse', ['hse'], HseFile, hse, 1);
  write('onboarding-checklist.json', 'onboarding-checklist', ['checklist'], OnboardingFile, onboarding, onboarding.length);
  write('contacts.json', 'contacts', ['interlocuteurs'], ContactsFile, contacts, contacts.length);
  write('documents.json', 'documents', ['docs'], DocumentsFile, documents, documents.available.length + documents.pending.length);

  // Expected counts are the build brief's content inventory. The one deliberate
  // divergence is the Kaizen action count — see ADR-028 and OQ-23.
  const checks: Check[] = [
    { domain: 'Company — identity record', expected: 1, actual: 1 },
    { domain: 'Values — trilingual pillars', expected: 4, actual: values.length },
    { domain: 'Strategy — market table rows', expected: 5, actual: strategy.markets.length },
    { domain: 'Strategy — strategic projects PS-01…PS-04', expected: 4, actual: strategy.projects.length },
    { domain: 'Job description — EN-012-DRH', expected: 1, actual: 1 },
    { domain: 'Job description — permanent tasks', expected: 14, actual: jobDescription.permanentTasks.length },
    { domain: 'Org — structures', expected: 3, actual: organization.structures.length },
    { domain: 'Org — production units', expected: 2, actual: organization.units.length },
    { domain: 'Org — functional cells', expected: 2, actual: organization.cells.length },
    { domain: 'Management team — structure heads', expected: 4, actual: managementTeam.members.length },
    { domain: 'Recruitment — open posts', expected: 4, actual: recruitment.positions.length },
    { domain: 'Kaizen — documented missions', expected: 2, actual: kaizen.missions.length },
    {
      domain: 'Kaizen — tracked actions',
      expected: 17,
      actual: kaizen.actions.length,
      note: 'brief expects 5 (CDC v1 §3.5 condensed table); prototype carries 17 — ADR-028, OQ-23',
    },
    { domain: 'QMS — process ownership record', expected: 1, actual: 1 },
    { domain: 'QMS — mapped processes', expected: 10, actual: qms.processes.length },
    { domain: 'HSE — site rules record', expected: 1, actual: 1 },
    { domain: 'Onboarding — checklist milestones', expected: 12, actual: onboarding.length },
    { domain: 'Contacts — internal directory', expected: 10, actual: contacts.length },
    { domain: 'Documents — available', expected: 9, actual: documents.available.length },
    { domain: 'Documents — pending', expected: 7, actual: documents.pending.length },
  ];

  // The milestone sequence is part of the contract, not just the count.
  const expectedDays = [1, 1, 2, 3, 3, 5, 7, 8, 10, 15, 20, 30];
  const actualDays = onboarding.map((m) => m.dayOffset);
  const daysMatch = JSON.stringify(expectedDays) === JSON.stringify(actualDays);
  const lastIsRecommended = onboarding[onboarding.length - 1]?.isRecommended === true;

  const width = Math.max(...checks.map((c) => c.domain.length));
  console.log('\nSOFICLEF — extraction from the HTML prototype\n');
  console.log(`  ${'Domain'.padEnd(width)}  expected  actual  status`);
  console.log(`  ${'-'.repeat(width)}  --------  ------  ------`);
  let failed = 0;
  for (const check of checks) {
    const ok = check.expected === check.actual;
    if (!ok) failed += 1;
    console.log(
      `  ${check.domain.padEnd(width)}  ${String(check.expected).padStart(8)}  ${String(check.actual).padStart(6)}  ${ok ? 'ok' : 'MISMATCH'}${check.note ? `\n  ${' '.repeat(width)}  note: ${check.note}` : ''}`,
    );
  }

  console.log(
    `\n  Milestone sequence J+${expectedDays.join(', J+')}  ${daysMatch ? 'ok' : `MISMATCH → J+${actualDays.join(', J+')}`}`,
  );
  console.log(`  J+30 flagged "Recommandé"${' '.repeat(19)}  ${lastIsRecommended ? 'ok' : 'MISMATCH'}`);

  if (needsManualReview.length > 0) {
    console.log('\n  Needs manual review (see docs/CONTENT-INVENTORY.md):');
    for (const item of needsManualReview) console.log(`   - ${item}`);
  }

  if (failed > 0 || !daysMatch || !lastIsRecommended) {
    console.error(`\n✖ extraction failed: ${failed} count mismatch(es).\n`);
    process.exit(1);
  }
  console.log(`\n✔ 14 files written to seed/data/ — every count matches.\n`);
}

try {
  main();
} catch (error) {
  if (error instanceof ExtractionError) {
    console.error(`\n✖ ${error.message}${error.detail ? `\n  detail: ${error.detail}` : ''}\n`);
    process.exit(1);
  }
  throw error;
}
