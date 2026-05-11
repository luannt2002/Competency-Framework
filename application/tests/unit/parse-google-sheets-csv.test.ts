import { describe, it, expect } from 'vitest';
import {
  parseSkillsSheetCsv,
  parseLevelsSheetCsv,
} from '@/lib/etl/parse-google-sheets-csv';

describe('parseSkillsSheetCsv', () => {
  it('groups skills by category and slugs them', () => {
    const csv = [
      'Category,Skill,Description,Tags,Display Order',
      'AWS,IAM Deep,Identity policies,"security,aws",0',
      'AWS,VPC Networking,,"network,aws",1',
      'Terraform / IaC,Module Design,,iac,0',
    ].join('\n');
    const out = parseSkillsSheetCsv(csv);
    expect(out.categories.length).toBe(2);
    expect(out.skillCount).toBe(3);
    const aws = out.categories.find((c) => c.name === 'AWS');
    expect(aws?.slug).toBe('aws');
    expect(aws?.skills.length).toBe(2);
    expect(aws?.skills[0]?.slug).toBe('iam-deep');
    expect(aws?.skills[0]?.tags).toEqual(['security', 'aws']);
    expect(aws?.skills[1]?.description).toBeNull();
  });

  it('throws INGESTION_VALIDATION_FAILED on bad row', () => {
    const csv = ['Category,Skill', 'AWS,'].join('\n');
    expect(() => parseSkillsSheetCsv(csv)).toThrow(/INGESTION_VALIDATION_FAILED/);
  });
});

describe('parseLevelsSheetCsv', () => {
  it('parses 4 levels with numeric values', () => {
    const csv = [
      'Code,Label,Numeric,Description,Examples',
      'XS,Intern · Foundational,0,Reads docs,Follow guide',
      'S,Junior · Working,33,Works with help,Ship feature',
      'M,Mid · Strong,66,Production solo,Design service',
      'L,Senior · Expert,100,Sets direction,Platform initiative',
    ].join('\n');
    const out = parseLevelsSheetCsv(csv);
    expect(out.levels.length).toBe(4);
    expect(out.levels[0]?.code).toBe('XS');
    expect(out.levels[0]?.numericValue).toBe(0);
    expect(out.levels[3]?.numericValue).toBe(100);
    expect(out.levels[0]?.color).toBe('#64748B');
  });

  it('throws on non-numeric Numeric', () => {
    const csv = ['Code,Label,Numeric', 'XS,Intern,not-a-number'].join('\n');
    expect(() => parseLevelsSheetCsv(csv)).toThrow(/INGESTION_VALIDATION_FAILED/);
  });
});
