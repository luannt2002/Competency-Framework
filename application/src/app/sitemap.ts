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
import { eq, and } from 'drizzle-orm';
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

  const dynamicEntries: MetadataRoute.Sitemap = [];

  for (const ws of publicWorkspaces) {
    dynamicEntries.push({
      url: `${BASE_URL}/share/${ws.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    const nodes = await db
      .select({
        slug: roadmapTreeNodes.slug,
        updatedAt: roadmapTreeNodes.updatedAt,
      })
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, ws.id),
        ),
      );

    for (const n of nodes) {
      dynamicEntries.push({
        url: `${BASE_URL}/share/${ws.slug}/n/${n.slug}`,
        lastModified: n.updatedAt ?? now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return [...staticEntries, ...dynamicEntries];
}
