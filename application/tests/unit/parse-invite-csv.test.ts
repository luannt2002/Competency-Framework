import { describe, it, expect } from 'vitest';
import {
  parseInviteCsv,
  normalizeInviteRole,
  shortIdentifier,
} from '@/lib/admin/parse-invite-csv';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('parseInviteCsv', () => {
  it('nhận EMAIL — cái mà bản cũ chặn cứng, làm ĐỨT cả tính năng', () => {
    const rows = parseInviteCsv('an@congty.vn,learner');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.error).toBeNull();
    expect(rows[0]!.identifier).toBe('an@congty.vn');
    expect(rows[0]!.role).toBe('learner');
  });

  it('vẫn nhận UUID như cũ — không phá dữ liệu người dùng đang dùng', () => {
    const rows = parseInviteCsv(`${UUID},editor`);
    expect(rows[0]!.error).toBeNull();
    expect(rows[0]!.role).toBe('workspace_editor');
  });

  it('trộn email và UUID trong cùng một lần dán', () => {
    const rows = parseInviteCsv(`an@congty.vn,learner\n${UUID},contributor`);
    expect(rows.map((r) => r.error)).toEqual([null, null]);
    expect(rows.map((r) => r.role)).toEqual(['learner', 'workspace_contributor']);
  });

  it('bỏ qua dòng trống và dòng chú thích', () => {
    const rows = parseInviteCsv('\n# ghi chú\nan@congty.vn,learner\n\n');
    expect(rows).toHaveLength(1);
  });

  it('nhận dòng tiêu đề cả kiểu cũ lẫn kiểu mới', () => {
    for (const header of ['user_id,role', 'email,role', 'identifier,role']) {
      const rows = parseInviteCsv(`${header}\nan@congty.vn,learner`);
      expect(rows, header).toHaveLength(1);
      expect(rows[0]!.line).toBe(1);
    }
  });

  it('không có tiêu đề thì dòng đầu vẫn là dữ liệu', () => {
    const rows = parseInviteCsv('an@congty.vn,learner\nbinh@congty.vn,editor');
    expect(rows).toHaveLength(2);
  });

  it('báo lỗi rõ ràng cho định danh sai', () => {
    const rows = parseInviteCsv('khong-phai-gi-ca,learner');
    expect(rows[0]!.error).toContain('email hoặc user_id');
  });

  it('báo lỗi rõ ràng cho vai trò sai, kèm giá trị đã gõ', () => {
    const rows = parseInviteCsv('an@congty.vn,owner');
    expect(rows[0]!.error).toContain('owner');
  });

  it('email hỏng thì trượt, không lọt xuống server', () => {
    for (const bad of ['a@b', 'a@@b.vn', '@congty.vn', 'an@ congty.vn']) {
      expect(parseInviteCsv(`${bad},learner`)[0]!.error, bad).not.toBeNull();
    }
  });
});

describe('normalizeInviteRole', () => {
  it('nhận bí danh ngắn lẫn giá trị chuẩn, không phân biệt hoa thường', () => {
    expect(normalizeInviteRole('EDITOR')).toBe('workspace_editor');
    expect(normalizeInviteRole('workspace_editor')).toBe('workspace_editor');
    expect(normalizeInviteRole(' contributor ')).toBe('workspace_contributor');
  });
  it('không cho gán owner qua CSV', () => {
    expect(normalizeInviteRole('owner')).toBeNull();
    expect(normalizeInviteRole('workspace_owner')).toBeNull();
  });
});

describe('shortIdentifier', () => {
  it('rút gọn UUID', () => {
    expect(shortIdentifier(UUID)).toBe('0000…0001');
  });
  it('GIỮ NGUYÊN email — cắt đi là mất đúng phần cần kiểm', () => {
    expect(shortIdentifier('an@congty.vn')).toBe('an@congty.vn');
    expect(shortIdentifier('nguyen.van.an@congty.example.vn')).toBe(
      'nguyen.van.an@congty.example.vn',
    );
  });
});
