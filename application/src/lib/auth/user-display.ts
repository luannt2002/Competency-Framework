/**
 * user-display.ts — hiện tên/email người dùng thật từ Supabase Auth theo user_id.
 *
 * VẤN ĐỀ NÀY GIẢI QUYẾT
 * --------------------
 * Bảng nghiệp vụ chỉ lưu `user_id` (UUID). Supabase Auth — nơi duy nhất có
 * email/tên — nằm trên cloud, app không có bản sao local. Hệ quả: roster,
 * certificate, members đều hiển thị `shortId(UUID)` thay vì tên (D3.2, G3).
 *
 * CÁCH LÀM
 * --------
 * Service-role Admin API `auth.admin.getUserById`. Roster/members nhỏ (vài
 * chục user), gọi tuần tự chấp nhận được; mỗi lần gọi ~100ms nên có cache
 * in-process 5 phút theo user_id để một render không gọi N lần.
 *
 * Dev-bypass user (UUID tổng 0000...0001) không tồn tại trên Supabase →
 * fallback "Dev user". Mọi lỗi mạng/API → fallback shortId(id) — không bao
 * giờ làm hỏng trang vì thiếu tên.
 */

import { createClient } from '@supabase/supabase-js';

export type UserDisplay = {
  id: string;
  /** Ưu tiên full_name từ user_metadata, rồi email, rồi fallback. */
  displayName: string;
  email: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: UserDisplay }>();

export function shortId(id: string): string {
  return id ? `${id.slice(0, 4)}…${id.slice(-4)}` : '—';
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function toDisplay(id: string, data: { email?: string | null; user_metadata?: Record<string, unknown> } | null): UserDisplay {
  const email = data?.email ?? null;
  const metaName =
    typeof data?.user_metadata?.full_name === 'string'
      ? (data.user_metadata.full_name as string)
      : typeof data?.user_metadata?.name === 'string'
        ? (data.user_metadata.name as string)
        : null;
  const displayName = metaName?.trim() || email?.split('@')[0] || shortId(id);
  return { id, displayName, email };
}

/** Lấy tên hiển thị của MỘT user. Không throw — luôn trả được fallback. */
export async function getUserDisplay(id: string): Promise<UserDisplay> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const fallback: UserDisplay = { id, displayName: shortId(id), email: null };
  const supabase = adminClient();
  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data?.user) return fallback;
    const value = toDisplay(id, data.user);
    cache.set(id, { at: Date.now(), value });
    return value;
  } catch {
    return fallback;
  }
}

/** Lấy tên hiển thị của NHIỀU user (roster/members) — cache dùng chung. */
export async function getUsersDisplay(ids: string[]): Promise<Map<string, UserDisplay>> {
  const out = new Map<string, UserDisplay>();
  await Promise.all(
    ids.map(async (id) => {
      out.set(id, await getUserDisplay(id));
    }),
  );
  return out;
}

/**
 * Tìm user_id theo email qua Admin API (D2.1/D2.2 — invite bằng email).
 * Trả null khi không tìm thấy / không cấu hình service key / lỗi mạng.
 * listUsers phân trang — duyệt tối đa MAX_PAGES trang để đám đông user nhỏ.
 */
const MAX_LIST_PAGES = 20;
const emailCache = new Map<string, { at: number; id: string | null }>();

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const key = email.trim().toLowerCase();
  const hit = emailCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.id;

  const supabase = adminClient();
  if (!supabase) return null;

  try {
    let page = 1;
    while (page <= MAX_LIST_PAGES) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users) return null;
      const match = data.users.find((u) => u.email?.toLowerCase() === key);
      if (match) {
        emailCache.set(key, { at: Date.now(), id: match.id });
        return match.id;
      }
      if (data.users.length < 200) {
        emailCache.set(key, { at: Date.now(), id: null });
        return null;
      }
      page += 1;
    }
    return null;
  } catch {
    return null;
  }
}
