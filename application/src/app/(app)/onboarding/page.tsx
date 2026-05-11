/**
 * Onboarding — pick first framework template and fork it into a new workspace.
 * MVP: only DevOps Mastery template available.
 *
 * The fork server action will be implemented in M1 (Step 5).
 * This page renders a static UI for now so users can sign in and see flow.
 */
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/supabase-server';
import { listMyWorkspaces } from '@/lib/workspace';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function OnboardingPage() {
  await requireUser();

  // If user already has a workspace, redirect to it
  const mine = await listMyWorkspaces();
  if (mine.length > 0 && mine[0]?.slug) {
    redirect(`/w/${mine[0].slug}`);
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="mx-auto size-14 rounded-2xl accent-gradient flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30">
            <Sparkles className="size-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Competency Framework</h1>
          <p className="mt-2 text-muted-foreground">
            Pick a framework to fork into your first workspace.
          </p>
        </div>

        <div className="space-y-3">
          <article className="surface p-6 flex items-center gap-4 hover:bg-secondary/40 transition-colors cursor-pointer">
            <div className="text-3xl">☁️</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">DevOps Mastery</h3>
              <p className="text-sm text-muted-foreground">
                AWS · Terraform · Kubernetes · Go · DevSecOps · Platform Engineering
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ~40 skills · 4 levels · 48 weeks of lessons
              </p>
            </div>
            <Button>
              Fork <ArrowRight className="size-4" />
            </Button>
          </article>

          <article className="surface p-6 flex items-center gap-4 opacity-50">
            <div className="text-3xl">🎨</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">Frontend Engineer</h3>
              <p className="text-sm text-muted-foreground">React · Next.js · CSS · Performance</p>
            </div>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </article>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          [M1 will implement actual fork action — schema is ready in `framework_templates`.]
        </p>
      </div>
    </main>
  );
}
