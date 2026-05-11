import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseMarkdownPhase } from '@/lib/etl/parse-markdown-roadmap';

const ROOT = resolve(__dirname, '../../..');

const PHASE1 = resolve(ROOT, '02_PHASE1_AWS_TERRAFORM_DEEP_DIVE_Q1.md');
const PHASE2 = resolve(ROOT, '03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md');
const PHASE3 = resolve(ROOT, '04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md');
const PHASE4 = resolve(ROOT, '05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md');

describe('parseMarkdownPhase', () => {
  it('parses Phase 1 (Q1) → XS', () => {
    const p = parseMarkdownPhase(PHASE1);
    expect(p.quarter).toBe('Q1');
    expect(p.levelCode).toBe('XS');
    expect(p.phaseTitle).toContain('AWS');
    expect(p.weeks.length).toBe(12);
    // Index normalised to 1..12 even though raw headings say WEEK 1..12.
    expect(p.weeks[0]?.index).toBe(1);
    expect(p.weeks[11]?.index).toBe(12);
  });

  it('parses Phase 2 (Q2) → S with weeks 13..24 normalised to 1..12', () => {
    const p = parseMarkdownPhase(PHASE2);
    expect(p.quarter).toBe('Q2');
    expect(p.levelCode).toBe('S');
    expect(p.weeks.length).toBe(12);
    expect(p.weeks[0]?.index).toBe(1);
    expect(p.weeks[11]?.index).toBe(12);
  });

  it('parses Phase 3 (Q3) → M', () => {
    const p = parseMarkdownPhase(PHASE3);
    expect(p.quarter).toBe('Q3');
    expect(p.levelCode).toBe('M');
    expect(p.weeks.length).toBe(12);
  });

  it('parses Phase 4 (Q4) → L', () => {
    const p = parseMarkdownPhase(PHASE4);
    expect(p.quarter).toBe('Q4');
    expect(p.levelCode).toBe('L');
    expect(p.weeks.length).toBe(12);
  });

  it('extracts week sections — main topics, labs, resources', () => {
    const p = parseMarkdownPhase(PHASE1);
    const w1 = p.weeks[0];
    expect(w1).toBeDefined();
    if (!w1) return;
    expect(w1.title).toMatch(/Setup|AWS|IAM/i);
    expect(w1.mainTopics.length).toBeGreaterThan(0);
    expect(w1.labs.length).toBeGreaterThanOrEqual(2);
    // Lab titles should be normalised (no trailing **, no emoji-only)
    for (const lab of w1.labs) {
      expect(lab.title).toMatch(/^(Lab|Tool|Capstone|Final|Major)/i);
      expect(lab.title.endsWith('**')).toBe(false);
    }
    expect(w1.resources.length).toBeGreaterThan(0);
  });

  it('does not fabricate summary when sections are empty', () => {
    const p = parseMarkdownPhase(PHASE1);
    for (const w of p.weeks) {
      // summary is derived from mainTopics — it is allowed to be empty,
      // but if main topics exist it must be a non-empty join.
      if (w.mainTopics.length > 0) {
        expect(w.summary.length).toBeGreaterThan(0);
      } else {
        expect(w.summary).toBe('');
      }
    }
  });
});
