/**
 * Landing page — tree-first roadmap pitch.
 *
 * Three-card feature deck + live grid of public-readonly workspaces
 * pulled from the DB (falls back to a hardcoded `devops-test` entry
 * when nothing is published yet, so the landing is never empty).
 */
import Link from 'next/link';
import { eq, count } from 'drizzle-orm';
import { ArrowRight, Network, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';

type ShowcaseEntry = {
  slug: string;
  name: string;
  icon: string | null;
  nodeCount: number;
};

const FALLBACK_SHOWCASE: ShowcaseEntry = {
  slug: 'devops-test',
  name: 'DevOps Mastery 2026',
  icon: '☁️',
  nodeCount: 286,
};

export default async function Landing() {
  // Public-readonly workspaces, with a node count each.
  const publicWs = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      icon: workspaces.icon,
    })
    .from(workspaces)
    .where(eq(workspaces.visibility, 'public-readonly'));

  const showcase: ShowcaseEntry[] = await Promise.all(
    publicWs.map(async (w) => {
      const r = await db
        .select({ n: count() })
        .from(roadmapTreeNodes)
        .where(eq(roadmapTreeNodes.workspaceId, w.id));
      return {
        slug: w.slug,
        name: w.name,
        icon: w.icon,
        nodeCount: r[0]?.n ?? 0,
      };
    }),
  );

  const showcaseList = showcase.length > 0 ? showcase : [FALLBACK_SHOWCASE];

  return (
    <main
      className="min-h-dvh"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(204,120,92,0.10),_transparent_60%)]" />
        <div className="mx-auto max-w-5xl px-6 py-24 md:py-32 text-center">
          <Badge variant="outline" className="mx-auto mb-6 gap-1.5">
            <Sparkles className="size-3 text-primary" />
            Tree-first · Showcase công khai · Phân quyền RBAC
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="accent-gradient-text">Lộ trình học tập</span>
            <br />
            trực quan như sơ đồ.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
            Một cây kiến thức đa cấp cho team đào tạo, onboarding và tự học —
            chia sẻ link công khai như roadmap.sh, theo dõi tiến độ như Duolingo,
            phân quyền 7-tier như Linear.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/discover">
                Khám phá roadmap <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/share/${showcaseList[0]!.slug}`}>Xem demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">Đăng nhập</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 3 feature cards with lift effect */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 grid md:grid-cols-3 gap-6">
          <FeatureCard
            emoji="🌳"
            icon={Network}
            title="Cây học tập đa cấp"
            desc="CRUD cây n-depth: giai đoạn → tuần → buổi → lesson / lab / project. Drag-drop sắp lại, materialized path để query nhanh, mỗi node có description + body Markdown."
          />
          <FeatureCard
            emoji="👀"
            icon={Eye}
            title="Showcase công khai"
            desc="Bật visibility = public-readonly là có ngay link /share/<slug> chia sẻ Slack / Zalo / Twitter. OG image động render mỗi roadmap một preview riêng."
          />
          <FeatureCard
            emoji="🔐"
            icon={ShieldCheck}
            title="Phân quyền 7-tier"
            desc="Super-admin → Org-owner → Org-admin → WS-owner → Editor → Learner → Guest. Mỗi role nhìn thấy + sửa được những gì, kiểm tra ở cả server action và DB guard."
          />
        </div>
      </section>

      {/* Public showcase grid */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">Roadmap công khai</h2>
            <p className="text-muted-foreground mt-1">
              {showcaseList.length} roadmap đang mở · click để xem preview chỉ-đọc
            </p>
          </div>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Tạo roadmap của bạn →
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseList.map((w) => (
            <Link
              key={w.slug}
              href={`/share/${w.slug}`}
              className="surface surface-lift p-5 block group"
            >
              <div className="text-3xl mb-3">{w.icon ?? '📚'}</div>
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {w.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {w.nodeCount} mục · public-readonly
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                /share/{w.slug} →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-muted-foreground flex flex-col md:flex-row gap-2 justify-between">
          <p>© {new Date().getFullYear()} Competency Framework — open source, MIT.</p>
          <p>
            Inspired by{' '}
            <a className="underline" href="https://roadmap.sh">roadmap.sh</a>,{' '}
            <a className="underline" href="https://duolingo.com">Duolingo</a>,{' '}
            <a className="underline" href="https://linear.app">Linear</a>.
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  emoji,
  icon: Icon,
  title,
  desc,
}: {
  emoji: string;
  icon: typeof Network;
  title: string;
  desc: string;
}) {
  return (
    <div className="surface surface-lift p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl leading-none">{emoji}</div>
        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="size-4 text-primary" />
        </div>
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
