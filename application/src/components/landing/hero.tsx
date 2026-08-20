/**
 * Landing hero — headline, three CTAs and the live stats strip.
 *
 * The "see a real one" CTA points at a workspace that actually exists; when
 * nothing is published yet it degrades to /discover instead of linking to an
 * invented slug.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FadeInSection } from '@/components/ui/fade-in-section';
import { BAND_Y, SHELL } from './kit';
import { StatsStrip } from './stats-strip';
import { StatsStripSkeleton } from './skeletons';
import type { FeaturedRoadmap } from './landing-data';

export function Hero({ featured }: { featured: FeaturedRoadmap | null }) {
  const demoHref = featured ? `/share/${featured.slug}` : '/discover';
  const demoLabel = featured ? 'Xem một roadmap thật' : 'Khám phá roadmap';

  return (
    <FadeInSection
      as="header"
      className="relative overflow-hidden border-b border-border bg-brand-subtle"
    >
      {/* Spotlight behind the headline — decorative, sits under content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,_var(--brand-blue)_12%,_transparent),_transparent_60%)]"
      />
      <div className={`${SHELL} ${BAND_Y} text-center`}>
        <Badge variant="outline" className="mx-auto mb-6 gap-1.5">
          <Sparkles className="size-3 text-primary" aria-hidden="true" />
          Tree-first · Showcase công khai · Phân quyền RBAC
        </Badge>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          <span className="accent-gradient-text">Lộ trình học tập</span>
          <br />
          trực quan như sơ đồ.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
          Một cây kiến thức đa cấp cho team đào tạo, onboarding và tự học — chia sẻ link công
          khai như roadmap.sh, theo dõi tiến độ như Duolingo, phân quyền 7-tier như Linear.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild size="lg" className="btn-brand border-0">
            <Link href="/sign-in">
              Tạo lộ trình của bạn
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="btn-brand-outline border-2">
            <Link href={demoHref}>
              <Eye className="size-4" aria-hidden="true" />
              {demoLabel}
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/discover">Khám phá cộng đồng</Link>
          </Button>
        </div>

        {/* Live counters — streamed so Postgres never blocks the headline. */}
        <div className="mt-10 sm:mt-14">
          <Suspense fallback={<StatsStripSkeleton />}>
            <StatsStrip />
          </Suspense>
        </div>
      </div>
    </FadeInSection>
  );
}
