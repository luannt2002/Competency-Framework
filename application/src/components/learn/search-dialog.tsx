/**
 * SearchDialog — Cmd/Ctrl+K command-palette style global search.
 *
 * - Fetches all nodes once (small payload) via `searchNodes` server action,
 *   then filters client-side as the user types (fuzzy on title + nodeType
 *   label). Avoids a round-trip per keystroke.
 * - Keyboard: ↑/↓ to navigate, Enter to open, Esc/click-outside to close.
 * - Visual: paper-coral palette (`bg-card` / `border-border` / `primary`).
 *
 * Wired into `Topbar` — clicking the search button or pressing Cmd/Ctrl+K
 * opens the dialog.
 */
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, FileText, X } from 'lucide-react';
import { searchNodes, type SearchNode } from '@/actions/search';
import { typeMeta } from '@/components/learn/node-card';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
};

/** Light fuzzy match: every char of query must appear in target in order. */
function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 1000 - t.indexOf(q); // substring is best
  let qi = 0;
  let score = 0;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      score += 1;
      qi += 1;
    }
  }
  return qi === q.length ? score : 0;
}

export function SearchDialog({ open, onOpenChange, workspaceSlug }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<SearchNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Lazy-load nodes the first time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (nodes !== null) return;
    setLoading(true);
    searchNodes(workspaceSlug)
      .then((rows) => {
        setNodes(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Search failed');
      })
      .finally(() => setLoading(false));
  }, [open, workspaceSlug, nodes]);

  // Focus input on open + reset query.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!nodes) return [];
    const q = query.trim();
    if (!q) return nodes.slice(0, 30);
    const scored = nodes
      .map((n) => {
        const label = typeMeta(n.nodeType).label;
        const titleScore = fuzzyScore(q, n.title);
        const labelScore = fuzzyScore(q, label);
        const score = Math.max(titleScore, labelScore * 0.5);
        return { node: n, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((s) => s.node);
    return scored;
  }, [nodes, query]);

  // Keep active index in bounds when results shrink.
  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  // Scroll active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const navigate = useCallback(
    (node: SearchNode) => {
      onOpenChange(false);
      router.push(`/w/${workspaceSlug}/n/${node.slug}`);
    },
    [router, workspaceSlug, onOpenChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) navigate(picked);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]"
      onKeyDown={onKeyDown}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Tìm node theo title hoặc loại..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <kbd
            className="hidden sm:inline-flex items-center rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
          >
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Đóng"
            className="rounded-md p-1 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!error && (
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[50vh] overflow-y-auto py-1"
          >
            {!loading && results.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                {nodes === null
                  ? 'Đang tải...'
                  : query.trim()
                    ? 'Không tìm thấy node phù hợp.'
                    : 'Bắt đầu gõ để tìm kiếm.'}
              </li>
            )}
            {results.map((node, idx) => {
              const meta = typeMeta(node.nodeType);
              const Icon = meta.icon;
              const active = idx === activeIndex;
              return (
                <li key={node.id} role="option" aria-selected={active} data-idx={idx}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(node)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      active ? 'bg-primary/10' : 'hover:bg-secondary/60',
                    )}
                  >
                    <div className={cn('size-7 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
                      <Icon className={cn('size-3.5', meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-foreground">
                        {node.title}
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5"
                        style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                      >
                        {meta.label} · /{node.slug}
                      </div>
                    </div>
                    <FileText className="size-3.5 text-muted-foreground/60 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div
          className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border text-[10px] text-muted-foreground"
          style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
        >
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-border bg-secondary/50 px-1">↑↓</kbd> điều hướng
            </span>
            <span>
              <kbd className="rounded border border-border bg-secondary/50 px-1">↵</kbd> mở
            </span>
          </div>
          <span>{results.length} / {nodes?.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
