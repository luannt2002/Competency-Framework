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
  WORKSPACE_NOT_FOUND_OR_FORBIDDEN: {
    status: 404,
    code: 'WORKSPACE_NOT_FOUND',
  },
  WORKSPACE_INVALID_OWNER: { status: 404, code: 'WORKSPACE_NOT_FOUND' },
  WORKSPACE_NOT_FOUND: { status: 404, code: 'WORKSPACE_NOT_FOUND' },
  SKILL_NOT_IN_WORKSPACE: { status: 404, code: 'SKILL_NOT_FOUND' },
  TEMPLATE_NOT_FOUND: { status: 404, code: 'TEMPLATE_NOT_FOUND' },
  INGESTION_VALIDATION_FAILED: {
    status: 422,
    code: 'INGESTION_VALIDATION_FAILED',
  },
};

export function mapErrorToResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const mapping = ERROR_TABLE[message];
  if (mapping) {
    return NextResponse.json(
      { error: message, code: mapping.code },
      { status: mapping.status },
    );
  }
  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
