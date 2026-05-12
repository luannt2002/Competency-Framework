'use client';

/**
 * Notifications bell — topbar inbox dropdown.
 *
 * Polls listMyNotifications every 60s. Click a notification to:
 *   - call markRead(id) (server action)
 *   - navigate to the relevant resource (workspace / share page)
 *
 * Unread count is computed client-side from `readAt === null`; the red badge
 * shows when count > 0. "Đọc hết" calls markAllRead and re-fetches.
 *
 * The dropdown is a simple absolutely-positioned panel — no portal, no
 * Radix popover — to keep dependencies small and avoid focus-trap issues
 * inside a sticky topbar.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import {
  listMyNotifications,
  markAllRead,
  markRead,
  type NotificationItem,
} from '@/actions/notifications';

const POLL_MS = 60_000;
const PANEL_LIMIT = 10;

function formatRelative(d: Date): string {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}'`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return `${Math.floor(diffD / 7)}w`;
}

/**
 * Decide where clicking a notification should navigate. Falls back to the
 * workspace root when we don't have enough info; null = no nav.
 */
function navTargetFor(n: NotificationItem): string | null {
  if (n.workspaceSlug) {
    return `/w/${n.workspaceSlug}`;
  }
  return null;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMyNotifications(PANEL_LIMIT);
      setItems(rows);
      setErrored(false);
    } catch {
      // Most common reason: not logged in. Hide the bell silently — we don't
      // want to log noise on guest views of /share/* pages that may render
      // the topbar shell.
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 60s poll.
  useEffect(() => {
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOnce]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unreadCount = (items ?? []).filter((n) => n.readAt === null).length;

  // If we have no auth, hide the bell entirely (don't render a clickable shell
  // for guests). This keeps /share topbars clean if ever reused.
  if (errored && items === null) return null;

  const onClickItem = (n: NotificationItem) => {
    const href = navTargetFor(n);
    startTransition(async () => {
      try {
        await markRead(n.id);
      } catch {
        // Non-fatal — still navigate.
      }
      setOpen(false);
      if (href) router.push(href);
      // Refresh local state so the dot disappears quickly.
      fetchOnce();
    });
  };

  const onMarkAll = () => {
    startTransition(async () => {
      try {
        await markAllRead();
      } catch {
        // Non-fatal.
      }
      fetchOnce();
    });
  };

  return (
    <div ref={panelRef} className="relative">
      <Tooltip label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={
            unreadCount > 0
              ? `Notifications · ${unreadCount} unread`
              : 'Notifications'
          }
          className="relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 inline-flex min-w-[14px] h-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background"
              aria-label={`${unreadCount} chưa đọc`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông báo
            </span>
            {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>

          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {(items ?? []).length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Chưa có thông báo nào.
              </li>
            ) : (
              (items ?? []).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onClickItem(n)}
                    className={cn(
                      'block w-full text-left px-3 py-2.5 hover:bg-secondary/50 transition-colors',
                      n.readAt === null && 'bg-cyan-500/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {n.readAt === null && (
                        <span className="mt-1.5 size-1.5 rounded-full bg-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium line-clamp-2">{n.title}</p>
                        {n.body && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          {(items ?? []).length > 0 && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={onMarkAll}
                disabled={pending || unreadCount === 0}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {pending && <Loader2 className="size-3 animate-spin" />}
                Đọc hết
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
