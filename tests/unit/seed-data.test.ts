import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CompanyFile } from '@seed/schemas/company';
import { ContactsFile } from '@seed/schemas/contacts';
import { DocumentsFile } from '@seed/schemas/documents';
import { HseFile } from '@seed/schemas/hse';
import { JobDescriptionFile } from '@seed/schemas/job-description';
import { KaizenFile } from '@seed/schemas/kaizen';
import { ManagementTeamFile } from '@seed/schemas/management-team';
import { OnboardingFile } from '@seed/schemas/onboarding';
import { OrganizationFile } from '@seed/schemas/organization';
import { QmsFile } from '@seed/schemas/qms';
import { RecruitmentFile } from '@seed/schemas/recruitment';
import { StrategyFile } from '@seed/schemas/strategy';
import { ValuesFile } from '@seed/schemas/values';
import { WelcomeFile } from '@seed/schemas/welcome';

/**
 * The extractor validates its own output, but the committed data can be hand-edited
 * afterwards. This suite re-validates what is actually in the repository, so a manual
 * "small fix" to a JSON file fails CI instead of reaching the seed.
 */
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../seed/data/${name}`, import.meta.url), 'utf8'));

const FILES = [
  ['welcome.json', WelcomeFile],
  ['company.json', CompanyFile],
  ['values.json', ValuesFile],
  ['strategy.json', StrategyFile],
  ['job-description.json', JobDescriptionFile],
  ['organization.json', OrganizationFile],
  ['management-team.json', ManagementTeamFile],
  ['recruitment.json', RecruitmentFile],
  ['kaizen.json', KaizenFile],
  ['qms.json', QmsFile],
  ['hse.json', HseFile],
  ['onboarding-checklist.json', OnboardingFile],
  ['contacts.json', ContactsFile],
  ['documents.json', DocumentsFile],
] as const;

describe('extracted seed data', () => {
  for (const [name, schema] of FILES) {
    it(`${name} matches its schema`, () => {
      const result = schema.safeParse(read(name));
      expect(result.success ? [] : result.error.issues.map((i) => i.path.join('.'))).toEqual([]);
    });
  }

  it('keeps the content inventory counts', () => {
    const values = ValuesFile.parse(read('values.json')).data;
    const strategy = StrategyFile.parse(read('strategy.json')).data;
    const organization = OrganizationFile.parse(read('organization.json')).data;
    const kaizen = KaizenFile.parse(read('kaizen.json')).data;
    const documents = DocumentsFile.parse(read('documents.json')).data;

    expect(values).toHaveLength(4);
    expect(strategy.markets).toHaveLength(5);
    expect(strategy.projects).toHaveLength(4);
    expect(organization.structures).toHaveLength(3);
    expect(organization.units).toHaveLength(2);
    expect(organization.cells).toHaveLength(2);
    expect(ManagementTeamFile.parse(read('management-team.json')).data.members).toHaveLength(4);
    expect(RecruitmentFile.parse(read('recruitment.json')).data.positions).toHaveLength(4);
    expect(kaizen.missions).toHaveLength(2);
    // 17, not the brief's 5 — ADR-028, OQ-23.
    expect(kaizen.actions).toHaveLength(17);
    expect(ContactsFile.parse(read('contacts.json')).data).toHaveLength(10);
    expect(documents.available).toHaveLength(9);
    expect(documents.pending).toHaveLength(7);
  });

  it('keeps the 12 onboarding milestones in order, J+30 flagged as recommended', () => {
    const milestones = OnboardingFile.parse(read('onboarding-checklist.json')).data;
    expect(milestones.map((m) => m.dayOffset)).toEqual([1, 1, 2, 3, 3, 5, 7, 8, 10, 15, 20, 30]);
    expect(milestones.at(-1)?.isRecommended).toBe(true);
    expect(milestones.filter((m) => m.isRecommended)).toHaveLength(1);
  });

  it('keeps the Arabic value strings exactly as the prototype carries them', () => {
    const values = ValuesFile.parse(read('values.json')).data;
    expect(values.map((v) => v.nameAr)).toEqual([
      'الحزم والاحترام',
      'التعاون وروح الفريق',
      'الرشادة والإتقان',
      'الابتكار والتطوير المستمر',
    ]);
  });

  it('leaves the three structure heads vacant, as the prototype states', () => {
    const organization = OrganizationFile.parse(read('organization.json')).data;
    expect(organization.structures.map((s) => s.headOccupancy)).toEqual([
      'VACANT',
      'VACANT',
      'VACANT',
    ]);
  });

  it('keeps the job description business code and its 14 permanent tasks', () => {
    const job = JobDescriptionFile.parse(read('job-description.json')).data;
    expect(job.code).toBe('EN-012-DRH');
    expect(job.permanentTasks).toHaveLength(14);
    expect(job.applicationDate).toBe('2018-08-19');
  });
});
