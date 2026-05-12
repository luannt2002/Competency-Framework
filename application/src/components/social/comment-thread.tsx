/**
 * Comment thread — server component.
 *
 * Loads all comments for a node via a direct DB read (mirrors JournalSection)
 * so this same component can render in /share/<slug>/n/<nodeSlug> without
 * forcing auth. Threading is flat in storage (self-FK parent_comment_id);
 * the renderer builds a tree client-side via a parent_id map. Visual indent
 * caps at depth 3 — replies beyond that still flatten under depth 3.
 *
 * In share-mode (readOnly), the composer + actions are omitted entirely. The
 * thread is read-only and we don't trigger an auth check.
 */
import { and, asc, eq } from 'drizzle-orm';
import { MessagesSquare } from 'lucide-react';
import { db } from '@/lib/db/client';
import { nodeComments } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { getEffectiveLevel } from '@/lib/rbac/server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { CommentComposer } from './comment-composer';
import { CommentItemActions } from './comment-item-actions';

type Props = {
  workspaceId: string;
  workspaceSlug: string;
  nodeId: string;
  /** When true: never render add/reply/delete affordances (share mode). */
  readOnly?: boolean;
};

type CommentRow = {
  id: string;
  workspaceId: string;
  nodeId: string;
  authorUserId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

type CommentNode = CommentRow & {
  depth: number;
  children: CommentNode[];
};

const MAX_VISUAL_DEPTH = 3;
const INDENT_PX = 24;

function buildTree(rows: CommentRow[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  for (const r of rows) {
    map.set(r.id, { ...r, depth: 0, children: [] });
  }
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = map.get(r.id)!;
    if (r.parentCommentId && map.has(r.parentCommentId)) {
      const parent = map.get(r.parentCommentId)!;
      node.depth = Math.min(parent.depth + 1, MAX_VISUAL_DEPTH);
      parent.children.push(node);
    } else {
      // Orphan or root — render at depth 0.
      node.depth = 0;
      roots.push(node);
    }
  }
  return roots;
}

function formatDate(d: Date): string {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function CommentItem({
  node,
  workspaceSlug,
  nodeId,
  viewerId,
  viewerLevel,
  readOnly,
}: {
  node: CommentNode;
  workspaceSlug: string;
  nodeId: string;
  viewerId: string | null;
  viewerLevel: number;
  readOnly: boolean;
}) {
  const isAuthor = viewerId !== null && viewerId === node.authorUserId;
  const isEditor = viewerLevel >= RBAC_LEVELS.EDITOR;
  const canDelete = !readOnly && (isAuthor || isEditor);
  const canReply =
    !readOnly && viewerLevel >= RBAC_LEVELS.LEARNER && node.depth < MAX_VISUAL_DEPTH;

  return (
    <li
      style={{ marginLeft: `${node.depth * INDENT_PX}px` }}
      className="space-y-2"
    >
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span className="text-xs font-mono text-muted-foreground" title={node.authorUserId}>
            {node.authorUserId.slice(0, 8)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(node.createdAt)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{node.body}</p>
        {!readOnly && (canReply || canDelete) && (
          <div className="mt-2">
            <CommentItemActions
              workspaceSlug={workspaceSlug}
              nodeId={nodeId}
              commentId={node.id}
              canDelete={canDelete}
              canReply={canReply}
            />
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="space-y-2">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              workspaceSlug={workspaceSlug}
              nodeId={nodeId}
              viewerId={viewerId}
              viewerLevel={viewerLevel}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export async function CommentThread({
  workspaceId,
  workspaceSlug,
  nodeId,
  readOnly = false,
}: Props) {
  const rows = await db
    .select()
    .from(nodeComments)
    .where(
      and(
        eq(nodeComments.workspaceId, workspaceId),
        eq(nodeComments.nodeId, nodeId),
      ),
    )
    .orderBy(asc(nodeComments.createdAt), asc(nodeComments.id));

  let viewerLevel: number = RBAC_LEVELS.GUEST;
  let viewerId: string | null = null;
  if (!readOnly) {
    const user = await getCurrentUser();
    viewerId = user?.id ?? null;
    const eff = await getEffectiveLevel(workspaceId, viewerId);
    viewerLevel = eff.level;
  }
  const canCompose = !readOnly && viewerLevel >= RBAC_LEVELS.LEARNER;

  const tree = buildTree(
    rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      nodeId: r.nodeId,
      authorUserId: r.authorUserId,
      parentCommentId: r.parentCommentId,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );

  return (
    <section className="pt-4" data-testid="comment-thread">
      <div className="flex items-center gap-2 mb-4">
        <MessagesSquare className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Bình luận</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0
            ? readOnly
              ? 'Chưa có bình luận'
              : 'Hãy là người đầu tiên'
            : `${rows.length} bình luận`}
        </span>
      </div>

      {tree.length > 0 ? (
        <ul className="space-y-3 mb-4">
          {tree.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              workspaceSlug={workspaceSlug}
              nodeId={nodeId}
              viewerId={viewerId}
              viewerLevel={viewerLevel}
              readOnly={readOnly}
            />
          ))}
        </ul>
      ) : (
        <div className="surface p-6 text-center text-sm text-muted-foreground border-dashed border-cyan-500/20 bg-cyan-500/5 mb-4">
          {readOnly
            ? 'Mục này chưa có bình luận nào.'
            : 'Mở đầu cuộc trò chuyện về mục này.'}
        </div>
      )}

      {canCompose && (
        <div className="surface p-4">
          <CommentComposer workspaceSlug={workspaceSlug} nodeId={nodeId} />
        </div>
      )}
    </section>
  );
}
