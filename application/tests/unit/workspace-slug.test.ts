/**
 * Unit tests for workspace slug allocation.
 *
 * Guards the fix in migration 0010: `workspaces.slug` is globally unique, so
 * the allocator must never hand back a slug that is already taken by ANY
 * owner. Before this, two tenants could both hold `devops` and `/w/devops`
 * resolved nondeterministically — the second tenant hijacked the first one's
 * URL.
 *
 * Only `nextAvailableSlug` is covered here: it is the pure half, so the
 * numbering and truncation rules are testable without a database.
 */
import { describe, it, expect } from 'vitest';
import { nextAvailableSlug, MAX_SLUG_LENGTH } from '@/lib/workspace/slug';

describe('nextAvailableSlug', () => {
  it('returns the desired slug untouched when nothing is taken', () => {
    expect(nextAvailableSlug('devops', [])).toBe('devops');
  });

  it('normalises the input the same way toSlug does', () => {
    expect(nextAvailableSlug('DevOps Mastery 2026', [])).toBe('devops-mastery-2026');
  });

  it('appends -2 on the first collision, not -1', () => {
    expect(nextAvailableSlug('devops', ['devops'])).toBe('devops-2');
  });

  it('walks past a run of existing suffixes', () => {
    expect(nextAvailableSlug('devops', ['devops', 'devops-2', 'devops-3'])).toBe('devops-4');
  });

  it('fills a gap in the middle rather than always taking the max+1', () => {
    // `devops-2` was renamed away; reuse it instead of growing to -5.
    expect(nextAvailableSlug('devops', ['devops', 'devops-3', 'devops-4'])).toBe('devops-2');
  });

  it('is case-insensitive — DB rows may not be lowercased', () => {
    expect(nextAvailableSlug('devops', ['DevOps'])).toBe('devops-2');
  });

  it('ignores unrelated slugs that merely share a prefix', () => {
    // `devops-platform` must not push `devops` to `devops-2`.
    expect(nextAvailableSlug('devops', ['devops-platform', 'devops-x'])).toBe('devops');
  });

  it('falls back to a stem when the input slugifies to nothing', () => {
    expect(nextAvailableSlug('🎯🎯🎯', [])).toBe('workspace');
  });

  it('clamps an over-long desired slug to the column limit', () => {
    const long = 'a'.repeat(80);
    const out = nextAvailableSlug(long, []);
    expect(out).toHaveLength(MAX_SLUG_LENGTH);
  });

  it('truncates the STEM (not the suffix) so a collided long slug still fits', () => {
    const long = 'b'.repeat(MAX_SLUG_LENGTH);
    const taken = nextAvailableSlug(long, []); // the clamped 40-char slug
    const out = nextAvailableSlug(long, [taken]);

    expect(out.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(out.endsWith('-2')).toBe(true);
    expect(out).not.toBe(taken);
  });

  it('never leaves a double dash when truncation lands on a separator', () => {
    // Truncating `…-` then appending `-2` would yield `…--2`.
    const desired = `${'c'.repeat(MAX_SLUG_LENGTH - 3)}-dd`;
    const taken = nextAvailableSlug(desired, []);
    const out = nextAvailableSlug(desired, [taken]);

    expect(out).not.toContain('--');
    expect(out.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
  });

  it('produces a slug free of every taken value, across many collisions', () => {
    const taken = ['devops', ...Array.from({ length: 50 }, (_, i) => `devops-${i + 2}`)];
    const out = nextAvailableSlug('devops', taken);

    expect(taken).not.toContain(out);
    expect(out).toBe('devops-52');
  });
});
