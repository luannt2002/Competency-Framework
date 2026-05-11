import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { frameworkPayloadSchema } from '@/lib/framework/payload-schema';

describe('devops.json seed', () => {
  const path = resolve(__dirname, '../../drizzle/seeds/devops.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8'));

  it('parses against the payload schema', () => {
    const parsed = frameworkPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(parsed.error.format());
    }
    expect(parsed.success).toBe(true);
  });

  it('has 4 levels (XS/S/M/L)', () => {
    expect(raw.levels).toHaveLength(4);
    expect(raw.levels.map((l: { code: string }) => l.code)).toEqual(['XS', 'S', 'M', 'L']);
  });

  it('has at least 4 tracks with weeks', () => {
    expect(raw.tracks.length).toBeGreaterThanOrEqual(4);
    for (const t of raw.tracks) {
      expect(t.weeks.length).toBeGreaterThan(0);
    }
  });

  it('all lesson slugs unique within a workspace', () => {
    const slugs = new Set<string>();
    for (const t of raw.tracks) {
      for (const w of t.weeks) {
        for (const m of w.modules ?? []) {
          for (const l of m.lessons ?? []) {
            expect(slugs.has(l.slug), `Duplicate lesson slug: ${l.slug}`).toBe(false);
            slugs.add(l.slug);
          }
        }
      }
    }
  });

  it('every exercise has prompt + payload', () => {
    for (const t of raw.tracks) {
      for (const w of t.weeks) {
        for (const m of w.modules ?? []) {
          for (const l of m.lessons ?? []) {
            for (const ex of l.exercises ?? []) {
              expect(ex.promptMd).toBeTruthy();
              expect(ex.payload).toBeTruthy();
              expect([
                'mcq',
                'mcq_multi',
                'fill_blank',
                'order_steps',
                'type_answer',
                'code_block_review',
              ]).toContain(ex.kind);
            }
          }
        }
      }
    }
  });
});
