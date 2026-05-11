'use client';

/**
 * SkillDrawer — slide-in panel for self-assessment.
 *
 * Features:
 * - Level radio cards (XS/S/M/L) with gradient on selected
 * - Why this level? textarea
 * - Evidence URLs (one per line, validated on save)
 * - Notes (markdown plain)
 * - Target level
 * - Auto-save 700ms debounce; "Saved ✓" indicator
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Loader2, Sparkles, Target } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LevelBadge } from './level-badge';
import { updateAssessment } from '@/actions/assessments';
import { cn } from '@/lib/utils';

export type LevelCode = 'XS' | 'S' | 'M' | 'L';

export type SkillDrawerData = {
  skillId: string;
  skillName: string;
  categoryName: string;
  categoryColor?: string | null;
  description?: string | null;
  tags?: string[];
  currentLevel?: LevelCode | null;
  targetLevel?: LevelCode | null;
  noteMd?: string | null;
  whyThisLevel?: string | null;
  evidenceUrls?: string[];
  crowns?: number;
  rubric: Array<{
    code: string;
    label: string;
    description?: string | null;
    examples?: string | null;
  }>;
};

const LEVELS: LevelCode[] = ['XS', 'S', 'M', 'L'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  data: SkillDrawerData | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SkillDrawer({ open, onOpenChange, workspaceSlug, data }: Props) {
  const [level, setLevel] = useState<LevelCode | null>(data?.currentLevel ?? null);
  const [target, setTarget] = useState<LevelCode | null>(data?.targetLevel ?? null);
  const [why, setWhy] = useState(data?.whyThisLevel ?? '');
  const [note, setNote] = useState(data?.noteMd ?? '');
  const [evidenceText, setEvidenceText] = useState((data?.evidenceUrls ?? []).join('\n'));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when skill changes
  useEffect(() => {
    if (!data) return;
    setLevel(data.currentLevel ?? null);
    setTarget(data.targetLevel ?? null);
    setWhy(data.whyThisLevel ?? '');
    setNote(data.noteMd ?? '');
    setEvidenceText((data.evidenceUrls ?? []).join('\n'));
    setSaveState('idle');
    setError(null);
  }, [data?.skillId]);

  const evidenceUrls = useMemo(
    () =>
      evidenceText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [evidenceText],
  );

  // Auto-save debounced
  useEffect(() => {
    if (!data) return;
    if (saveState === 'idle' && level === (data.currentLevel ?? null) && note === (data.noteMd ?? '') && why === (data.whyThisLevel ?? '') && target === (data.targetLevel ?? null) && evidenceText === ((data.evidenceUrls ?? []).join('\n'))) {
      // Nothing changed yet
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        // Validate evidence URLs locally before sending
        for (const u of evidenceUrls) {
          try {
            new URL(u);
          } catch {
            throw new Error(`Invalid URL: ${u}`);
          }
        }
        await updateAssessment({
          workspaceSlug,
          skillId: data.skillId,
          levelCode: level,
          noteMd: note,
          whyThisLevel: why,
          evidenceUrls,
          targetLevelCode: target,
        });
        setSaveState('saved');
        setError(null);
      } catch (e) {
        setSaveState('error');
        const msg = e instanceof Error ? e.message : 'Save failed';
        setError(msg);
        toast.error('Could not save', { description: msg });
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, note, why, target, evidenceText]);

  if (!data) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={{
                borderColor: `${data.categoryColor ?? '#475569'}40`,
                color: data.categoryColor ?? undefined,
              }}
            >
              {data.categoryName}
            </Badge>
            {(data.crowns ?? 0) > 0 && (
              <Badge variant="warning">
                <Sparkles className="size-3" />
                {data.crowns}/5 crowns
              </Badge>
            )}
            <SaveIndicator state={saveState} error={error} />
          </div>
          <SheetTitle>{data.skillName}</SheetTitle>
          {data.description && <SheetDescription>{data.description}</SheetDescription>}
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {data.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="p-6 space-y-8">
          {/* RUBRIC */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Rubric
            </h3>
            <div className="space-y-2">
              {data.rubric.map((r) => (
                <div
                  key={r.code}
                  className={cn(
                    'rounded-xl border p-3 transition-all',
                    level === r.code
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-secondary/20',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <LevelBadge code={r.code} />
                    <span className="text-sm font-medium">{r.label}</span>
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {r.description}
                    </p>
                  )}
                  {r.examples && (
                    <p className="text-xs text-muted-foreground/80 mt-1 italic">
                      e.g., {r.examples}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* CURRENT LEVEL */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Your current level
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel((cur) => (cur === lvl ? null : lvl))}
                  className={cn(
                    'rounded-xl border p-3 text-center transition-all active:scale-95',
                    level === lvl
                      ? 'border-primary bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-2 ring-primary/40'
                      : 'border-border bg-secondary/30 hover:bg-secondary/60',
                  )}
                >
                  <div className="font-mono font-bold text-lg">{lvl}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {data.rubric.find((r) => r.code === lvl)?.label ?? ''}
                  </div>
                </button>
              ))}
            </div>
            {level && (
              <button
                type="button"
                onClick={() => setLevel(null)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear level
              </button>
            )}
          </section>

          {/* TARGET LEVEL */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
              <Target className="size-3" />
              Target level
            </h3>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setTarget((cur) => (cur === lvl ? null : lvl))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    target === lvl
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </section>

          {/* WHY */}
          <section>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Why this level?
            </label>
            <Textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Brief justification — what have you done that proves this level?"
              rows={3}
            />
          </section>

          {/* EVIDENCE */}
          <section>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Evidence links (one URL per line)
            </label>
            <Textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder="https://github.com/you/repo&#10;https://blog.example.com/post"
              rows={3}
              className="font-mono text-xs"
            />
            {evidenceUrls.length > 0 && (
              <div className="mt-2 space-y-1">
                {evidenceUrls.map((u, i) => (
                  <a
                    key={i}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{u}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* NOTE */}
          <section>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Notes (markdown)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Personal notes about this skill, study plan, references..."
              rows={5}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === 'saving') {
    return (
      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="size-3" />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="ml-auto inline-flex items-center gap-1 text-xs text-destructive" title={error ?? ''}>
        Save failed
      </span>
    );
  }
  return null;
}
