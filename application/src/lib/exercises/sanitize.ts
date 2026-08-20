/**
 * Payload sanitisation — the answer never leaves the server.
 *
 * This is the generalisation of the old hardcoded `stripCorrect()` switch in
 * src/actions/learn.ts, which knew about exactly six kinds and would have
 * silently leaked the answer of any seventh.
 *
 * Two layers, both always applied:
 *
 *   1. DECLARED paths — the engine's `secretPaths` plus, for tenant-defined
 *      kinds, `exercise_types.secret_fields`. Precise, supports nesting.
 *   2. DENY-LIST — a recursive sweep for key names that are answers by
 *      definition (`correctId`, `accepts`, `solution`, …). This is the
 *      fail-safe: a tenant who forgets to flag a field secret, or a new engine
 *      whose author forgets `secretPaths`, still cannot leak through it.
 *
 * Path syntax: `a.b` walks into an object, `a[].b` maps over an array. A
 * trailing segment always deletes the key.
 */

/** Key names that are an answer whatever the engine. Compared lowercased. */
const DENY_KEYS = new Set([
  'correctid',
  'correctids',
  'correctorder',
  'correctanswer',
  'accepts',
  'answer',
  'answerkey',
  'answer_key',
  'solution',
  'solutions',
  'expected',
  'expectedanswer',
  'modelanswermd',
  'modelanswer',
  'gradernotesmd',
  'gradernotes',
]);

/** Guard against a pathological or cyclic payload eating the request. */
const MAX_DEPTH = 12;

export type SanitizeSpec = {
  /** Resolved engine key — supplies the engine's declared secret paths. */
  secretPaths?: readonly string[];
};

type Seg = { key: string; array: boolean };

function parsePath(path: string): Seg[] {
  return path
    .split('.')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const array = raw.endsWith('[]');
      return { key: array ? raw.slice(0, -2) : raw, array };
    });
}

function removeAt(node: unknown, segs: Seg[], i: number, depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return;
  const seg = segs[i];
  if (!seg) return;

  // An array in a non-terminal position is walked element-wise, whether or not
  // the author wrote `[]`. Being lenient here means a slightly wrong path in a
  // tenant config still strips rather than silently leaking.
  if (Array.isArray(node)) {
    for (const el of node) removeAt(el, segs, i, depth + 1);
    return;
  }

  const obj = node as Record<string, unknown>;
  if (i === segs.length - 1) {
    delete obj[seg.key];
    return;
  }
  removeAt(obj[seg.key], segs, i + 1, depth + 1);
}

function sweepDenyList(node: unknown, depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const el of node) sweepDenyList(el, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (DENY_KEYS.has(key.toLowerCase())) {
      delete obj[key];
      continue;
    }
    sweepDenyList(obj[key], depth + 1);
  }
}

/** Structural clone of JSON-ish data. jsonb payloads are always JSON-safe. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Return a copy of `payload` safe to serialize to a client.
 *
 * Never mutates the input. Non-object payloads are returned as-is (there is
 * nothing to strip). Call this on EVERY path that ships a payload outward —
 * `startLesson`, any API route, any server component prop.
 */
export function sanitizePayload(payload: unknown, spec: SanitizeSpec = {}): unknown {
  if (payload === null || typeof payload !== 'object') return payload;

  let clone: unknown;
  try {
    clone = cloneJson(payload);
  } catch {
    // Unclonable payload (cycle / BigInt). Refuse to guess — send nothing.
    return {};
  }

  for (const path of spec.secretPaths ?? []) {
    const segs = parsePath(path);
    if (segs.length > 0) removeAt(clone, segs, 0, 0);
  }

  sweepDenyList(clone, 0);
  return clone;
}

/**
 * Test/diagnostic helper: does a sanitized value still contain any of these
 * strings anywhere in its JSON serialisation?
 *
 * Used by tests to assert the negative ("the answer is gone") without having
 * to know each engine's payload shape.
 */
export function containsAny(value: unknown, needles: readonly string[]): string[] {
  const hay = JSON.stringify(value ?? null);
  return needles.filter((n) => n.length > 0 && hay.includes(n));
}
