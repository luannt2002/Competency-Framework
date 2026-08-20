import { describe, it, expect } from 'vitest';
import { mapErrorToResponse } from '@/lib/api/error-response';

describe('mapErrorToResponse', () => {
  it('maps UNAUTHORIZED to 401', async () => {
    const res = mapErrorToResponse(new Error('UNAUTHORIZED'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('maps WORKSPACE_NOT_FOUND_OR_FORBIDDEN to 404', async () => {
    const res = mapErrorToResponse(new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('maps INGESTION_VALIDATION_FAILED to 422', async () => {
    const res = mapErrorToResponse(new Error('INGESTION_VALIDATION_FAILED'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('INGESTION_VALIDATION_FAILED');
  });

  it('falls back to 500 INTERNAL_ERROR WITHOUT leaking the raw message', async () => {
    const res = mapErrorToResponse(new Error('SOMETHING_ELSE'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    // Regression: unknown errors (e.g. raw Postgres messages) used to be
    // returned verbatim to the client — they must now be masked.
    expect(body.error).toBe('Internal server error');
    expect(body.error).not.toContain('SOMETHING_ELSE');
  });

  it('handles non-Error throws without leaking', async () => {
    const res = mapErrorToResponse('boom');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('maps new codes: FORBIDDEN→403, NODE_NOT_FOUND→404, MEMBER_IS_OWNER→403', async () => {
    for (const [code, status] of [
      ['FORBIDDEN', 403],
      ['NODE_NOT_FOUND', 404],
      ['LESSON_NOT_FOUND', 404],
      ['EXERCISE_NOT_FOUND', 404],
      ['MEMBER_NOT_FOUND', 404],
      ['MEMBER_IS_OWNER', 403],
    ] as const) {
      const res = mapErrorToResponse(new Error(code));
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(body.code).toBe(code);
    }
  });

  it('maps INCOMPLETE_CHILDREN:<n>:<msg> to structured 409', async () => {
    const res = mapErrorToResponse(
      new Error('INCOMPLETE_CHILDREN:3:Còn 3/5 mục con chưa xong — hoàn thành chúng trước.'),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('INCOMPLETE_CHILDREN');
    expect(body.incomplete).toBe(3);
    expect(body.detail).toContain('mục con');
  });
});
