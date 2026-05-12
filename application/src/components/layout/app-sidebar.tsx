/**
 * Sidebar for the authenticated app shell.
 * Workspace-aware: shows current workspace + nav items scoped to /w/[slug]/*.
 */
'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: typeof LayoutDashboard };

export function AppSidebar({
  workspaceSlug,
  workspaceName,
  isOwner = false,
}: {
  workspaceSlug: string;
  workspaceName: string;
  /** Show the workspace-admin section when the viewer owns this workspace. */
  isOwner?: boolean;
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
    { href: `${base}/settings`, label: 'Settings (workspace)', icon: SlidersHorizontal },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-background/60 backdrop-blur">
      {/* Workspace switcher (MVP: read-only display) */}
      <Link
        href={base}
        className="group flex items-center gap-3 border-b border-border px-4 py-4 transition-colors hover:bg-secondary"
      >
        <div className="size-9 rounded-xl accent-gradient flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
          {workspaceName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{workspaceName}</div>
          <div className="text-xs text-muted-foreground truncate">workspace · {workspaceSlug}</div>
        </div>
      </Link>

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
