import { describe, expect, it } from 'vitest';
import { resolveDevBypassUserId } from '../../src/lib/auth/dev-bypass';

describe('resolveDevBypassUserId (pure priority: cookie > env)', () => {
  const ENV_ID = '00000000-0000-0000-0000-00000000env1';

  it('returns the cookie value when present', () => {
    expect(resolveDevBypassUserId('editor-uuid', ENV_ID)).toBe('editor-uuid');
  });

  it('falls back to the env value when no cookie', () => {
    expect(resolveDevBypassUserId(undefined, ENV_ID)).toBe(ENV_ID);
    expect(resolveDevBypassUserId('', ENV_ID)).toBe(ENV_ID);
  });

  it('whitespace-only cookie is ignored (trimmed)', () => {
    expect(resolveDevBypassUserId('   ', ENV_ID)).toBe(ENV_ID);
    expect(resolveDevBypassUserId('  editor  ', ENV_ID)).toBe('editor');
  });

  it('returns undefined when neither source is set', () => {
    expect(resolveDevBypassUserId(undefined, undefined)).toBeUndefined();
    expect(resolveDevBypassUserId('', '')).toBeUndefined();
  });
});
