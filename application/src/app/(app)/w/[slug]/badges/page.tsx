/**
 * /w/[slug]/badges — F16 creator custom badge management (EDITOR+).
 *
 * Permission choice: EDITOR (RBAC 60), one notch below the OWNER-only settings
 * surface. Badge design is content authoring (like nodes/lessons editors
 * already manage), not workspace administration (rename/visibility/delete).
 * Server actions in src/actions/badges.ts enforce the same level, so a direct
 * action call cannot bypass this page's guard.
 */

import { asc, count, eq } from 'drizzle-orm';
import { Medal } from 'lucide-react';
import { db } from '@/lib/db/client';
import { userBadges } from '@/lib/db/schema';
import { badgesAdmin } from '@/lib/db/schema-badges';

import { RBAC_LEVELS } from '@/lib/rbac/levels';

import { StatChip } from '@/components/learn/stat-chip';
import { BadgeManager, type BadgeRow } from '@/components/admin/badge-manager';
import { requireAdminPage } from '@/lib/workspace';

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Một cửa duy nhất cho trang quản trị — xem lib/workspace.ts.
  const ws = await requireAdminPage(slug, RBAC_LEVELS.EDITOR);

  // One query: badges + how many learners earned each (left join + group).
  const rows = await db
    .select({
      id: badgesAdmin.id,
      slug: badgesAdmin.slug,
      name: badgesAdmin.name,
      description: badgesAdmin.description,
      icon: badgesAdmin.icon,
      rule: badgesAdmin.rule,
      isActive: badgesAdmin.isActive,
      earnedCount: count(userBadges.badgeId),
    })
    .from(badgesAdmin)
    .leftJoin(
      userBadges,
      eq(userBadges.badgeId, badgesAdmin.id),
    )
    .where(eq(badgesAdmin.workspaceId, ws.id))
    .groupBy(badgesAdmin.id)
    .orderBy(asc(badgesAdmin.slug));

  const list: BadgeRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    icon: r.icon,
    rule: r.rule,
    isActive: r.isActive,
    earnedCount: Number(r.earnedCount) || 0,
  }));

  return (
    <div
      className="mx-auto max-w-5xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-hue-1/20">
          <Medal className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Huy hiệu</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ws.name} · thiết kế huy hiệu và luật mở khoá (EDITOR trở lên).
          </p>
        </div>
      </header>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 max-w-2xl">
        <StatChip icon={Medal} label="Huy hiệu" value={String(list.length)} sub="tổng" color="text-hue-1" />
        <StatChip
          icon={Medal}
          label="Đang bật"
          value={String(list.filter((b) => b.isActive).length)}
          sub="cấp mới"
          color="text-emerald-500"
        />
        <StatChip
          icon={Medal}
          label="Đã tắt"
          value={String(list.filter((b) => !b.isActive).length)}
          sub="giữ lịch sử"
          color="text-amber-500"
        />
      </section>

      <BadgeManager workspaceSlug={ws.slug} badges={list} />
    </div>
  );
}
