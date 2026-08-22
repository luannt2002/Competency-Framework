/**
 * Bóc CSV mời hàng loạt — thuần, không IO, test được.
 *
 * Tách khỏi component vì đây là chỗ đã từng làm ĐỨT cả một tính năng: bản trong
 * component chặn cứng bằng `UUID_RE`, nên mọi dòng email bị gạt trước khi rời
 * trình duyệt, trong khi server đã resolve email được từ lâu (rà D2.2 — POST
 * thẳng server action một dòng email trả `{"added":0,"invited":1}`).
 * Logic nằm trong component thì không ai viết test cho nó.
 */

export type InviteRole = 'learner' | 'workspace_contributor' | 'workspace_editor';

export type ParsedInviteRow = {
  /** 1-based, tính theo dòng dữ liệu (đã bỏ header và dòng trống/chú thích). */
  line: number;
  /** Email hoặc UUID, giữ nguyên như người dùng gõ. */
  identifier: string;
  roleRaw: string;
  role: InviteRole | null;
  error: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Đủ chặt để bắt lỗi gõ nhầm, đủ lỏng để không tự phát minh chuẩn email riêng. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Cột đầu của dòng tiêu đề — nhận cả kiểu cũ (`user_id`) lẫn kiểu mới. */
const HEADER_FIRST_COL = ['user_id', 'email', 'identifier'];

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Đưa mọi bí danh vai trò về đúng giá trị của `workspace_members.role`. */
export function normalizeInviteRole(raw: string): InviteRole | null {
  const r = raw.trim().toLowerCase();
  if (r === 'learner') return 'learner';
  if (r === 'contributor' || r === 'workspace_contributor') return 'workspace_contributor';
  if (r === 'editor' || r === 'workspace_editor') return 'workspace_editor';
  return null;
}

export function parseInviteCsv(text: string): ParsedInviteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];

  const first = lines[0]!.split(',').map((s) => s.trim().toLowerCase());
  const body = HEADER_FIRST_COL.includes(first[0] ?? '') ? lines.slice(1) : lines;

  return body.map((raw, idx): ParsedInviteRow => {
    const parts = raw.split(',').map((s) => s.trim());
    const identifier = parts[0] ?? '';
    const roleRaw = parts[1] ?? '';
    const role = normalizeInviteRole(roleRaw);

    let error: string | null = null;
    if (!isUuid(identifier) && !isEmail(identifier)) {
      error = 'Cột đầu phải là email hoặc user_id (UUID)';
    } else if (!role) {
      error = `Vai trò phải là learner|contributor|editor (đang là "${roleRaw}")`;
    }
    return { line: idx + 1, identifier, roleRaw, role, error };
  });
}

/**
 * Rút gọn để hiện trong bảng xem trước.
 *
 * CHỈ rút gọn UUID. Email phải hiện nguyên vẹn — người dùng cần đọc được để
 * biết mình gõ đúng địa chỉ chưa, mà `an@congty.vn` bị cắt thành `an@c…y.vn`
 * thì mất đúng phần cần kiểm.
 */
export function shortIdentifier(id: string): string {
  if (!isUuid(id)) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
