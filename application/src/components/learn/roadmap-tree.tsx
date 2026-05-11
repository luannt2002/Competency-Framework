'use client';

/**
 * Recursive roadmap tree — Tier 1 (career level) → Tier 2 (week) → Tier 3 (module/lesson/lab).
 * Expand/collapse per node. URL state persists via search params.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  GraduationCap,
  BookOpen,
  Beaker,
  Sparkles,
  Target,
  Clock,
  Lock,
} from 'lucide-react';
import { LevelBadge } from '@/components/skills/level-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TreeExercise = { id: string; kind: string; promptMd: string };
export type TreeLesson = {
  id: string;
  slug: string;
  title: string;
  estMinutes: number | null;
  introMd: string | null;
  exercises: TreeExercise[];
};
export type TreeModule = {
  id: string;
  title: string;
  summary: string | null;
  lessons: TreeLesson[];
};
export type TreeLab = {
  id: string;
  title: string;
  description: string | null;
  estMinutes: number | null;
};
export type TreeWeek = {
  id: string;
  weekIndex: number;
  title: string;
  summary: string | null;
  goals: string[];
  keywords: string[];
  estHours: number | null;
  modules: TreeModule[];
  labs: TreeLab[];
};
export type TreeTrack = {
  id: string;
  levelCode: string;
  title: string;
  description: string | null;
  weeks: TreeWeek[];
  unlocked: boolean;
};

type Props = {
  workspaceSlug: string;
  tracks: TreeTrack[];
};

export function RoadmapTree({ workspaceSlug, tracks }: Props) {
  // Default: ALL tracks expanded so the hierarchy is immediately visible
  const [openTracks, setOpenTracks] = useState<Set<string>>(
    new Set(tracks.map((t) => t.levelCode)),
  );
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openLessons, setOpenLessons] = useState<Set<string>>(new Set());

  const toggleTrack = (code: string) => {
    const next = new Set(openTracks);
    next.has(code) ? next.delete(code) : next.add(code);
    setOpenTracks(next);
  };
  const toggleWeek = (id: string) => {
    const next = new Set(openWeeks);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenWeeks(next);
  };
  const toggleModule = (id: string) => {
    const next = new Set(openModules);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenModules(next);
  };
  const toggleLesson = (id: string) => {
    const next = new Set(openLessons);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenLessons(next);
  };

  const expandAll = () => {
    setOpenTracks(new Set(tracks.map((t) => t.levelCode)));
    const wkIds = tracks.flatMap((t) => t.weeks.map((w) => w.id));
    setOpenWeeks(new Set(wkIds));
    const modIds = tracks.flatMap((t) => t.weeks.flatMap((w) => w.modules.map((m) => m.id)));
    setOpenModules(new Set(modIds));
    const lsnIds = tracks.flatMap((t) =>
      t.weeks.flatMap((w) => w.modules.flatMap((m) => m.lessons.map((l) => l.id))),
    );
    setOpenLessons(new Set(lsnIds));
  };
  const collapseAll = () => {
    setOpenTracks(new Set());
    setOpenWeeks(new Set());
    setOpenModules(new Set());
    setOpenLessons(new Set());
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Expand all
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Collapse all
        </button>
      </div>

      {tracks.map((track) => {
        const isOpen = openTracks.has(track.levelCode);
        const totalLessons = track.weeks.reduce(
          (n, w) => n + w.modules.reduce((m, mod) => m + mod.lessons.length, 0),
          0,
        );
        const totalLabs = track.weeks.reduce((n, w) => n + w.labs.length, 0);
        const totalExercises = track.weeks.reduce(
          (n, w) =>
            n + w.modules.reduce((m, mod) => m + mod.lessons.reduce((l, ls) => l + ls.exercises.length, 0), 0),
          0,
        );

        return (
          <article
            key={track.id}
            className={cn(
              'surface overflow-hidden transition-all',
              !track.unlocked && 'opacity-60',
            )}
          >
            {/* Tier 1: Career Level */}
            <header
              onClick={() => toggleTrack(track.levelCode)}
              className="cursor-pointer hover:bg-secondary/40 p-4 flex items-center gap-3"
            >
              {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
              <LevelBadge code={track.levelCode} showLabel size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-lg truncate">{track.title}</h2>
                <p className="text-xs text-muted-foreground line-clamp-1">{track.description}</p>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                <Stat icon={Clock} value={track.weeks.length} suffix="weeks" />
                <Stat icon={BookOpen} value={totalLessons} suffix="lessons" />
                <Stat icon={Beaker} value={totalLabs} suffix="labs" />
                <Stat icon={Target} value={totalExercises} suffix="ex" />
              </div>
              {!track.unlocked && <Lock className="size-4 text-muted-foreground shrink-0" />}
            </header>

            {/* Tier 2: Weeks */}
            {isOpen && (
              <div className="border-t border-border bg-secondary/10">
                {track.weeks.map((week) => {
                  const wkOpen = openWeeks.has(week.id);
                  return (
                    <div key={week.id} className="border-b border-border/50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleWeek(week.id)}
                        className="w-full text-left flex items-center gap-3 px-6 py-3 hover:bg-secondary/40 transition-colors"
                      >
                        {wkOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                        <span className="font-mono text-xs text-muted-foreground shrink-0">W{week.weekIndex.toString().padStart(2, '0')}</span>
                        <span className="flex-1 text-sm font-medium truncate">{week.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {week.modules.length}M · {week.modules.reduce((n, m) => n + m.lessons.length, 0)}L · {week.labs.length}Lab
                        </span>
                        <Link
                          href={`/w/${workspaceSlug}/learn/${track.levelCode}/${week.weekIndex}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-primary hover:underline shrink-0"
                        >
                          Open →
                        </Link>
                      </button>

                      {/* Tier 3: Modules + Labs */}
                      {wkOpen && (
                        <div className="pl-12 pr-4 py-2 space-y-1 bg-background/40">
                          {/* Summary + goals + keywords */}
                          {(week.summary || week.goals.length > 0) && (
                            <div className="mb-2 px-3 py-2 rounded bg-card/60 border border-border/50 text-xs space-y-1">
                              {week.summary && (
                                <p className="text-muted-foreground italic">{week.summary}</p>
                              )}
                              {week.goals.length > 0 && (
                                <ul className="space-y-0.5">
                                  {week.goals.slice(0, 3).map((g, i) => (
                                    <li key={i} className="text-muted-foreground flex items-start gap-1">
                                      <span className="text-cyan-400 mt-1">·</span>
                                      <span>{g}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {week.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {week.keywords.slice(0, 6).map((k) => (
                                    <span key={k} className="text-[9px] px-1.5 py-0 rounded bg-secondary text-muted-foreground">{k}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Modules */}
                          {week.modules.map((mod) => {
                            const modOpen = openModules.has(mod.id);
                            return (
                              <div key={mod.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleModule(mod.id)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60 text-left"
                                >
                                  {modOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                  <span className="text-xs font-medium flex-1">{mod.title}</span>
                                  <span className="text-[9px] text-muted-foreground">{mod.lessons.length} lessons</span>
                                </button>

                                {modOpen && (
                                  <ul className="pl-6 py-1 space-y-0.5">
                                    {mod.lessons.map((lesson) => {
                                      const lsnOpen = openLessons.has(lesson.id);
                                      return (
                                        <li key={lesson.id}>
                                          <button
                                            type="button"
                                            onClick={() => toggleLesson(lesson.id)}
                                            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/60 text-[11px] text-left"
                                          >
                                            {lsnOpen ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
                                            <BookOpen className="size-3 text-cyan-400" />
                                            <span className="flex-1 truncate">{lesson.title}</span>
                                            <span className="text-[9px] text-muted-foreground">{lesson.exercises.length}ex · {lesson.estMinutes}m</span>
                                            <Link
                                              href={`/w/${workspaceSlug}/learn/${track.levelCode}/${week.weekIndex}/${lesson.slug}`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-[9px] text-primary hover:underline"
                                            >
                                              Start →
                                            </Link>
                                          </button>

                                          {/* Tier 4: Exercises (preview) */}
                                          {lsnOpen && (
                                            <div className="pl-8 py-1 space-y-1">
                                              {lesson.introMd && (
                                                <p className="text-[10px] text-muted-foreground italic px-2 line-clamp-2">{lesson.introMd}</p>
                                              )}
                                              {lesson.exercises.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground italic px-2">No exercises.</p>
                                              ) : (
                                                <ul className="space-y-0.5">
                                                  {lesson.exercises.map((ex, i) => (
                                                    <li
                                                      key={ex.id}
                                                      className="flex items-start gap-2 px-2 py-1 rounded text-[10px] bg-background/60 border border-border/30"
                                                    >
                                                      <span className="font-mono text-muted-foreground tabular-nums shrink-0">{i + 1}.</span>
                                                      <Badge variant="outline" className="text-[8px] shrink-0">{ex.kind}</Badge>
                                                      <span className="flex-1 text-muted-foreground line-clamp-2">{ex.promptMd}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          })}

                          {/* Labs */}
                          {week.labs.length > 0 && (
                            <div className="pt-1">
                              <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                <Beaker className="size-3 text-cyan-400" />
                                Hands-on Labs
                              </div>
                              <ul className="pl-2 space-y-0.5">
                                {week.labs.map((lab) => (
                                  <li
                                    key={lab.id}
                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/40 text-[11px]"
                                  >
                                    <Beaker className="size-3 text-emerald-400" />
                                    <span className="flex-1 truncate">{lab.title}</span>
                                    <Badge variant="outline" className="text-[9px]">+50 XP</Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {week.modules.length === 0 && week.labs.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic px-2 py-1">
                              No detailed content yet for this week.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Stat({ icon: Icon, value, suffix }: { icon: typeof Clock; value: number; suffix: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      <Icon className="size-3" />
      <span className="font-medium">{value}</span>
      <span>{suffix}</span>
    </span>
  );
}
