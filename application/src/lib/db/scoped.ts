/**
 * Workspace-scoped DAL helper.
 *
 * Every query that touches workspace-owned data MUST go through `withWorkspace(workspaceId)`
 * so we can enforce tenant isolation at the code level (in addition to RLS).
 *
 * Usage:
 *   const data = await withWorkspace(workspaceId, (db, wsId) =>
 *     db.select().from(skills).where(eq(skills.workspaceId, wsId))
 *   );
 */
import { db, type Db } from './client';

export async function withWorkspace<T>(
  workspaceId: string,
  fn: (db: Db, workspaceId: string) => Promise<T>,
): Promise<T> {
  if (!workspaceId) throw new Error('workspaceId is required');
  return fn(db, workspaceId);
}

export { db };
