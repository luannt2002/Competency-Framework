/**
 * Typed JSON fetch helper for hitting our own `/api/*` routes.
 *
 * Notes:
 *  - Works on both server (RSC, server actions) and the browser. When the
 *    caller passes a relative path on the server we resolve it against
 *    `NEXT_PUBLIC_APP_URL` (Next 15 disallows relative URLs in server-side
 *    `fetch`). On the browser, the relative path stays relative.
 *  - Forwards Supabase auth cookies via `credentials: 'include'` — required
 *    for server components calling our own auth-guarded routes via fetch.
 *  - On non-2xx, attempts to parse the response body as JSON to surface
 *    structured `{ error, code }` payloads from our route handlers; falls
 *    back to raw text.
 */

export type FetchJsonError = Error & {
  status: number;
  code?: string;
  body?: unknown;
};

const isBrowser = typeof window !== 'undefined';

function resolveUrl(path: string): string {
  // Already absolute? Use as-is.
  if (/^https?:\/\//i.test(path)) return path;

  // Browser: relative paths resolve against window.location.
  if (isBrowser) return path;

  // Server: need an absolute base. Default to localhost for dev parity.
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveUrl(path);
  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON — keep raw text
    }

    const message =
      (parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : text) || `API request failed (${res.status})`;
    const code =
      parsed && typeof parsed === 'object' && parsed !== null && 'code' in parsed
        ? String((parsed as { code: unknown }).code)
        : undefined;

    const err = new Error(message) as FetchJsonError;
    err.status = res.status;
    if (code) err.code = code;
    err.body = parsed ?? text;
    throw err;
  }

  // 204 No Content / empty body — return undefined cast as T.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
