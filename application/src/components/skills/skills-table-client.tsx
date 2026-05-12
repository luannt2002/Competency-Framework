'use client';

/**
 * Client-side Skills Matrix table with:
 * - Search (debounce 200ms)
 * - Filter by Category (multi)
 * - Filter by Level (multi)
 * - Row click → SkillDrawer
 *
 * Data is passed pre-resolved from the Server Component.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, X, Grid3x3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LevelBadge } from '@/components/skills/level-badge';
import { SkillDrawer, type SkillDrawerData, type LevelCode } from '@/components/skills/skill-drawer';

export type SkillRow = {
  skillId: string;
  skillName: string;
  skillSlug: string;
  description: string | null;
  tags: string[] | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  levelCode: string | null;
  targetLevelCode: string | null;
  noteMd: string | null;
  whyThisLevel: string | null;
  evidenceUrls: string[] | null;
  crowns: number | null;
  updatedAt: Date | null;
};

export type Rubric = SkillDrawerData['rubric'];

type Props = {
  workspaceSlug: string;
  rows: SkillRow[];
  rubric: Rubric;
};

const ALL_LEVELS: LevelCode[] = ['XS', 'S', 'M', 'L'];

export function SkillsTableClient({ workspaceSlug, rows, rubric }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.toLowerCase().trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Distinct categories
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string | null }>();
    for (const r of rows) {
      if (!seen.has(r.categoryId)) {
        seen.set(r.categoryId, {
          id: r.categoryId,
          name: r.categoryName,
          color: r.categoryColor,
        });
      }
    }
    return Array.from(seen.values());
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (catFilter.size > 0 && !catFilter.has(r.categoryId)) return false;
      if (levelFilter.size > 0) {
        const lvl = r.levelCode ?? '__none__';
        if (!levelFilter.has(lvl)) return false;
      }
      if (debounced) {
        const hay = `${r.skillName} ${r.categoryName} ${r.tags?.join(' ') ?? ''}`.toLowerCase();
        if (!hay.includes(debounced)) return false;
      }
      return true;
    });
  }, [rows, catFilter, levelFilter, debounced]);

  const selected = useMemo(() => rows.find((r) => r.skillId === selectedId) ?? null, [rows, selectedId]);

  const drawerData: SkillDrawerData | null = selected
    ? {
        skillId: selected.skillId,
        skillName: selected.skillName,
        categoryName: selected.categoryName,
        categoryColor: selected.categoryColor,
        description: selected.description,
        tags: selected.tags ?? undefined,
        currentLevel: (selected.levelCode as LevelCode) ?? null,
        targetLevel: (selected.targetLevelCode as LevelCode) ?? null,
        noteMd: selected.noteMd,
        whyThisLevel: selected.whyThisLevel,
        evidenceUrls: selected.evidenceUrls ?? [],
        crowns: selected.crowns ?? 0,
        rubric,
      }
    : null;

  const hasFilter = catFilter.size > 0 || levelFilter.size > 0 || debounced.length > 0;

  // Workspace has no skills at all — surface a rich empty state instead of an empty table.
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Grid3x3}
        title="No skills in this workspace yet"
        description="The framework template didn't seed any skills, or they were removed. Re-fork the framework to repopulate the matrix."
        action={
          <Button asChild variant="outline">
            <Link href="/onboarding">Re-fork framework</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="surface p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, categories, tags..."
              className="pl-9"
            />
          </div>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setCatFilter(new Set());
                setLevelFilter(new Set());
              }}
              className="self-end md:self-auto shrink-0"
            >
              <X className="size-3" />
              Clear all
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Filter className="size-3" />
            Category:
          </span>
          {categories.map((c) => {
            const active = catFilter.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const next = new Set(catFilter);
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  setCatFilter(next);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
                style={
                  active
                    ? undefined
                    : { borderColor: c.color ? `${c.color}30` : undefined }
                }
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Filter className="size-3" />
            Level:
          </span>
          {ALL_LEVELS.map((lvl) => {
            const active = levelFilter.has(lvl);
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  const next = new Set(levelFilter);
                  if (next.has(lvl)) next.delete(lvl);
                  else next.add(lvl);
                  setLevelFilter(next);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const next = new Set(levelFilter);
              if (next.has('__none__')) next.delete('__none__');
              else next.add('__none__');
              setLevelFilter(next);
            }}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              levelFilter.has('__none__')
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Unassessed
          </button>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        Showing <span className="text-foreground font-medium">{filtered.length}</span> of {rows.length} skills
      </p>

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Skill</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Target</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Crowns</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr
                  key={r.skillId}
                  onClick={() => setSelectedId(r.skillId)}
                  className="transition-colors hover:bg-secondary/40 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.skillName}</div>
                    {r.tags && r.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: `${r.categoryColor ?? '#475569'}40`,
                        color: r.categoryColor ?? undefined,
                      }}
                    >
                      {r.categoryName}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadge code={r.levelCode} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <LevelBadge code={r.targetLevelCode} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-amber-400 tabular-nums">
                    {r.crowns ?? 0}
                    <span className="text-muted-foreground">/5</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No skills match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SkillDrawer
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        workspaceSlug={workspaceSlug}
        data={drawerData}
      />
    </>
  );
}
