/**
 * Public user profile — top-level, no auth required.
 *
 * `[id]` accepts:
 *   - full UUID (36 chars)        — looked up exact
 *   - 8-char prefix (first 8 of the UUID) — looked up via LIKE prefix; we pick
 *                                           the single match or 404 on collision
 *
 * Renders only public-readonly workspaces owned by this user. 404 when the
 * user has none (we don't expose private profiles at all).
 *
 * SEO: emits OG metadata pointing at /api/og?slug=<first-workspace-slug>
 * (good enough for MVP — every page already has that route). Per-user OG
 * is a follow-up.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import { User, ArrowRight, Layers } from 'lucide-react';

const SITE_NAME = 'Competency Framework';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX_RE = /^[0-9a-f]{8}$/i;

type ResolvedUser = {
  userId: string;
  shortId: string;
  workspaces: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
  }>;
  totalNodes: number;
};

/**
 * Resolve `[id]` to a userId via either full UUID or 8-char prefix match.
 * Returns null when no public workspaces map to the requested id (or the id
 * is malformed). The lookup is purely via workspaces.owner_user_id — we
 * don't expose users who haven't published.
 */
async function resolveUserPublic(id: string): Promise<ResolvedUser | null> {
  const trimmed = id.trim().toLowerCase();
  if (!trimmed) return null;

  let candidateOwnerIds: string[] = [];
  if (UUID_RE.test(trimmed)) {
    candidateOwnerIds = [trimmed];
  } else if (PREFIX_RE.test(trimmed)) {
    // Find distinct owner_user_ids whose UUID prefix matches. Postgres
    // doesn't allow LIKE on a uuid directly — cast to text. We bound the
    // result set to keep this cheap; a collision on 8 hex chars is rare.
    const prefixed = await db
      .selectDistinct({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(
        and(
          sql`${workspaces.ownerUserId}::text LIKE ${trimmed + '%'}`,
          eq(workspaces.visibility, 'public-readonly'),
        ),
      )
      .limit(5);
    candidateOwnerIds = prefixed
      .map((r) => r.ownerUserId)
      .filter((v): v is string => !!v);
  } else {
    return null;
  }

  if (candidateOwnerIds.length !== 1) return null;
  const ownerId = candidateOwnerIds[0]!;

  const wsRows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      icon: workspaces.icon,
    })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerUserId, ownerId),
        eq(workspaces.visibility, 'public-readonly'),
      ),
    );

  if (wsRows.length === 0) return null;

  // Total tree node count across all of this user's public workspaces.
  const wsIds = wsRows.map((w) => w.id);
  let totalNodes = 0;
  if (wsIds.length > 0) {
    const totalsRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(roadmapTreeNodes)
      .where(sql`${roadmapTreeNodes.workspaceId} IN (${sql.join(wsIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
    totalNodes = totalsRow[0]?.n ?? 0;
  }

  return {
    userId: ownerId,
    shortId: ownerId.slice(0, 8),
    workspaces: wsRows,
    totalNodes,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolved = await resolveUserPublic(id);
  if (!resolved) {
    return {
      title: `User not found · ${SITE_NAME}`,
      robots: { index: false },
    };
  }
  const title = `${resolved.shortId} · Profile · ${SITE_NAME}`;
  const description = `${resolved.workspaces.length} roadmap công khai · ${resolved.totalNodes} mục học tập`;
  // Use the first workspace's OG image as the user's profile preview.
  const firstSlug = resolved.workspaces[0]?.slug;
  const ogImage = firstSlug ? `/api/og?slug=${encodeURIComponent(firstSlug)}` : undefined;
  const url = `/u/${resolved.shortId}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'profile',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resolved = await resolveUserPublic(id);
  if (!resolved) notFound();

  return (
    <div
      className="mx-auto max-w-4xl px-4 py-10 md:py-16"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Profile card */}
      <section className="surface p-6 md:p-8 mb-10 bg-gradient-to-br from-cyan-50 via-violet-50 to-pink-50 dark:from-cyan-950/30 dark:via-violet-950/30 dark:to-pink-950/30">
        <div className="flex items-start gap-4">
          <div className="size-16 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shrink-0">
            <User className="size-8 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold font-mono">
              {resolved.shortId}
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
              {resolved.userId}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Stat label="Roadmap công khai" value={String(resolved.workspaces.length)} />
              <Stat label="Tổng mục học" value={String(resolved.totalNodes)} />
            </div>
          </div>
        </div>
      </section>

      {/* Workspaces grid */}
      <h2 className="text-lg font-semibold mb-4">Roadmap công khai</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resolved.workspaces.map((w) => (
          <Link
            key={w.id}
            href={`/share/${w.slug}`}
            className="surface p-4 hover:border-cyan-500/40 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  {w.icon && <span className="text-xl">{w.icon}</span>}
                  <h3 className="text-sm font-semibold truncate">{w.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  /share/{w.slug}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <p className="inline-flex items-center gap-1.5">
          <Layers className="size-3.5" />
          Trang công khai · không yêu cầu đăng nhập
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
