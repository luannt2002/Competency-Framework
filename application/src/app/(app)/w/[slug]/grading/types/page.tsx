/**
 * /w/[slug]/grading/types — the exercise-kind catalogue (EDITOR+).
 *
 * Server Component. Lists every kind usable in this workspace (global
 * built-ins + the tenant's own) and hosts the form that creates new ones.
 * Creating a kind here is a row in `exercise_types` — no code change, no
 * migration, no deploy.
 *
 * Engines come from the code registry via `listExerciseTypes`, so the dropdown
 * can never offer an engine the server would reject.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Blocks } from 'lucide-react';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { listExerciseTypesForWorkspace } from '@/lib/exercises/type-repo';
import { listGraderEngines, getGrader } from '@/lib/exercises/registry';
import { Button } from '@/components/ui/button';
import {
  ExerciseTypeManager,
  type EngineChoice,
  type ExerciseTypeCard,
} from '@/components/exercises/exercise-type-manager';

export default async function ExerciseTypesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await resolveWorkspace(slug, RBAC_LEVELS.EDITOR);
  } catch {
    redirect(`/w/${slug}`);
  }
  const { ws, ctx: rbac } = ctx;

  const rows = await listExerciseTypesForWorkspace(ws.id, { includeInactive: true });

  const types: ExerciseTypeCard[] = rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    description: t.description,
    gradingMode: t.gradingMode,
    engine: t.engine,
    secretFields: t.secretFields,
    isBuiltin: t.isBuiltin,
    isActive: t.isActive,
  }));

  const engines: EngineChoice[] = listGraderEngines().map((engine) => ({
    engine,
    mode: getGrader(engine)?.mode ?? 'auto',
  }));

  return (
    <div
      className="mx-auto max-w-6xl space-y-8 p-6 md:p-10"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex flex-wrap items-center gap-4">
        <div className="accent-gradient flex size-12 items-center justify-center rounded-2xl">
          <Blocks className="size-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dạng bài</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ws.name} · {types.length} dạng bài dùng được trong workspace này.
          </p>
        </div>
        <Button asChild variant="outline" className="ml-auto">
          <Link href={`/w/${ws.slug}/grading`}>
            <ArrowLeft className="size-4" aria-hidden />
            Hàng đợi chấm
          </Link>
        </Button>
      </header>

      <ExerciseTypeManager
        workspaceSlug={ws.slug}
        types={types}
        engines={engines}
        canEdit={rbac.level >= RBAC_LEVELS.EDITOR}
      />
    </div>
  );
}
