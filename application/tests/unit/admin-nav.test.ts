import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_MIN_LEVELS,
  isAdminItemVisible,
  visibleAdminItems,
} from '../../src/lib/rbac/admin-nav';
import { RBAC_LEVELS } from '../../src/lib/rbac/levels';

describe('sidebar admin-item visibility', () => {
  it('requires EDITOR for members/audit/roster/analytics and OWNER for settings', () => {
    expect(ADMIN_NAV_MIN_LEVELS.members).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.audit).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.roster).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.analytics).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.settings).toBe(RBAC_LEVELS.OWNER);
  });

  it('guest/viewer/learner/contributor see nothing', () => {
    for (const level of [RBAC_LEVELS.GUEST, RBAC_LEVELS.VIEWER, RBAC_LEVELS.LEARNER, RBAC_LEVELS.CONTRIBUTOR]) {
      expect(visibleAdminItems(level)).toEqual([]);
    }
  });

  it('editor sees everything except settings', () => {
    expect(visibleAdminItems(RBAC_LEVELS.EDITOR)).toEqual([
      'members',
      'audit',
      'roster',
      'analytics',
    ]);
    expect(isAdminItemVisible('settings', RBAC_LEVELS.EDITOR)).toBe(false);
  });

  it('owner and above see all admin items', () => {
    expect(visibleAdminItems(RBAC_LEVELS.OWNER)).toEqual([
      'members',
      'audit',
      'roster',
      'analytics',
      'settings',
    ]);
    expect(visibleAdminItems(RBAC_LEVELS.SUPER_ADMIN)).toContain('settings');
  });
});
