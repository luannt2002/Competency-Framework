import Link from 'next/link';
import { ArrowRight, Boxes, GraduationCap, Grid3x3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FRAMEWORKS = [
  { slug: 'devops', name: 'DevOps Mastery', status: 'active', skills: 40, weeks: 48, icon: '☁️' },
  { slug: 'frontend', name: 'Frontend Engineer', status: 'soon', skills: 0, weeks: 0, icon: '🎨' },
  { slug: 'backend', name: 'Backend Engineer', status: 'soon', skills: 0, weeks: 0, icon: '⚙️' },
  { slug: 'data-eng', name: 'Data Engineer', status: 'soon', skills: 0, weeks: 0, icon: '📊' },
  { slug: 'sre', name: 'Site Reliability', status: 'soon', skills: 0, weeks: 0, icon: '🛡️' },
];

export default function Landing() {
  return (
    <main className="min-h-dvh">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.10),_transparent_60%)]" />
        <div className="mx-auto max-w-5xl px-6 py-24 md:py-32 text-center">
          <Badge variant="outline" className="mx-auto mb-6 gap-1.5">
            <Sparkles className="size-3 text-cyan-400" />
            Mạnh hơn roadmap.sh × tự học như Duolingo
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Fork a <span className="accent-gradient-text">competency framework</span>.
            <br />
            Master the level.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
            Đo năng lực theo cấp độ XS / S / M / L, học theo lộ trình từng tuần với bài tập tương tác kiểu Duolingo,
            đạt streak — tất cả workspace-first, customize được như roadmap.sh.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/templates">Browse frameworks</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 grid md:grid-cols-3 gap-6">
          <ValueProp
            icon={Grid3x3}
            title="Measure"
            desc="Skills Matrix dày, filter cực mạnh. Đánh giá XS / S / M / L với evidence + note Markdown."
          />
          <ValueProp
            icon={GraduationCap}
            title="Learn"
            desc="Course Map kiểu Duolingo: path curved 12 tuần × 4 levels, lesson 5–10 phút, exercise interactive."
          />
          <ValueProp
            icon={Boxes}
            title="Master"
            desc="XP, streak, hearts, crowns, badges. Hoàn thành lesson → unlock cấp tiếp."
          />
        </div>
      </section>

      {/* Frameworks strip */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold mb-2">Available frameworks</h2>
        <p className="text-muted-foreground mb-8">DevOps đầu tiên — Frontend, Backend, Data Eng đang được build.</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORKS.map((fw) => (
            <article
              key={fw.slug}
              className="surface p-5 surface-hover relative overflow-hidden group"
            >
              {fw.status === 'soon' && (
                <Badge variant="outline" className="absolute right-3 top-3 text-[10px]">
                  Coming soon
                </Badge>
              )}
              <div className="text-3xl mb-3">{fw.icon}</div>
              <h3 className="font-semibold text-lg">{fw.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {fw.skills > 0 ? `${fw.skills} skills · ${fw.weeks} weeks` : 'Roadmap in design'}
              </p>
              {fw.status === 'active' && (
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link href="/sign-in">Fork & start</Link>
                </Button>
              )}
            </article>
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

function ValueProp({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Grid3x3;
  title: string;
  desc: string;
}) {
  return (
    <div className="surface p-6">
      <div className="size-10 rounded-xl accent-gradient flex items-center justify-center mb-4">
        <Icon className="size-5 text-white" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
