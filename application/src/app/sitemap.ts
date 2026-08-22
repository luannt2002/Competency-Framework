/**
 * Dynamic sitemap.xml — emitted at `/sitemap.xml`.
 *
 * Pulls all public-readonly workspaces from the DB and emits one entry per
 * `/share/<slug>` plus one entry per node under that workspace at
 * `/share/<slug>/n/<node-slug>`. The static landing routes (`/`, `/discover`,
 * `/sign-in`) are also included so crawlers can find the entry points.
 *
 * Absolute URLs are required by the sitemap spec — we resolve them against
 * `NEXT_PUBLIC_APP_URL` and fall back to `http://localhost:3000` during local
 * development.
 */
import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sign-in`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Public workspaces and their nodes.
  let publicWorkspaces: { id: string; slug: string }[] = [];
  try {
    publicWorkspaces = await db
      .select({ id: workspaces.id, slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.visibility, 'public-readonly'));
  } catch {
    // DB unavailable at build time — emit static entries only.
    return staticEntries;
  }

  const dynamicEntries: MetadataRoute.Sitemap = publicWorkspaces.map((ws) => ({
    url: `${BASE_URL}/share/${ws.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  if (publicWorkspaces.length > 0) {
    // MỘT truy vấn cho toàn bộ node, không phải một truy vấn mỗi workspace.
    //
    // Bản cũ lặp qua từng workspace công khai và bắn một câu SELECT node cho
    // mỗi cái, nên chi phí tăng tuyến tính theo số workspace được chia sẻ —
    // đúng thứ càng thành công càng chậm. Join thẳng qua `workspaces` và lọc
    // theo `visibility` cho ra cùng tập dữ liệu trong một lượt.
    let nodeRows: { wsSlug: string; nodeSlug: string; updatedAt: Date | null }[] = [];
    try {
      nodeRows = await db
        .select({
          wsSlug: workspaces.slug,
          nodeSlug: roadmapTreeNodes.slug,
          updatedAt: roadmapTreeNodes.updatedAt,
        })
        .from(roadmapTreeNodes)
        .innerJoin(workspaces, eq(roadmapTreeNodes.workspaceId, workspaces.id))
        .where(eq(workspaces.visibility, 'public-readonly'));
    } catch {
      // Node không lấy được thì vẫn phát sitemap cho các trang workspace —
      // một sitemap thiếu node còn hơn không có sitemap nào.
      return [...staticEntries, ...dynamicEntries];
    }

    for (const r of nodeRows) {
      dynamicEntries.push({
        url: `${BASE_URL}/share/${r.wsSlug}/n/${r.nodeSlug}`,
        lastModified: r.updatedAt ?? now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return [...staticEntries, ...dynamicEntries];
}
