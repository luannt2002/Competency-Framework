/**
 * Unit tests for scripts/guard-no-hardcode.ts.
 *
 * We call `checkSourceString` directly with synthetic TSX source. This avoids
 * touching the filesystem and keeps the assertions targeted at each detection
 * rule.
 */

import { describe, it, expect } from 'vitest';
import { checkSourceString } from '../../scripts/guard-no-hardcode';

describe('guard-no-hardcode', () => {
  describe('clean code', () => {
    it('passes for an empty component', () => {
      const src = `
        export function Empty() {
          return null;
        }
      `;
      const offences = checkSourceString(src, {
        fileName: 'Empty.tsx',
        relPath: 'src/components/empty.tsx',
      });
      expect(offences).toEqual([]);
    });

    it('passes when XP/streak are 0 (default values)', () => {
      const src = `
        export function Topbar({ dailyXp = 0, streak = 0, hearts = 0 }) {
          return null;
        }
      `;
      const offences = checkSourceString(src, {
        fileName: 'topbar.tsx',
        relPath: 'src/components/layout/topbar.tsx',
      });
      expect(offences).toEqual([]);
    });

    it('passes for type literals (not value data)', () => {
      const src = `
        type Skill = { slug: string; name: string; description: string };
        export const _x: Skill | null = null;
      `;
      const offences = checkSourceString(src, {
        fileName: 'types.ts',
        relPath: 'src/components/foo/types.ts',
      });
      expect(offences).toEqual([]);
    });

    it('skips files allowlisted by path prefix', () => {
      const src = `
        export const PALETTE = [
          { slug: 'red', name: 'Red', description: 'crimson' },
          { slug: 'blue', name: 'Blue', description: 'azure' },
        ];
      `;
      const offences = checkSourceString(src, {
        fileName: 'ui.ts',
        relPath: 'src/lib/constants/ui.ts',
      });
      expect(offences).toEqual([]);
    });

    it('skips files with the allow marker on the first line', () => {
      const src = `// guard-no-hardcode: allow
        export const SKILLS = [
          { slug: 'aws', name: 'AWS', description: 'cloud' },
        ];
      `;
      const offences = checkSourceString(src, {
        fileName: 'allowed.tsx',
        relPath: 'src/components/foo/allowed.tsx',
      });
      expect(offences).toEqual([]);
    });

    it('skips test files', () => {
      const src = `
        const SKILLS = [{ slug: 'aws', name: 'AWS' }];
        export {};
      `;
      const offences = checkSourceString(src, {
        fileName: 'foo.test.tsx',
        relPath: 'src/components/foo/foo.test.tsx',
      });
      expect(offences).toEqual([]);
    });
  });

  describe('rule: domain-array (hardcoded skill/category arrays)', () => {
    it('flags an array of slug+name objects', () => {
      const src = `
        const SKILLS = [
          { slug: 'aws', name: 'AWS' },
          { slug: 'k8s', name: 'Kubernetes' },
        ];
        export {};
      `;
      const offences = checkSourceString(src, {
        fileName: 'skills.tsx',
        relPath: 'src/components/skills/skills.tsx',
      });
      expect(offences.length).toBeGreaterThan(0);
      expect(offences[0]!.rule).toBe('domain-array');
    });

    it('flags an array with name + multiple secondary keys', () => {
      const src = `
        const LESSONS = [
          { name: 'Intro', description: 'first', xp: 10, level: 1 },
        ];
        export {};
      `;
      const offences = checkSourceString(src, {
        fileName: 'lessons.tsx',
        relPath: 'src/components/learn/lessons.tsx',
      });
      expect(offences.some((o) => o.rule === 'domain-array')).toBe(true);
    });

    it('does NOT flag a generic array of objects without domain keys', () => {
      const src = `
        const TABS = [
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ];
        export {};
      `;
      const offences = checkSourceString(src, {
        fileName: 'tabs.tsx',
        relPath: 'src/components/ui/tabs.tsx',
      });
      expect(offences.filter((o) => o.rule === 'domain-array')).toEqual([]);
    });
  });

  describe('rule: hardcoded-number (XP/streak/hearts)', () => {
    it('flags `const currentXp = 1240`', () => {
      const src = `
        export function Stat() {
          const currentXp = 1240;
          return currentXp;
        }
      `;
      const offences = checkSourceString(src, {
        fileName: 'stat.tsx',
        relPath: 'src/components/stats/stat.tsx',
      });
      expect(offences.some((o) => o.rule === 'hardcoded-number')).toBe(true);
    });

    it('flags `{ streak: 5 }` in an object literal value position', () => {
      const src = `
        export const data = { streak: 5, name: 'foo' };
      `;
      const offences = checkSourceString(src, {
        fileName: 'data.tsx',
        relPath: 'src/components/x/data.tsx',
      });
      expect(offences.some((o) => o.rule === 'hardcoded-number')).toBe(true);
    });

    it('does NOT flag `function f(hearts = 5)` parameter default', () => {
      const src = `
        export function Topbar({ hearts = 5 }: { hearts?: number }) {
          return hearts;
        }
      `;
      const offences = checkSourceString(src, {
        fileName: 'topbar.tsx',
        relPath: 'src/components/layout/topbar.tsx',
      });
      expect(offences.filter((o) => o.rule === 'hardcoded-number')).toEqual([]);
    });
  });

  describe('rule: mock-import', () => {
    it('flags `from "@/lib/mock-data/<x>"`', () => {
      // String is built at runtime so guard-no-mock's regex doesn't trip on
      // the test file itself.
      const modulePath = ['@/lib', 'mock-data', 'devops'].join('/');
      const src = `
        import { skills } from '${modulePath}';
        export const _ = skills;
      `;
      const offences = checkSourceString(src, {
        fileName: 'a.tsx',
        relPath: 'src/components/a.tsx',
      });
      expect(offences.some((o) => o.rule === 'mock-import')).toBe(true);
    });

    it('flags relative mock-data imports too', () => {
      const src = `
        import { x } from './mock-data';
        export const _ = x;
      `;
      const offences = checkSourceString(src, {
        fileName: 'b.tsx',
        relPath: 'src/components/b.tsx',
      });
      expect(offences.some((o) => o.rule === 'mock-import')).toBe(true);
    });
  });

  describe('rule: mock-flag (NEXT_PUBLIC_USE_MOCK)', () => {
    it('flags any identifier reference to NEXT_PUBLIC_USE_MOCK', () => {
      const src = `
        const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
        export { useMock };
      `;
      const offences = checkSourceString(src, {
        fileName: 'c.tsx',
        relPath: 'src/components/c.tsx',
      });
      expect(offences.some((o) => o.rule === 'mock-flag')).toBe(true);
    });
  });
});
