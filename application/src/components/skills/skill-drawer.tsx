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
 * - V8 evidence-based verification section (collapsible) with confidence score,
 *   source pill, list of submitted evidence grades, and a "Submit new evidence"
 *   dialog wrapping `<EvidenceForm />`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LevelBadge } from './level-badge';
import { EvidenceForm } from '@/components/evidence/evidence-form';
import { updateAssessment } from '@/actions/assessments';
import {
  computeConfidence,
  listEvidenceForSkill,
  type EvidenceRow,
} from '@/actions/evidence';
import type { ConfidenceResult, ConfidenceSource } from '@/lib/evidence/confidence';
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
  const router = useRouter();
  const [level, setLevel] = useState<LevelCode | null>(data?.currentLevel ?? null);
  const [target, setTarget] = useState<LevelCode | null>(data?.targetLevel ?? null);
  const [why, setWhy] = useState(data?.whyThisLevel ?? '');
  const [note, setNote] = useState(data?.noteMd ?? '');
  const [evidenceText, setEvidenceText] = useState((data?.evidenceUrls ?? []).join('\n'));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // V8 evidence panel state
  const [verifiedOpen, setVerifiedOpen] = useState(false);
  const [evidenceRows, setEvidenceRows] = useState<EvidenceRow[] | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceResult | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [, startEvidenceRefresh] = useTransition();

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
    setVerifiedOpen(false);
    setEvidenceRows(null);
    setConfidence(null);
    setEvidenceError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.skillId]);

  const refreshEvidence = useCallback(async () => {
    if (!data) return;
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const [rows, conf] = await Promise.all([
        listEvidenceForSkill(workspaceSlug, data.skillId),
        computeConfidence(workspaceSlug, data.skillId),
      ]);
      setEvidenceRows(rows);
      setConfidence(conf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load evidence';
      setEvidenceError(msg);
    } finally {
      setEvidenceLoading(false);
    }
  }, [data, workspaceSlug]);

  // Lazy-load evidence the first time the section is opened.
  useEffect(() => {
    if (!verifiedOpen) return;
    if (!data) return;
    if (evidenceRows !== null) return;
    void refreshEvidence();
  }, [verifiedOpen, data, evidenceRows, refreshEvidence]);

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

          {/* EVIDENCE-BASED VERIFICATION (V8) */}
          <section>
            <button
              type="button"
              onClick={() => setVerifiedOpen((o) => !o)}
              aria-expanded={verifiedOpen}
              className="w-full flex items-center gap-2 text-left group"
            >
              {verifiedOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <ShieldCheck className="size-4 text-cyan-400" aria-hidden />
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                Verified evidence (V8)
              </h3>
              <Badge variant="secondary" className="ml-1 font-mono">
                {evidenceRows?.length ?? 0}
              </Badge>
              {confidence && (
                <span className="ml-auto flex items-center gap-1.5">
                  <ConfidenceBadge score={confidence.score} />
                  <SourcePill source={confidence.source} />
                </span>
              )}
            </button>

            {verifiedOpen && (
              <div className="mt-3 space-y-3">
                {evidenceLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading evidence…
                  </div>
                )}
                {evidenceError && (
                  <p className="text-xs text-destructive">{evidenceError}</p>
                )}
                {!evidenceLoading && !evidenceError && evidenceRows && evidenceRows.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No verified evidence yet. Submit a lab, project, peer review, or
                    manager review to build confidence.
                  </p>
                )}
                {!evidenceLoading && !evidenceError && evidenceRows && evidenceRows.length > 0 && (
                  <ul className="space-y-2">
                    {evidenceRows.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <KindBadge kind={row.kind} />
                          <span className="font-mono tabular-nums">{row.score}/100</span>
                          {row.reviewerUserId && (
                            <span className="text-muted-foreground">
                              · reviewer ✓
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground tabular-nums">
                            {formatShortDate(row.createdAt)}
                          </span>
                        </div>
                        {row.evidenceUrl && (
                          <a
                            href={row.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-primary hover:underline truncate"
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">{row.evidenceUrl}</span>
                          </a>
                        )}
                        {row.note && (
                          <p className="mt-1 text-muted-foreground line-clamp-2">{row.note}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEvidenceDialogOpen(true)}
                  className="w-full"
                >
                  <Plus className="size-3" />
                  Submit new evidence
                </Button>
              </div>
            )}

            <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Submit evidence — {data.skillName}</DialogTitle>
                  <DialogDescription>
                    Each submission contributes to your confidence score for this
                    skill. Manager reviews unlock the &ldquo;verified&rdquo; state.
                  </DialogDescription>
                </DialogHeader>
                <EvidenceForm
                  workspaceSlug={workspaceSlug}
                  skillId={data.skillId}
                  skillName={data.skillName}
                  onSubmitted={() => {
                    setEvidenceDialogOpen(false);
                    startEvidenceRefresh(() => {
                      void refreshEvidence();
                    });
                    router.refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
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

function ConfidenceBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      : score >= 40
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
        : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums',
        tone,
      )}
      title={`Confidence ${score} / 100`}
    >
      {score}
    </span>
  );
}

function SourcePill({ source }: { source: ConfidenceSource }) {
  if (source === 'verified') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-transparent bg-gradient-to-r from-cyan-400/30 to-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-foreground"
        title="Verified — manager review on file"
      >
        <ShieldCheck className="size-3" /> verified
      </span>
    );
  }
  if (source === 'learned') {
    return (
      <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
        learned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      self-claimed
    </span>
  );
}

const KIND_LABEL: Record<EvidenceRow['kind'], string> = {
  lab: 'Lab',
  project: 'Project',
  peer_review: 'Peer',
  manager_review: 'Manager',
};

const KIND_TONE: Record<EvidenceRow['kind'], string> = {
  lab: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  project: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  peer_review: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  manager_review: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

function KindBadge({ kind }: { kind: EvidenceRow['kind'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        KIND_TONE[kind],
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

function formatShortDate(d: Date | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
