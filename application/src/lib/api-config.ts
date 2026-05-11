/**
 * API config — env toggle Mock vs Real.
 *
 * Set `NEXT_PUBLIC_USE_MOCK=true` in .env.local to use mock data layer.
 * Default: false (real DB via Server Actions).
 */
export const USE_MOCK =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCK === 'true') || false;
