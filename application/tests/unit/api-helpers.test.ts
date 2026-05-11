import { describe, it, expect } from 'vitest';
import { resolveCareerStage } from '@/lib/api';
import type { CareerStage } from '@/types';

describe('resolveCareerStage', () => {
  const stages: CareerStage[] = [
    { code: 'intern', name: 'Intern', minNumeric: 0 },
    { code: 'fresher', name: 'Fresher', minNumeric: 15 },
    { code: 'junior', name: 'Junior', minNumeric: 33 },
    { code: 'mid', name: 'Mid', minNumeric: 55 },
    { code: 'senior', name: 'Senior', minNumeric: 75 },
    { code: 'tech_lead', name: 'Senior Tech Lead', minNumeric: 92 },
  ];

  it('returns Intern at 0%', () => {
    expect(resolveCareerStage(0, stages)?.code).toBe('intern');
  });
  it('returns Fresher at 20%', () => {
    expect(resolveCareerStage(20, stages)?.code).toBe('fresher');
  });
  it('returns Junior at exactly 33%', () => {
    expect(resolveCareerStage(33, stages)?.code).toBe('junior');
  });
  it('returns Senior at 80%', () => {
    expect(resolveCareerStage(80, stages)?.code).toBe('senior');
  });
  it('returns Tech Lead at 100%', () => {
    expect(resolveCareerStage(100, stages)?.code).toBe('tech_lead');
  });
  it('ignores unordered input', () => {
    const shuffled = [...stages].reverse();
    expect(resolveCareerStage(50, shuffled)?.code).toBe('junior');
  });
});
