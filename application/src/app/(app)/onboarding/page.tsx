/**
 * Onboarding wizard — 3-step flow for new users.
 *
 * Step 1 (default): pick a framework template OR start blank.
 * Step 2: name your workspace (slug auto-derived).
 * Step 3: welcome / quick-start tips + CTA into the freshly created workspace.
 *
 * Step is driven by ?step=1|2|3. Workspace id is carried in ?ws=<uuid> from
 * step 2 onwards. Existing users with a workspace are bounced to /w/<slug>
 * unless ?force=1 is set (used by the "+ Tạo workspace mới" affordance).
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/supabase-server';
import { listMyWorkspaces } from '@/lib/workspace';
import { db } from '@/lib/db/client';
import { frameworkTemplates, workspaces as workspacesT } from '@/lib/db/schema';
import { Sparkles, ArrowRight, Plus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  forkTemplateForOnboarding,
  createBlankWorkspace,
  renameOnboardingWorkspace,
} from '@/actions/workspaces';
import { toSlug } from '@/lib/utils';

type SearchParams = Promise<{
  step?: string;
  ws?: string;
  slug?: string;
  force?: string;
}>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const step = sp.step === '2' || sp.step === '3' ? sp.step : '1';
  const force = sp.force === '1';

  // Auto-redirect existing users to their first workspace, unless forced.
  if (step === '1' && !force) {
    const mine = await listMyWorkspaces();
    if (mine.length > 0 && mine[0]?.slug) {
      redirect(`/w/${mine[0].slug}`);
    }
  }

  if (step === '2') return <StepTwo workspaceId={sp.ws ?? ''} />;
  if (step === '3') return <StepThree workspaceId={sp.ws ?? ''} slug={sp.slug ?? ''} />;
  return <StepOne />;
}

/* ---------- Step 1: pick template ---------- */
async function StepOne() {
  const templates = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.isPublished, true))
    .orderBy(frameworkTemplates.createdAt);

  return (
    <WizardShell
      step={1}
      title={
        <>
          Welcome to{' '}
          <span className="accent-gradient-text">Competency Framework</span>
        </>
      }
      subtitle="Pick a framework to fork into your first workspace — or start with a blank tree."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((tpl) => (
          <form key={tpl.id} action={forkTemplateForOnboarding}>
            <input type="hidden" name="templateId" value={tpl.id} />
            <article className="surface surface-lift p-5 h-full flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                  {tpl.domain === 'engineering' ? '☁️' : '✨'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base text-foreground truncate">
                      {tpl.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      v{tpl.version}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {tpl.description}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Forked {tpl.forksCount ?? 0} times
                </span>
                <Button type="submit" size="sm">
                  Use this <ArrowRight className="size-4" />
                </Button>
              </div>
            </article>
          </form>
        ))}

        {/* Blank-tree card */}
        <form action={createBlankWorkspace}>
          <article className="surface surface-lift p-5 h-full flex flex-col gap-3 border-dashed">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <Plus className="size-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-foreground">Tạo cây trống</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  Build your own competency tree from scratch — no framework attached.
                </p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-end gap-3 pt-2">
              <Button type="submit" size="sm" variant="outline">
                Start blank <ArrowRight className="size-4" />
              </Button>
            </div>
          </article>
        </form>
      </div>

      {templates.length === 0 && (
        <div className="surface p-6 mt-6 text-center text-sm text-muted-foreground">
          No framework templates yet. Run{' '}
          <code className="font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded">
            pnpm db:seed
          </code>{' '}
          to seed the DevOps framework, or start with a blank tree above.
        </div>
      )}
    </WizardShell>
  );
}

