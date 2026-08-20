/**
 * Landing page — the public pitch for the platform.
 *
 * Composition only: every band lives in `src/components/landing/*` and every
 * number/card comes from Postgres (see `landing-data.ts`). There is no demo
 * constant anywhere on this page — if the DB has nothing published, the
 * sections render their own empty states.
 *
 * Narrative order:
 *   hero → 01 cách hoạt động → 02 tính năng → 03 ba vai trò
 *        → 04 động lực (XP/streak/badge/crown + huy hiệu thật)
 *        → 05 roadmap công khai → CTA → footer
 *
 * The three DB-backed blocks (stats strip, badge wall, showcase grid) are
 * wrapped in <Suspense> so the hero paints without waiting on Postgres and
 * each block shows a shape-matched skeleton while it streams.
 */
import { Suspense } from 'react';
import { Hero } from '@/components/landing/hero';
import { HowItWorksSection } from '@/components/landing/how-it-works';
import { FeaturesSection } from '@/components/landing/features-section';
import { RolesSection } from '@/components/landing/roles-section';
import { MotivationSection } from '@/components/landing/motivation-section';
import { ShowcaseSection } from '@/components/landing/showcase-section';
import { ShowcaseSkeleton } from '@/components/landing/skeletons';
import { FinalCta, SiteFooter } from '@/components/landing/final-cta';
import { LandingSection } from '@/components/landing/kit';
import { getFeaturedRoadmap } from '@/components/landing/landing-data';

// Counters and the showcase reflect live DB state — never cache the shell.
export const dynamic = 'force-dynamic';

export default async function Landing() {
  // Single tiny query: which real roadmap the "see an example" CTAs point at.
  const featured = await getFeaturedRoadmap();

  return (
    <main className="min-h-dvh" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
      <Hero featured={featured} />

      <HowItWorksSection />
      <FeaturesSection />
      <RolesSection />
      <MotivationSection />

      <LandingSection
        index={5}
        title="Roadmap công khai"
        subtitle="Xem không cần đăng nhập"
        lead="Những lộ trình đang mở công khai ngay lúc này. Bấm vào để đọc toàn bộ cây — không cần tài khoản."
        // the CTA band right below already draws the divider
        className="border-b-0"
      >
        <Suspense fallback={<ShowcaseSkeleton />}>
          <ShowcaseSection />
        </Suspense>
      </LandingSection>

      <FinalCta featured={featured} />
      <SiteFooter />
    </main>
  );
}
