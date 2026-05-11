/**
 * Role Profiles page — V8.
 *
 * Lists workspace role profiles, shows the user's current target (if any),
 * and lets them pick / change their target role.
 */
import Link from 'next/link';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  roleSkillRequirements,
  userRoleTargets,
} from '@/lib/db/schema-v8';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { listRoleProfiles } from '@/actions/role-profiles';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Compass, Sparkles, Target } from 'lucide-react';
import {
  RoleTargetForm,
  type RoleOption,
} from '@/components/roles/role-target-form';

export default async function RolesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  const [roles, currentTargetRow, reqCountRows] = await Promise.all([
    listRoleProfiles(ws.slug),
    db
      .select({
        roleId: userRoleTargets.roleId,
        targetDate: userRoleTargets.targetDate,
      })
      .from(userRoleTargets)
      .where(
        and(
          eq(userRoleTargets.workspaceId, ws.id),
          eq(userRoleTargets.userId, user.id),
        ),
      )
      .limit(1),
    db
      .select({
        roleId: roleSkillRequirements.roleId,
        n: sql<number>`count(*)::int`,
      })
      .from(roleSkillRequirements)
      .where(eq(roleSkillRequirements.workspaceId, ws.id))
      .groupBy(roleSkillRequirements.roleId),
  ]);

  const currentTarget = currentTargetRow[0] ?? null;
  const reqCountByRole = new Map<string, number>(
    reqCountRows.map((r) => [r.roleId, Number(r.n)]),
  );

  const roleOptions: RoleOption[] = roles.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
  }));

  const currentRoleName = currentTarget
    ? roles.find((r) => r.id === currentTarget.roleId)?.name ?? null
    : null;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      <section className="space-y-2">
        <Link
          href={`/w/${ws.slug}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to dashboard
        </Link>
        <Badge variant="outline" className="mt-1">
          <Compass className="size-3 text-violet-400" />
          Career Roles
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Role profiles</h1>
        <p className="text-muted-foreground">
          Pick a role you&apos;re aiming for. The dashboard will surface your gap
          against its required skill levels.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4 text-cyan-400" />
              Your current target
            </CardTitle>
            <CardDescription>
              {currentRoleName
                ? `You're aiming for ${currentRoleName}.`
                : 'No target set yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleTargetForm
              workspaceSlug={ws.slug}
              roles={roleOptions}
              currentRoleId={currentTarget?.roleId ?? null}
              currentTargetDate={currentTarget?.targetDate ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-amber-400" />
              Available roles
            </CardTitle>
            <CardDescription>
              {roles.length === 0
                ? 'No roles yet — ask a workspace admin to create one.'
                : `${roles.length} role${roles.length === 1 ? '' : 's'} in this workspace.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Nothing here yet.
              </p>
            )}
            {roles.map((r) => {
              const reqCount = reqCountByRole.get(r.id) ?? 0;
              const isActive = currentTarget?.roleId === r.id;
              return (
                <div
                  key={r.id}
                  className={
                    isActive
                      ? 'rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'
                      : 'rounded-xl border border-border bg-secondary/30 p-3'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{r.name}</p>
                        {isActive && (
                          <Badge variant="success" className="font-mono text-[10px]">
                            <Target className="size-3" />
                            current
                          </Badge>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      {reqCount} skill{reqCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {currentTarget && (
        <section>
          <Button asChild variant="outline">
            <Link href={`/w/${ws.slug}`}>
              View dashboard gap radar
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}
