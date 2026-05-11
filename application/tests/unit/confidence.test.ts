import { describe, it, expect } from 'vitest';
import {
  computeConfidenceFromGrades,
  EVIDENCE_WEIGHTS,
  VERIFIED_MIN_SCORE,
  type ConfidenceInputGrade,
} from '@/lib/evidence/confidence';

describe('computeConfidenceFromGrades', () => {
  it('returns zero + self_claimed when there are no grades', () => {
    const r = computeConfidenceFromGrades([]);
    expect(r.score).toBe(0);
    expect(r.source).toBe('self_claimed');
  });

  it('with only a lab returns lab score and source=learned', () => {
    const r = computeConfidenceFromGrades([{ kind: 'lab', score: 80 }]);
    // single kind => weighted avg collapses to that kind's mean
    expect(r.score).toBe(80);
    expect(r.source).toBe('learned');
  });

  it('averages multiple grades within the same kind before weighting', () => {
    const grades: ConfidenceInputGrade[] = [
      { kind: 'lab', score: 60 },
      { kind: 'lab', score: 100 }, // avg = 80
    ];
    const r = computeConfidenceFromGrades(grades);
    expect(r.score).toBe(80);
  });

  it('applies weighted average across kinds (lab + project)', () => {
    // lab=80 (w=0.3), project=90 (w=0.4)
    // weighted sum = 80*0.3 + 90*0.4 = 24 + 36 = 60
    // weight     = 0.3 + 0.4 = 0.7
    // score      = 60 / 0.7 ≈ 85.71 -> rounds to 86
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: 80 },
      { kind: 'project', score: 90 },
    ]);
    expect(r.score).toBe(86);
    expect(r.source).toBe('learned'); // no manager_review
  });

  it('does NOT mark verified when score >= 70 but no manager_review', () => {
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: 90 },
      { kind: 'project', score: 90 },
      { kind: 'peer_review', score: 90 },
    ]);
    expect(r.score).toBeGreaterThanOrEqual(VERIFIED_MIN_SCORE);
    expect(r.source).toBe('learned');
  });

  it('marks verified when manager_review present AND score >= 70', () => {
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: 80 },
      { kind: 'project', score: 80 },
      { kind: 'manager_review', score: 90 },
    ]);
    expect(r.score).toBeGreaterThanOrEqual(VERIFIED_MIN_SCORE);
    expect(r.source).toBe('verified');
  });

  it('does NOT mark verified when manager_review present but aggregate < 70', () => {
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: 30 },
      { kind: 'project', score: 40 },
      { kind: 'manager_review', score: 50 },
    ]);
    expect(r.score).toBeLessThan(VERIFIED_MIN_SCORE);
    expect(r.source).toBe('learned');
  });

  it('clamps out-of-range scores to [0,100]', () => {
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: -50 },
      { kind: 'project', score: 250 },
    ]);
    // lab clamped to 0, project clamped to 100
    // weighted: 0*0.3 + 100*0.4 = 40 ; /0.7 = 57.14 -> 57
    expect(r.score).toBe(57);
  });

  it('weights sum to 1.0 across all kinds', () => {
    const sum =
      EVIDENCE_WEIGHTS.lab +
      EVIDENCE_WEIGHTS.project +
      EVIDENCE_WEIGHTS.peer_review +
      EVIDENCE_WEIGHTS.manager_review;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('with all four kinds at the same score, returns that score', () => {
    const r = computeConfidenceFromGrades([
      { kind: 'lab', score: 75 },
      { kind: 'project', score: 75 },
      { kind: 'peer_review', score: 75 },
      { kind: 'manager_review', score: 75 },
    ]);
    expect(r.score).toBe(75);
    expect(r.source).toBe('verified'); // has manager + score>=70
  });
});
