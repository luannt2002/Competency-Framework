/**
 * Text matching shared by the string-ish graders.
 *
 * `matchOne` is lifted verbatim from the original
 * src/lib/learn/exercise-evaluator.ts so the six legacy kinds keep byte-exact
 * behaviour, including the deliberate swallow of an invalid seeded regex.
 */

export type MatchKind = 'exact' | 'exact_ci' | 'regex';

/** True when `value` satisfies at least one accepted form. */
export function matchOne(value: string, accepts: string[], kind: MatchKind): boolean {
  const v = value.trim();
  for (const a of accepts) {
    if (kind === 'exact' && v === a) return true;
    if (kind === 'exact_ci' && v.toLowerCase() === a.toLowerCase()) return true;
    if (kind === 'regex') {
      try {
        if (new RegExp(a).test(v)) return true;
      } catch {
        // bad regex in seed → skip
      }
    }
  }
  return false;
}

/**
 * Loose normalisation for keyword scoring: lowercase, strip punctuation,
 * collapse runs of whitespace. Unicode-aware so Vietnamese diacritics survive.
 */
export function normalizeLoose(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
