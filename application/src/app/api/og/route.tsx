/**
 * Dynamic Open Graph image endpoint.
 *
 * GET /api/og?slug=<workspaceSlug>&node=<optionalNodeSlug>
 *
 * Renders a 1200x630 PNG that is used by:
 *   - <meta property="og:image">  on /share/[slug]
 *   - <meta property="og:image">  on /share/[slug]/n/[nodeSlug]
 *
 * Cached at the edge for 1 hour so each share link only re-renders once.
 *
 * Visual: cream paper (#faf9f5) with coral (#cc785c) accent corner,
 * Outfit-style large title, three stat chips, signature underline.
 */
import { ImageResponse } from 'next/og';
import { and, eq, count, isNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';

export const runtime = 'nodejs';

const PAPER = '#faf9f5';
const PAPER_BORDER = '#e8e4d8';
const PAPER_ELEVATED = '#f3f1ea';
const CORAL = '#cc785c';
const CORAL_SOFT = '#e8a791';
const INK = '#1a1915';
const MUTED = '#7a7770';

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + '…';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const nodeSlug = url.searchParams.get('node');

  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  // Read-only lookup — no auth.
  const wsRow = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRow[0];
  if (!ws) {
    return new Response('Workspace not found', { status: 404 });
  }

  // Stats: total nodes, number of root sections (cấp 1), and 2nd-level total (tuần).
  const [totalNodesRow, rootsRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id)),
    db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, ws.id),
          isNull(roadmapTreeNodes.parentId),
        ),
      ),
  ]);
  const totalNodes = totalNodesRow[0]?.n ?? 0;
  const roots = rootsRow;

  // Sections / weeks counting strategy mirrors share page:
  //   - 1 root  → sections = direct children of that root, weeks = grandchildren
  //   - N roots → sections = roots,                        weeks = their direct children
  let totalSections = 0;
  let totalWeeks = 0;
  if (roots.length > 0) {
    const sectionRows = await db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, ws.id),
          roots.length === 1
            ? eq(roadmapTreeNodes.parentId, roots[0]!.id)
            : isNull(roadmapTreeNodes.parentId),
        ),
      );
    totalSections = sectionRows.length;
    if (sectionRows.length > 0) {
      const sectionIds = sectionRows.map((r) => r.id);
      const weeksRow = await db
        .select({ n: count() })
        .from(roadmapTreeNodes)
        .where(
          and(
            eq(roadmapTreeNodes.workspaceId, ws.id),
            inArray(roadmapTreeNodes.parentId, sectionIds),
          ),
        );
      totalWeeks = weeksRow[0]?.n ?? 0;
    }
  }

  // Title + subtitle resolution.
  let title = ws.name;
  let subtitle = `Lộ trình học tập — ${totalNodes} mục`;

  if (nodeSlug) {
    const nodeRow = await db
      .select()
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, ws.id),
          eq(roadmapTreeNodes.slug, nodeSlug),
        ),
      )
      .limit(1);
    const node = nodeRow[0];
    if (node) {
      title = node.title;
      subtitle = truncate(node.description, 160) || `${ws.name} · ${totalNodes} mục`;
    }
  } else if (roots.length === 1) {
    // Single-root convention used on share dashboard.
    const root = await db
      .select()
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.id, roots[0]!.id))
      .limit(1);
    if (root[0]?.description) {
      subtitle = truncate(root[0].description, 160);
    }
  }

  title = truncate(title, 90);
  subtitle = truncate(subtitle, 160);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          position: 'relative',
          fontFamily: 'sans-serif',
          color: INK,
          padding: '64px 72px',
          justifyContent: 'space-between',
        }}
      >
        {/* Coral accent corner — top right */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '320px',
            height: '320px',
            background: `radial-gradient(ellipse at top right, ${CORAL}33, ${PAPER} 70%)`,
            display: 'flex',
          }}
        />

        {/* Top row: badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '22px',
            fontWeight: 600,
            color: MUTED,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 18px',
              borderRadius: '999px',
              background: PAPER_ELEVATED,
              border: `1px solid ${PAPER_BORDER}`,
              fontFamily: 'monospace',
              fontSize: '20px',
              color: INK,
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ fontSize: '22px' }}>📚</span>
            <span>Roadmap</span>
          </span>
          <span style={{ display: 'flex', marginLeft: 'auto', fontFamily: 'monospace', fontSize: '18px' }}>
            competency-framework
          </span>
        </div>

        {/* Center: title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px' }}>
          <div
            style={{
              fontSize: title.length > 40 ? '60px' : '72px',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: INK,
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1.35,
              color: MUTED,
              display: 'flex',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Bottom row: stats + signature */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <StatChip label={`${totalSections} giai đoạn`} accent={CORAL} />
            <StatChip label={`${totalWeeks} tuần`} accent="#06b6d4" />
            <StatChip label={`${totalNodes} mục`} accent="#8b5cf6" />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '20px',
                color: MUTED,
                display: 'flex',
              }}
            >
              {nodeSlug ? `/share/${slug}/n/${nodeSlug}` : `/share/${slug}`}
            </span>
            <div
              style={{
                width: '180px',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${CORAL_SOFT}, ${CORAL})`,
                display: 'flex',
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Type': 'image/png',
      },
    },
  );
}

function StatChip({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 22px',
        borderRadius: '14px',
        background: '#ffffff',
        border: `1px solid ${PAPER_BORDER}`,
        fontSize: '24px',
        fontWeight: 600,
        color: INK,
      }}
    >
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: accent,
          display: 'flex',
        }}
      />
      <span style={{ display: 'flex' }}>{label}</span>
    </div>
  );
}
