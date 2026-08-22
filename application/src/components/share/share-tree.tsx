'use client';
/**
 * ShareTree — full-depth, read-only nested roadmap for the public share page (A3).
 *
 * Spec: "viewer sees the whole roadmap structure without clicking through
 * pages". Every level of the tree is reachable on this single page; nodes with
 * children render as collapsible groups (expand/collapse is the only control).
 *
 * Trạng thái mặc định (hàm thuần `defaultCollapsed`):
 *   - tổng số mục < EXPAND_ALL_LIMIT → bung hết
 *   - lớn hơn → thu gọn từ cấp 3 trở xuống, hiện "+N mục"
 *
 * No progress, no status, no locks — read-only showcase.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ShareTreeNode } from '@/lib/tree/full-tree';
import {
  pickRoadmapColor,
  nodeTypeLabel,
  nodeTypeEmoji,
  type RoadmapColor,
} from '@/lib/tree/node-meta';

/**
 * Dưới ngưỡng này thì cây bung hết.
 *
 * Đặt 200 chứ không phải 60: bước A3 của đặc tả là "người xem thấy TOÀN BỘ cấu
 * trúc lộ trình trên một trang, không phải bấm qua từng trang". Một lộ trình
 * thật trong DB có 166 mục — để ngưỡng 60 thì nó tự thu gọn và A3 mất.
 *
 * Trước đợt này ngưỡng 60 vẫn "chạy đúng" một cách ăn may: phép đếm hậu duệ bị
 * lỗi nên tổng ra 48, lọt dưới ngưỡng. Sửa phép đếm mà quên ngưỡng là đổi một
 * lỗi lấy một lỗi khác.
 */
export const EXPAND_ALL_LIMIT = 200;

/**
 * Thuần: tính tập node thu gọn ban đầu cho một rừng.
 *
 * Cây nhỏ bung hết. Cây rất lớn thu gọn từ **cấp 3** trở xuống — giữ được ba
 * cấp đầu (gốc → giai đoạn → tuần) để trang vẫn quét mắt được, mà không giấu
 * mất cấu trúc như ngưỡng cấp 2 cũ.
 */
export function defaultCollapsed(roots: ShareTreeNode[]): Set<string> {
  const total = roots.reduce((acc, r) => acc + 1 + r.descendantCount, 0);
  const collapsed = new Set<string>();
  if (total < EXPAND_ALL_LIMIT) return collapsed;
  const walk = (nodes: ShareTreeNode[]) => {
    for (const n of nodes) {
      if (n.depth >= 3 && n.children.length > 0) collapsed.add(n.id);
      walk(n.children);
    }
  };
  walk(roots);
  return collapsed;
}

function nodeHref(linkBase: string, slug: string): string {
  return `${linkBase.replace(/\/$/, '')}/${slug}`;
}

export function ShareTree({
  roots,
  linkBase,
}: {
  roots: ShareTreeNode[];
  linkBase: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(roots));

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseDeep = () => setCollapsed(defaultCollapsed(roots));

  const total = roots.reduce((acc, r) => acc + 1 + r.descendantCount, 0);
  const big = total >= EXPAND_ALL_LIMIT;

  if (roots.length === 0) return null;

  return (
    <div className="space-y-2" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
      {big && (
        <div className="flex items-center gap-3 mb-4 text-xs">
          <span className="text-muted-foreground font-mono">
            {total} mục · rút gọn cấp sâu
          </span>
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary/60 transition-colors"
          >
            Mở rộng tất cả
          </button>
          <button
            type="button"
            onClick={collapseDeep}
            className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary/60 transition-colors"
          >
            Thu gọn
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {roots.map((node, i) => (
          <TreeRow
            key={node.id}
            node={node}
            linkBase={linkBase}
            color={pickRoadmapColor(i)}
            collapsed={collapsed}
            onToggle={toggle}
            isSection
            index={i}
            total={roots.length}
          />
        ))}
      </ul>
    </div>
  );
}

function TreeRow({
  node,
  linkBase,
  color,
  collapsed,
  onToggle,
  isSection = false,
  index,
  total,
}: {
  node: ShareTreeNode;
  linkBase: string;
  color: RoadmapColor;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  isSection?: boolean;
  index: number;
  total: number;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const href = nodeHref(linkBase, node.slug);
  const emoji = nodeTypeEmoji(node.nodeType);

  return (
    <li className="rm-share-row">
      <div
        className={`flex items-start gap-2 ${isSection ? 'rm-share-section' : ''}`}
        style={isSection ? { color: `var(--rm-${color})` } : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Mở rộng ${node.title}` : `Thu gọn ${node.title}`}
            className="mt-0.5 inline-flex items-center justify-center size-6 shrink-0 rounded-md hover:bg-secondary/70 text-muted-foreground transition-colors"
          >
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        ) : (
          <span className="inline-flex items-center justify-center size-6 shrink-0" aria-hidden>
            <span className="size-1.5 rounded-full bg-border" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {isSection && (
              <span
                className="text-[11px] font-mono uppercase tracking-wider opacity-80"
                style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
              >
                {nodeTypeLabel(node.nodeType)} {index + 1} / {total}
              </span>
            )}
            <Link
              href={href}
              className={`hover:underline underline-offset-4 ${isSection ? 'text-base font-semibold' : 'text-sm font-medium'}`}
            >
              <span aria-hidden className="mr-1">{emoji}</span>
              {node.title}
            </Link>
            {node.descendantCount > 0 && (
              <span
                className="text-[11px] font-mono opacity-70 px-1.5 py-0.5 rounded-md bg-secondary/60 text-muted-foreground tabular-nums"
                title="Số mục con phía trong"
              >
                {isCollapsed ? `+${node.descendantCount} mục` : `${node.descendantCount} mục`}
              </span>
            )}
            {node.estMinutes ? (
              <span className="text-[11px] text-muted-foreground font-mono">~{node.estMinutes}p</span>
            ) : null}
          </div>

          {!isSection && node.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{node.description}</p>
          )}

          {hasChildren && !isCollapsed && (
            <ul
              className="mt-2 ml-3 space-y-1.5 border-l border-dashed border-border pl-4"
              aria-label={`Mục con của ${node.title}`}
            >
              {node.children.map((child, i) => (
                <TreeRow
                  key={child.id}
                  node={child}
                  linkBase={linkBase}
                  color={color}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  index={i}
                  total={node.children.length}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
