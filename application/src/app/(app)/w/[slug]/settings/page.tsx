/**
 * /w/[slug]/settings — Workspace settings (OWNER-only).
 *
 * NOTE: This is the WORKSPACE-scoped settings surface. The user-level
 * preferences page lives at `src/app/(app)/settings/page.tsx` — leave it
 * alone.
 *
 * Sections:
 *   - General         (name, slug)
 *   - Visibility       (private / public-readonly toggle)
 *   - Admin shortcuts  (members, audit)
 *   - Danger zone      (delete workspace; double-confirm)
 *
 * Non-owners redirect to /w/[slug]. RBAC guard is the same one used by the
 * members + audit pages so all three behave consistently.
 */
import Link from 'next/link';

import { eq } from 'drizzle-orm';
import {
  SlidersHorizontal,
  Users,
  ShieldCheck,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/lib/db/client';
import { competencyLevels, skillCategories } from '@/lib/db/schema';

import { RBAC_LEVELS } from '@/lib/rbac/levels';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RenameWorkspaceForm } from '@/components/admin/rename-workspace-form';
import { VisibilityToggle } from '@/components/admin/visibility-toggle';
import { DeleteWorkspaceForm } from '@/components/admin/delete-workspace-form';
import { AppearanceForm } from '@/components/admin/appearance-form';
import { LevelEditor } from '@/components/admin/level-editor';
import { NodeTypeEditor } from '@/components/admin/node-type-editor';
import { CategoryColorEditor } from '@/components/admin/category-color-editor';
import { NODE_TYPE_LIST } from '@/components/learn/node-card';
import { getNodeTypeOverrides } from '@/lib/theme/node-type-queries';
import type { VisibilityValue } from '@/actions/workspace-admin';
import { requireAdminPage } from '@/lib/workspace';

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Một cửa duy nhất cho trang quản trị — xem lib/workspace.ts.
  const ws = await requireAdminPage(slug, RBAC_LEVELS.OWNER);

  // Map DB enum → UI value.
  const uiVisibility: VisibilityValue = ws.visibility === 'public-readonly' ? 'public' : 'private';

  const levels = await db
    .select({
      id: competencyLevels.id,
      code: competencyLevels.code,
      label: competencyLevels.label,
      description: competencyLevels.description,
    })
    .from(competencyLevels)
    .where(eq(competencyLevels.workspaceId, ws.id))
    .orderBy(competencyLevels.displayOrder);

  const typeOverrides = await getNodeTypeOverrides(ws.id);

  const categories = await db
    .select({ id: skillCategories.id, name: skillCategories.name, color: skillCategories.color })
    .from(skillCategories)
    .where(eq(skillCategories.workspaceId, ws.id))
    .orderBy(skillCategories.displayOrder);

  return (
    <div
      className="mx-auto max-w-3xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-hue-1/20">
          <SlidersHorizontal className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Workspace settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ws.name} · only the workspace owner can change these.
          </p>
        </div>
      </header>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Rename the workspace. The slug is fixed for MVP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RenameWorkspaceForm
            workspaceSlug={ws.slug}
            initialName={ws.name}
            initialDescription={ws.description}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Slug:</span>
            <code
              className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px]"
              style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {ws.slug}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Appearance — emoji icon + accent color (palette-whitelisted) */}
      <Card>
        <CardHeader>
          <CardTitle>Ngoại hình</CardTitle>
          <CardDescription>
            Chọn biểu tượng và màu accent — áp riêng cho workspace này (multi-tenant theming).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppearanceForm
            workspaceSlug={ws.slug}
            initialIcon={ws.icon ?? null}
            initialColor={ws.color ?? null}
          />
        </CardContent>
      </Card>

      {/* Node types — emoji + color overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Loại node</CardTitle>
          <CardDescription>Đổi icon emoji + màu cho từng loại node (giai đoạn, tuần, bài học, lab…).</CardDescription>
        </CardHeader>
        <CardContent>
          <NodeTypeEditor
            workspaceSlug={ws.slug}
            types={NODE_TYPE_LIST.map((t) => ({
              ...t,
              icon: typeOverrides[t.nodeType]?.icon ?? null,
              color: typeOverrides[t.nodeType]?.color ?? null,
            }))}
          />
        </CardContent>
      </Card>

      {/* Skill categories — color coding */}
      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Danh mục kỹ năng</CardTitle>
            <CardDescription>Chọn màu cho từng danh mục (AWS, Terraform, K8s…).</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryColorEditor workspaceSlug={ws.slug} categories={categories} />
          </CardContent>
        </Card>
      )}

      {/* Competency levels — rename display labels */}
      {levels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cấp độ năng lực</CardTitle>
            <CardDescription>Đổi tên hiển thị các cấp XS / S / M / L cho đúng culture team bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <LevelEditor workspaceSlug={ws.slug} levels={levels} />
          </CardContent>
        </Card>
      )}

      {/* Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Choose who can read this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <VisibilityToggle workspaceSlug={ws.slug} initialValue={uiVisibility} />
        </CardContent>
      </Card>

      {/* Admin shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Members and audit trail for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Link
            href={`/w/${ws.slug}/import`}
            className="surface flex items-center justify-between gap-3 p-3 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="size-4 text-primary" />
              <div>
                <div className="text-sm font-medium">Import framework</div>
                <div className="text-[11px] text-muted-foreground">Markdown → cây học tập</div>
              </div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href={`/w/${ws.slug}/members`}
            className="surface flex items-center justify-between gap-3 p-3 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="size-4 text-hue-1" />
              <div>
                <div className="text-sm font-medium">Members</div>
                <div className="text-[11px] text-muted-foreground">Manage access</div>
              </div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href={`/w/${ws.slug}/audit`}
            className="surface flex items-center justify-between gap-3 p-3 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-amber-500" />
              <div>
                <div className="text-sm font-medium">Audit log</div>
                <div className="text-[11px] text-muted-foreground">Recent changes</div>
              </div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Deleting a workspace removes all tree nodes, progress, and member grants. This cannot
            be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkspaceForm workspaceSlug={ws.slug} />
        </CardContent>
      </Card>
    </div>
  );
}
