/**
 * Onboarding — pick first framework template and fork it.
 * Server Component renders templates list; form posts to `forkTemplate` server action.
 */
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/supabase-server';
import { listMyWorkspaces } from '@/lib/workspace';
import { db } from '@/lib/db/client';
import { frameworkTemplates } from '@/lib/db/schema';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { forkTemplate } from '@/actions/workspaces';

export default async function OnboardingPage() {
  await requireUser();

  // If user already has a workspace, jump to it
  const mine = await listMyWorkspaces();
  if (mine.length > 0 && mine[0]?.slug) {
    redirect(`/w/${mine[0].slug}`);
  }

  // Load published templates
  const templates = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.isPublished, true))
    .orderBy(frameworkTemplates.createdAt);

  return (
    <main
      className="min-h-dvh flex items-center justify-center p-6 bg-background"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="mx-auto size-14 rounded-2xl accent-gradient flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/20">
            <Sparkles className="size-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome to{' '}
            <span className="accent-gradient-text">Competency Framework</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Pick a framework to fork into your first workspace.
          </p>
        </div>

        {templates.length === 0 && (
          <div className="surface p-8 text-center text-sm text-muted-foreground">
            No framework templates yet. Run{' '}
            <code className="font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded">
              pnpm db:seed
            </code>{' '}
            to seed the DevOps framework.
          </div>
        )}

        <div className="space-y-3">
          {templates.map((tpl) => (
            <form key={tpl.id} action={forkTemplate}>
              <input type="hidden" name="templateId" value={tpl.id} />
              <input type="hidden" name="slug" value={tpl.slug} />
              <input type="hidden" name="name" value={tpl.name} />
              <article className="surface p-6 flex items-center gap-4 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="size-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                  {tpl.domain === 'engineering' ? '☁️' : '✨'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-foreground">{tpl.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      v{tpl.version}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {tpl.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    Forked {tpl.forksCount ?? 0} times
                  </p>
                </div>
                <Button type="submit" className="shrink-0">
                  Fork <ArrowRight className="size-4" />
                </Button>
              </article>
            </form>
          ))}

          {/* Placeholder coming-soon frameworks */}
          {(['Frontend Engineer', 'Backend Engineer', 'Data Engineer'] as const).map((name) => (
            <article
              key={name}
              className="surface p-6 flex items-center gap-4 opacity-60"
            >
              <div className="size-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                {name.includes('Frontend') ? '🎨' : name.includes('Backend') ? '⚙️' : '📊'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-foreground">{name}</h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider shrink-0">
                Coming soon
              </span>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Forking copies the framework into your workspace where you can customize it.
        </p>
      </div>
    </main>
  );
}
