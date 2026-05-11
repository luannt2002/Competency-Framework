/**
 * Course Map placeholder.
 * MVP M0: shows 4 level sections + simple list of weeks.
 * M3 (Step 9) will turn this into a Duolingo-style curved SVG path with lock/unlock states.
 */
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { weeks, levelTracks } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { LevelBadge } from '@/components/skills/level-badge';
import { Lock, GraduationCap } from 'lucide-react';

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);

  const tracks = await db
    .select()
    .from(levelTracks)
    .where(eq(levelTracks.workspaceId, ws.id))
    .orderBy(asc(levelTracks.displayOrder));

  const allWeeks = await db
    .select()
    .from(weeks)
    .where(eq(weeks.workspaceId, ws.id))
    .orderBy(asc(weeks.weekIndex));

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      <header className="flex items-center gap-3">
        <GraduationCap className="size-7 text-violet-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Course Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allWeeks.length} weeks across {tracks.length} levels · Duolingo-style path in M3
          </p>
        </div>
      </header>

      {tracks.length === 0 && (
        <div className="surface p-12 text-center text-muted-foreground">
          No course content yet. Re-fork the framework template.
        </div>
      )}

      {tracks.map((track, ti) => {
        const trackWeeks = allWeeks.filter((w) => w.trackId === track.id);
        const isLockedTrack = ti > 0; // MVP M0: only first level unlocked

        return (
          <section key={track.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <LevelBadge code={track.levelCode} size="lg" showLabel />
              <h2 className="text-lg font-semibold">{track.title}</h2>
              {isLockedTrack && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3" /> Locked
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{track.description}</p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {trackWeeks.map((w, i) => {
                const isLocked = isLockedTrack || i > 0;
                return (
                  <article
                    key={w.id}
                    className={`surface p-4 transition-all ${
                      isLocked
                        ? 'opacity-50 grayscale'
                        : 'hover:bg-secondary/40 cursor-pointer hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-mono">Week {w.weekIndex}</span>
                      {isLocked && <Lock className="size-3" />}
                    </div>
                    <h3 className="font-medium text-sm leading-snug">{w.title}</h3>
                    {w.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{w.summary}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="text-xs text-muted-foreground border-t border-border pt-4">
        ⚙️ M3 will replace this with a Duolingo-style curved SVG path with proper lock/unlock logic, week nodes (pulsing when active),
        and click-through to Week Detail with full Lesson Runner.
      </div>
    </div>
  );
}