/* ---------- Step 2: name workspace ---------- */
async function StepTwo({ workspaceId }: { workspaceId: string }) {
  if (!workspaceId) redirect('/onboarding?step=1');

  const user = await requireUser();
  const rows = await db
    .select()
    .from(workspacesT)
    .where(eq(workspacesT.id, workspaceId))
    .limit(1);
  const ws = rows[0];
  if (!ws || ws.ownerUserId !== user.id) redirect('/onboarding?step=1');

  const defaultName = ws.name;
  const previewSlug = toSlug(defaultName);

  return (
    <WizardShell
      step={2}
      title="Đặt tên workspace"
      subtitle="Bạn có thể đổi tên sau ở Admin → Settings."
    >
      <form
        action={renameOnboardingWorkspace}
        className="surface p-6 space-y-5 max-w-xl mx-auto"
      >
        <input type="hidden" name="workspaceId" value={ws.id} />

        <div className="space-y-2">
          <label htmlFor="ws-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tên workspace
          </label>
          <Input
            id="ws-name"
            name="name"
            required
            maxLength={80}
            defaultValue={defaultName}
            autoFocus
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Slug preview: <code className="font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded">/w/{previewSlug || ws.slug}</code>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button asChild variant="ghost" size="sm" type="button">
            <Link href="/onboarding?step=1&force=1">
              <ArrowLeft className="size-4" /> Quay lại
            </Link>
          </Button>
          <Button type="submit">
            Tiếp tục <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>
    </WizardShell>
  );
}

/* ---------- Step 3: success ---------- */
async function StepThree({
  workspaceId,
  slug,
}: {
  workspaceId: string;
  slug: string;
}) {
  if (!workspaceId) redirect('/onboarding?step=1');

  const user = await requireUser();
  const rows = await db
    .select()
    .from(workspacesT)
    .where(eq(workspacesT.id, workspaceId))
    .limit(1);
  const ws = rows[0];
  if (!ws || ws.ownerUserId !== user.id) redirect('/onboarding?step=1');

  const resolvedSlug = slug || ws.slug;

  return (
    <WizardShell
      step={3}
      title={
        <>
          <span className="accent-gradient-text">Sẵn sàng!</span> Workspace của bạn đã tạo xong.
        </>
      }
      subtitle="Vài mẹo nhanh trước khi bắt đầu."
    >
      <div className="relative max-w-xl mx-auto">
        {/* Confetti dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="confetti-dot"
              style={{
                left: `${(i * 7) % 100}%`,
                animationDelay: `${(i % 7) * 120}ms`,
                background: i % 2 === 0 ? 'hsl(var(--primary))' : '#a855f7',
              }}
            />
          ))}
        </div>

        <div className="surface p-8 text-center space-y-5 relative">
          <div className="mx-auto size-14 rounded-full accent-gradient flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <CheckCircle2 className="size-7 text-white" aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">{ws.name}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">/w/{resolvedSlug}</p>
          </div>

          <ul className="text-left space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 mt-0.5 text-cyan-500 shrink-0" />
              <span>Click cây để drill xuống từng node học tập.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 mt-0.5 text-cyan-500 shrink-0" />
              <span>Đánh dấu xong để track XP, hearts và streak.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 mt-0.5 text-cyan-500 shrink-0" />
              <span>Mời thành viên ở Admin → Members khi sẵn sàng cộng tác.</span>
            </li>
          </ul>

          <Button asChild size="lg" className="w-full">
            <Link href={`/w/${resolvedSlug}`}>
              Bắt đầu học <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <style>{`
          .confetti-dot {
            position: absolute;
            top: -8px;
            width: 8px;
            height: 8px;
            border-radius: 9999px;
            opacity: 0;
            animation: confetti-fall 2200ms ease-in-out forwards;
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(280px) rotate(360deg); opacity: 0; }
          }
        `}</style>
      </div>
    </WizardShell>
  );
}

/* ---------- Wizard shell (header + step indicator) ---------- */
function WizardShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main
      className="min-h-dvh flex items-start md:items-center justify-center p-6 bg-background"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <div className="w-full max-w-3xl py-8">
        <div className="text-center mb-8">
          <div className="mx-auto size-12 rounded-2xl accent-gradient flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/20">
            <Sparkles className="size-6 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}

          {/* Step dots */}
          <ol className="mt-5 flex items-center justify-center gap-2" aria-label="Onboarding progress">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                aria-current={n === step ? 'step' : undefined}
                className={
                  n === step
                    ? 'h-2 w-6 rounded-full accent-gradient'
                    : n < step
                      ? 'h-2 w-2 rounded-full bg-foreground/40'
                      : 'h-2 w-2 rounded-full bg-foreground/15'
                }
              />
            ))}
          </ol>
        </div>

        {children}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Bạn có thể tạo thêm workspace bất cứ lúc nào từ sidebar.
        </p>
      </div>
    </main>
  );
}
