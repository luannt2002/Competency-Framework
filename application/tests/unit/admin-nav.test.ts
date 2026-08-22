import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_MIN_LEVELS,
  isAdminItemVisible,
  visibleAdminItems,
} from '../../src/lib/rbac/admin-nav';
import { RBAC_LEVELS } from '../../src/lib/rbac/levels';

/**
 * Bảng này phải khớp cấp mà CHÍNH TRANG đòi. Bản test trước khoá chặt cái sai:
 * nó khẳng định members/audit là EDITOR, trong khi hai trang đó gọi
 * `requireMinLevel(OWNER)` — nên EDITOR thấy link rồi bị đá ra, mà test vẫn xanh.
 */
describe('sidebar admin-item visibility', () => {
  it('khớp đúng cấp mà từng trang đòi', () => {
    // OWNER — members/page.tsx:81, audit/page.tsx:39, settings
    expect(ADMIN_NAV_MIN_LEVELS.members).toBe(RBAC_LEVELS.OWNER);
    expect(ADMIN_NAV_MIN_LEVELS.audit).toBe(RBAC_LEVELS.OWNER);
    expect(ADMIN_NAV_MIN_LEVELS.settings).toBe(RBAC_LEVELS.OWNER);
    // EDITOR — roster:76, analytics:60, grading:32, badges:40
    expect(ADMIN_NAV_MIN_LEVELS.roster).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.analytics).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.grading).toBe(RBAC_LEVELS.EDITOR);
    expect(ADMIN_NAV_MIN_LEVELS.badges).toBe(RBAC_LEVELS.EDITOR);
  });

  it('mọi trang admin có route đều phải có mặt — không route mồ côi', () => {
    // Danh sách này = các thư mục dưới src/app/(app)/w/[slug]/ có gate admin.
    const ROUTES_WITH_ADMIN_GATE = [
      'members',
      'audit',
      'roster',
      'analytics',
      'grading',
      'badges',
      'settings',
    ] as const;
    expect(Object.keys(ADMIN_NAV_MIN_LEVELS).sort()).toEqual([...ROUTES_WITH_ADMIN_GATE].sort());
  });

  it('guest/viewer/learner/contributor không thấy gì', () => {
    for (const level of [
      RBAC_LEVELS.GUEST,
      RBAC_LEVELS.VIEWER,
      RBAC_LEVELS.LEARNER,
      RBAC_LEVELS.CONTRIBUTOR,
    ]) {
      expect(visibleAdminItems(level)).toEqual([]);
    }
  });

  it('editor thấy đúng 4 mục cấp EDITOR, không thấy mục OWNER', () => {
    expect(visibleAdminItems(RBAC_LEVELS.EDITOR)).toEqual([
      'roster',
      'analytics',
      'grading',
      'badges',
    ]);
    for (const ownerOnly of ['members', 'audit', 'settings'] as const) {
      expect(isAdminItemVisible(ownerOnly, RBAC_LEVELS.EDITOR)).toBe(false);
    }
  });

  it('owner trở lên thấy tất cả', () => {
    expect(visibleAdminItems(RBAC_LEVELS.OWNER)).toEqual([
      'members',
      'audit',
      'roster',
      'analytics',
      'grading',
      'badges',
      'settings',
    ]);
    expect(visibleAdminItems(RBAC_LEVELS.SUPER_ADMIN)).toContain('settings');
  });
});
