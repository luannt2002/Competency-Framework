/**
 * Resource library section — server component.
 *
 * Lists all `node_resources` for a given node, grouped by kind
 * (link / video / doc / book) with small Lucide icons. Members (LEARNER+)
 * see a "+ Thêm tài liệu" trigger; the adder or any EDITOR+ sees a per-row
 * remove button.
 *
 * Read path is a direct DB query (not a server action) so the same component
 * can render in /share/* without forcing an auth check. Mutation affordances
 * are gated by `readOnly` AND by the resolved effective level.
 */
import { and, asc, eq } from 'drizzle-orm';
import { BookOpen, FileText, Link2, Video } from 'lucide-react';
import { db } from '@/lib/db/client';
import { nodeResources } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { getEffectiveLevel } from '@/lib/rbac/server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { ResourceAddDialog } from './resource-add-dialog';
import { ResourceRemoveButton } from './resource-remove-button';
import { EmptyState } from '@/components/ui/empty-state';
import { NoResourcesIllustration } from '@/components/ui/empty-state-illustrations';

type ResourceKind = 'link' | 'video' | 'doc' | 'book';

type Props = {
  workspaceId: string;
  workspaceSlug: string;
  nodeId: string;
  /** When true: never render add/remove affordances (share mode). */
  readOnly?: boolean;
};

const KIND_META: Record<
  ResourceKind,
  { label: string; Icon: typeof Link2; colorClass: string }
> = {
  link: { label: 'Link', Icon: Link2, colorClass: 'text-cyan-500' },
  video: { label: 'Video', Icon: Video, colorClass: 'text-rose-500' },
  doc: { label: 'Tài liệu', Icon: FileText, colorClass: 'text-amber-500' },
  book: { label: 'Sách', Icon: BookOpen, colorClass: 'text-violet-500' },
};

const KIND_ORDER: ResourceKind[] = ['link', 'video', 'doc', 'book'];

export async function ResourcesSection({
  workspaceId,
  workspaceSlug,
  nodeId,
  readOnly = false,
}: Props) {
  const rows = await db
    .select()
    .from(nodeResources)
    .where(
      and(
        eq(nodeResources.workspaceId, workspaceId),
        eq(nodeResources.nodeId, nodeId),
      ),
    )
    .orderBy(asc(nodeResources.createdAt));

  let viewerLevel: number = RBAC_LEVELS.GUEST;
  let viewerId: string | null = null;
  if (!readOnly) {
    const user = await getCurrentUser();
    viewerId = user?.id ?? null;
    const eff = await getEffectiveLevel(workspaceId, viewerId);
    viewerLevel = eff.level;
  }
  const canAdd = !readOnly && viewerLevel >= RBAC_LEVELS.LEARNER;
  const isEditorPlus = !readOnly && viewerLevel >= RBAC_LEVELS.EDITOR;

  // Bucket by kind
  const buckets: Record<ResourceKind, typeof rows> = {
    link: [],
    video: [],
    doc: [],
    book: [],
  };
  for (const r of rows) {
    const k = r.kind as ResourceKind;
    if (k in buckets) buckets[k].push(r);
  }

  return (
    <section className="pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Thư viện tài liệu</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length === 0
              ? 'Chưa có tài liệu — hãy đóng góp link / video / sách bạn thấy hữu ích.'
              : `${rows.length} tài liệu được chia sẻ`}
          </p>
        </div>
        {canAdd && (
          <ResourceAddDialog workspaceSlug={workspaceSlug} nodeId={nodeId} />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          illustration={<NoResourcesIllustration label="Chưa có tài liệu" />}
          title={readOnly ? 'Chưa có tài liệu nào' : 'Hãy là người đóng góp đầu tiên'}
          description={
            readOnly
              ? 'Mục này chưa có link, video hoặc sách nào.'
              : 'Đóng góp link / video / sách bạn thấy hữu ích cho mục này.'
          }
          className="border-dashed border-primary/30 bg-primary/5"
        />
      ) : (
        <div className="space-y-5">
          {KIND_ORDER.map((kind) => {
            const list = buckets[kind];
            if (list.length === 0) return null;
            const meta = KIND_META[kind];
            const { Icon } = meta;
            return (
              <div key={kind}>
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Icon className={`size-3.5 ${meta.colorClass}`} />
                  {meta.label}
                  <span className="font-mono text-[10px] opacity-70">
                    ({list.length})
                  </span>
                </h3>
                <ul className="space-y-2">
                  {list.map((r) => {
                    const canRemove =
                      !readOnly &&
                      (viewerId === r.addedByUserId || isEditorPlus);
                    return (
                      <li
                        key={r.id}
                        className="surface px-3 py-2.5 flex items-start gap-3"
                      >
                        <Icon
                          className={`size-4 mt-0.5 shrink-0 ${meta.colorClass}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline break-words"
                          >
                            {r.title}
                          </a>
                          {r.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {r.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                            {r.url}
                          </p>
                        </div>
                        {canRemove && (
                          <ResourceRemoveButton
                            workspaceSlug={workspaceSlug}
                            resourceId={r.id}
                            title={r.title}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
