/**
 * Closing CTA band + site footer.
 *
 * These two live together because they form the visual "floor" of the page —
 * the tinted band mirrors the hero so the layout reads as a closed composition
 * instead of trailing off into whitespace.
 */
import Link from 'next/link';
import { ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeInSection } from '@/components/ui/fade-in-section';
import { BAND_Y, SHELL } from './kit';
import type { FeaturedRoadmap } from './landing-data';

export function FinalCta({ featured }: { featured: FeaturedRoadmap | null }) {
  return (
    <FadeInSection className="border-t border-border bg-brand-subtle">
      <div className={`${SHELL} ${BAND_Y} text-center`}>
        <h2 className="mx-auto max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Xây lộ trình cho team bạn{' '}
          <span className="accent-gradient-text">trong 2 phút</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Fork một framework có sẵn, tuỳ biến icon — màu — cấp độ theo culture team, rồi chia
          sẻ link công khai ngay lập tức. Miễn phí và mã nguồn mở.
        </p>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild size="lg" className="btn-brand border-0">
            <Link href="/sign-in">
              Tạo workspace miễn phí
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="btn-brand-outline border-2">
            <Link href={featured ? `/share/${featured.slug}` : '/discover'}>
              <Eye className="size-4" aria-hidden="true" />
              {featured ? 'Xem roadmap mẫu' : 'Khám phá roadmap'}
            </Link>
          </Button>
        </div>
      </div>
    </FadeInSection>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div
        className={`${SHELL} flex flex-col gap-6 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">Competency Framework</p>
          <p>© {new Date().getFullYear()} — mã nguồn mở, giấy phép MIT.</p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <nav
            aria-label="Liên kết chân trang"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            <Link href="/discover" className="transition-colors hover:text-foreground">
              Khám phá
            </Link>
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Đăng nhập
            </Link>
          </nav>
          <p>
            Lấy cảm hứng từ{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://roadmap.sh">
              roadmap.sh
            </a>
            ,{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://duolingo.com">
              Duolingo
            </a>{' '}
            và{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://linear.app">
              Linear
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
