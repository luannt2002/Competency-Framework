/**
 * Maps thrown errors from server actions / route handlers into the canonical
 * `{ error, code }` JSON response with the correct HTTP status.
 *
 * Known error codes (string literal, throw via `new Error(CODE)`):
 *  - UNAUTHORIZED                       → 401
 *  - WORKSPACE_NOT_FOUND_OR_FORBIDDEN   → 404
 *  - WORKSPACE_INVALID_OWNER            → 404
 *  - WORKSPACE_NOT_FOUND                → 404
 *  - SKILL_NOT_IN_WORKSPACE             → 404
 *  - TEMPLATE_NOT_FOUND                 → 404
 *  - INGESTION_VALIDATION_FAILED        → 422
 *  - anything else                      → 500
 */
import { NextResponse } from 'next/server';

type Mapping = { status: number; code: string };

const ERROR_TABLE: Record<string, Mapping> = {
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  WORKSPACE_NOT_FOUND_OR_FORBIDDEN: {
    status: 404,
    code: 'WORKSPACE_NOT_FOUND',
  },
  WORKSPACE_INVALID_OWNER: { status: 404, code: 'WORKSPACE_NOT_FOUND' },
  WORKSPACE_NOT_FOUND: { status: 404, code: 'WORKSPACE_NOT_FOUND' },
  SKILL_NOT_IN_WORKSPACE: { status: 404, code: 'SKILL_NOT_FOUND' },
  TEMPLATE_NOT_FOUND: { status: 404, code: 'TEMPLATE_NOT_FOUND' },
  NODE_NOT_FOUND: { status: 404, code: 'NODE_NOT_FOUND' },
  PARENT_NOT_FOUND: { status: 404, code: 'PARENT_NOT_FOUND' },
  LESSON_NOT_FOUND: { status: 404, code: 'LESSON_NOT_FOUND' },
  EXERCISE_NOT_FOUND: { status: 404, code: 'EXERCISE_NOT_FOUND' },
  MEMBER_NOT_FOUND: { status: 404, code: 'MEMBER_NOT_FOUND' },
  MEMBER_IS_OWNER: { status: 403, code: 'MEMBER_IS_OWNER' },
  TASK_NOT_FOUND: { status: 404, code: 'TASK_NOT_FOUND' },
  INGESTION_VALIDATION_FAILED: {
    status: 422,
    code: 'INGESTION_VALIDATION_FAILED',
  },
};

/**
 * INCOMPLETE_CHILDREN errors carry UI copy in the message:
 *   "INCOMPLETE_CHILDREN:<incomplete>:<Vietnamese sentence>"
 * Map them to 409 + structured fields instead of surfacing as a raw 500.
 */
const INCOMPLETE_CHILDREN_RE = /^INCOMPLETE_CHILDREN:(\d+):(.+)$/;

export function mapErrorToResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const mapping = ERROR_TABLE[message];
  if (mapping) {
    return NextResponse.json(
      { error: message, code: mapping.code },
      { status: mapping.status },
    );
  }
  const incomplete = INCOMPLETE_CHILDREN_RE.exec(message);
  if (incomplete) {
    return NextResponse.json(
      {
        error: 'INCOMPLETE_CHILDREN',
        code: 'INCOMPLETE_CHILDREN',
        incomplete: Number(incomplete[1]),
        detail: incomplete[2],
      },
      { status: 409 },
    );
  }
  // Unknown errors (Drizzle/Postgres internals, programming bugs) must NOT
  // leak their raw message to the client — log server-side instead.
  console.error('[mapErrorToResponse] unmapped error:', error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
