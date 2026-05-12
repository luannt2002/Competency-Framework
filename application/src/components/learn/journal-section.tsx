/**
 * Journal / Posts section — server component.
 *
 * Lists all `node_journal_entries` for a given node and renders them as a
 * blog-style stack. Each entry shows title, author + date, tags, and markdown
 * body. Authors (and EDITOR+) see inline edit/delete; LEARNER+ see an
 * "Đăng bài mới" trigger.
 *
 * Read path is a direct DB query (not a server action) so the same component
 * can render in /share/* without forcing an auth check. The mutation buttons
 * are gated by `readOnly` and by the resolved effective level.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db } from '@/lib/db/client';
import { nodeJournalEntries } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { getEffectiveLevel } from '@/lib/rbac/server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { JournalAddButton } from './journal-add-button';
import { JournalEntryActions } from './journal-entry-actions';

type Props = {
  workspaceId: string;
  workspaceSlug: string;
  nodeId: string;
  /** When true: never render add/edit/delete affordances (share mode). */
  readOnly?: boolean;
};

function formatDate(d: Date): string {
  // Compact dd/MM/yyyy HH:mm — locale-stable for SSR.
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export async function JournalSection({
  workspaceId,
  workspaceSlug,
  nodeId,
  readOnly = false,
}: Props) {
  // Read entries directly — read-only viewers (share mode) don't need RBAC.
  const rows = await db
    .select()
    .from(nodeJournalEntries)
    .where(
      and(
        eq(nodeJournalEntries.workspaceId, workspaceId),
        eq(nodeJournalEntries.nodeId, nodeId),
      ),
    )
    .orderBy(desc(nodeJournalEntries.createdAt), asc(nodeJournalEntries.id));

  // Resolve current viewer level so we can decide which buttons to show.
  // Skipped entirely when readOnly: share-mode never renders mutations.
  let viewerLevel: number = RBAC_LEVELS.GUEST;
  let viewerId: string | null = null;
  if (!readOnly) {
    const user = await getCurrentUser();
    viewerId = user?.id ?? null;
    const eff = await getEffectiveLevel(workspaceId, viewerId);
    viewerLevel = eff.level;
  }
  const canCreate = !readOnly && viewerLevel >= RBAC_LEVELS.LEARNER;
  const isEditorPlus = !readOnly && viewerLevel >= RBAC_LEVELS.EDITOR;

  return (
    <section className="pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Bài viết / Journal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length === 0
              ? 'Chưa có bài nào — viết ghi chú đầu tiên cho mục này.'
              : `${rows.length} bài viết của các thành viên`}
          </p>
        </div>
        {canCreate && (
          <JournalAddButton workspaceSlug={workspaceSlug} nodeId={nodeId} />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="surface p-8 text-center text-sm text-muted-foreground border-dashed border-violet-500/30 bg-violet-500/5">
          <p>
            {readOnly
              ? 'Mục này chưa có bài viết nào.'
              : 'Hãy đăng bài đầu tiên — ghi chú, blog, hoặc tổng kết bài lab.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const tags = (r.tags as string[] | null) ?? [];
            const canEditThis =
              !readOnly && (viewerId === r.authorUserId || isEditorPlus);
            return (
              <li key={r.id} className="surface p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-tight">
                      {r.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      <span title={r.authorUserId}>
                        {r.authorUserId.slice(0, 8)}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>{formatDate(r.createdAt)}</span>
                      {r.updatedAt.getTime() !== r.createdAt.getTime() && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span>đã sửa {formatDate(r.updatedAt)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {canEditThis && (
                    <JournalEntryActions
                      workspaceSlug={workspaceSlug}
                      entry={{
                        id: r.id,
                        title: r.title,
                        bodyMd: r.bodyMd,
                        tags,
                      }}
                    />
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-secondary/60 text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {r.bodyMd}
                  </ReactMarkdown>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
