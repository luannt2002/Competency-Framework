/**
 * ETL server actions — kick off ingestion runs from the web UI.
 *
 * Flow:
 *   1. Resolve workspace by slug + verify the current user owns it.
 *   2. Open an `import_logs` row with status='running'.
 *   3. Call {@link runIngestion}.
 *   4. Update the `import_logs` row with the result.
 *   5. Return the IngestionResult to the caller.
 *
 * No background queue here — the action returns once ingestion finishes. For
 * very large imports we can upgrade to a queue later; for the current
 * markdown/CSV scale (a few hundred rows) this is fast enough.
 */
'use server';

import { z } from 'zod';
import { resolve } from 'node:path';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { importLogs } from '@/lib/db/schema-etl';
import { requireUser } from '@/lib/auth/supabase-server';
import { runIngestion, type IngestionResult } from '@/lib/etl/import-runner';

const sourceEnum = z.enum(['markdown', 'csv']);
const inputSchema = z.object({
  workspaceSlug: z.string().min(1),
  source: sourceEnum,
});

export type EtlSourceKind = z.infer<typeof sourceEnum>;

export interface RunIngestionResponse {
  logId: string;
  result: IngestionResult;
}

/* ============================ helpers ============================ */

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return rows[0];
}

/**
 * Repo root (relative to the Next.js application directory). The 5 PHASE
 * markdown files live one level up from `application/`.
 */
function repoRoot(): string {
  return resolve(process.cwd(), '..');
}

const MARKDOWN_FILES = [
  '02_PHASE1_AWS_TERRAFORM_DEEP_DIVE_Q1.md',
  '03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md',
  '04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md',
  '05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md',
];

const CSV_FILES = {
  skills: 'application/drizzle/seeds/raw-csv/skills.csv',
  levels: 'application/drizzle/seeds/raw-csv/levels.csv',
};

/* ============================ action ============================ */

export async function runWorkspaceIngestion(
  workspaceSlug: string,
  source: EtlSourceKind,
): Promise<RunIngestionResponse> {
  const user = await requireUser();
  const parsed = inputSchema.parse({ workspaceSlug, source });
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  const sourceKind = parsed.source === 'markdown' ? 'markdown' : 'csv_skills';
  const sourceRef =
    parsed.source === 'markdown'
      ? MARKDOWN_FILES.join(',')
      : `${CSV_FILES.skills},${CSV_FILES.levels}`;

  const [logRow] = await db
    .insert(importLogs)
    .values({
      workspaceId: ws.id,
      sourceKind,
      sourceRef,
      status: 'running',
    })
    .returning({ id: importLogs.id });
  if (!logRow) throw new Error('IMPORT_LOG_INSERT_FAILED');

  try {
    const root = repoRoot();
    const result = await runIngestion({
      workspaceId: ws.id,
      actorUserId: user.id,
      sources:
        parsed.source === 'markdown'
          ? { markdownPaths: MARKDOWN_FILES.map((f) => resolve(root, f)) }
          : {
              skillsCsvPath: resolve(root, CSV_FILES.skills),
              levelsCsvPath: resolve(root, CSV_FILES.levels),
            },
    });

    await db
      .update(importLogs)
      .set({
        status: result.errors.length > 0 ? 'failed' : 'succeeded',
        payload: {
          inserted: result.inserted,
          updated: result.updated,
          byTable: result.byTable,
          errors: result.errors,
        },
        errorText: result.errors.length > 0 ? result.errors[0]?.reason ?? null : null,
        finishedAt: new Date(),
      })
      .where(eq(importLogs.id, logRow.id));

    revalidatePath(`/w/${ws.slug}`);
    return { logId: logRow.id, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await db
      .update(importLogs)
      .set({
        status: 'failed',
        errorText: message,
        finishedAt: new Date(),
      })
      .where(eq(importLogs.id, logRow.id));
    throw err;
  }
}
