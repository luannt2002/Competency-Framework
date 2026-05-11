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

  it('falls back to 500 INTERNAL_ERROR', async () => {
    const res = mapErrorToResponse(new Error('SOMETHING_ELSE'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.error).toBe('SOMETHING_ELSE');
  });

  it('handles non-Error throws', async () => {
    const res = mapErrorToResponse('boom');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Unknown error');
  });
});
