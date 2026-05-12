/**
 * Sidebar for the authenticated app shell.
 * Workspace-aware: shows current workspace + nav items scoped to /w/[slug]/*.
 *
 * The workspace header is a dropdown (click-outside pattern) — it lists every
 * workspace the viewer owns and offers a "+ Tạo workspace mới" link to
 * /onboarding?force=1.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Grid3x3,
  Settings2,
  User,
  Sparkles,
  Calendar,
  Users,
  ShieldCheck,
  SlidersHorizontal,
  ChevronsUpDown,
  Plus,
  Check,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: typeof LayoutDashboard };
type WorkspaceLite = { slug: string; name: string };

export function AppSidebar({
  workspaceSlug,
  workspaceName,
  isOwner = false,
  workspaces = [],
}: {
  workspaceSlug: string;
  workspaceName: string;
  /** Show the workspace-admin section when the viewer owns this workspace. */
  isOwner?: boolean;
  /** All workspaces the viewer owns — fed into the switcher dropdown. */
  workspaces?: WorkspaceLite[];
}) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;
  // Tree-first navigation: dashboard IS the tree explorer.
  // Other surfaces accessible from inside node detail pages, not via sidebar.
  const items: Item[] = [
    { href: base, label: 'Cây học tập', icon: LayoutDashboard },
    { href: `${base}/daily`, label: 'Hôm nay', icon: Calendar },
    { href: `${base}/skills`, label: 'Kỹ năng', icon: Grid3x3 },
  ];

  // Workspace-admin items — only rendered for the workspace owner.
  const adminItems: Item[] = [
    { href: `${base}/members`, label: 'Members', icon: Users },
    { href: `${base}/audit`, label: 'Audit log', icon: ShieldCheck },
    { href: `${base}/roster`, label: 'Roster', icon: ClipboardList },
    { href: `${base}/settings`, label: 'Settings (workspace)', icon: SlidersHorizontal },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-background/60 backdrop-blur">
      {/* Workspace switcher dropdown */}
      <WorkspaceSwitcher
        currentSlug={workspaceSlug}
        currentName={workspaceName}
        workspaces={workspaces}
      />

      {/* Main nav */}
      <nav className="flex-1 p-2 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-foreground/5 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
              )}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full accent-gradient" />}
              <it.icon className="size-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}

        {isOwner && (
          <div className="pt-4">
            <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
              Admin
            </div>
            {adminItems.map((it) => {
              const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    active
                      ? 'bg-foreground/5 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full accent-gradient" />
                  )}
                  <it.icon className="size-4" />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2 space-y-1">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        >
          <User className="size-4" />
          Profile
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        >
          <Settings2 className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

/**
 * Workspace switcher — trigger shows the current workspace name + chevron;
 * dropdown lists every workspace the viewer owns plus a "create new" link.
 * Implemented with a tiny click-outside hook (no external Radix wrapper needed).
 */
function WorkspaceSwitcher({
  currentSlug,
  currentName,
  workspaces,
}: {
  currentSlug: string;
  currentName: string;
  workspaces: WorkspaceLite[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch workspace"
        className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary"
      >
        <div className="size-9 rounded-xl accent-gradient flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
          {currentName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{currentName}</div>
          <div className="text-xs text-muted-foreground truncate">workspace · {currentSlug}</div>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-[calc(100%-4px)] z-40 surface p-1 shadow-lg shadow-black/10"
        >
          <div className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
            Workspaces
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {workspaces.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                Bạn chưa có workspace nào.
              </li>
            )}
            {workspaces.map((w) => {
              const active = w.slug === currentSlug;
              return (
                <li key={w.slug}>
                  <Link
                    href={`/w/${w.slug}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                      active
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
                    )}
                  >
                    <div className="size-6 rounded-md accent-gradient flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{w.name}</span>
                    {active && <Check className="size-4 text-cyan-500 shrink-0" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="h-px bg-border my-1" />
          <Link
            href="/onboarding?force=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Tạo workspace mới
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Mobile bottom tab bar — used on screens < md.
 */
export function BottomTabBar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;
  const items: Item[] = [
    { href: base, label: 'Cây', icon: LayoutDashboard },
    { href: `${base}/daily`, label: 'Hôm nay', icon: Calendar },
    { href: `${base}/skills`, label: 'Kỹ năng', icon: Grid3x3 },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <it.icon className="size-5" />
              {it.label}
              {active && <Sparkles className="size-2 text-cyan-400 absolute top-1" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
