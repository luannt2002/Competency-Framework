/**
 * Global 404 — paper-coral aesthetic.
 *
 * Centered hero card with a big gradient "404" in JetBrains Mono, an Outfit
 * subtitle in Vietnamese, three helpful navigation links and a Compass icon.
 * Replaces the previous SVG line-art version.
 */
import Link from 'next/link';
import { Compass, Home, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      className="min-h-dvh flex items-center justify-center px-6 py-12 bg-background text-foreground"
      style={{ fontFamily: 'var(--font-outfit), Outfit, sans-serif' }}
    >
      <div className="w-full max-w-xl surface p-8 md:p-12 text-center space-y-8">
        <div className="flex flex-col items-center gap-6">
          <Compass
            className="size-24 text-primary"
            strokeWidth={1.25}
            aria-hidden="true"
          />
          <div
            className="text-7xl md:text-8xl font-extrabold leading-none tabular-nums bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500"
            style={{ fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace' }}
          >
            404
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Lộ trình bạn tìm không tồn tại
            </h1>
            <p className="text-sm text-muted-foreground">
              Đường dẫn có thể đã thay đổi hoặc roadmap chưa được công khai.
              Thử một trong các trang dưới đây.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/">
              <Home className="size-4" />
              Trang chủ
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/discover">
              <Search className="size-4" />
              Khám phá
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/share/devops-test">
              <Eye className="size-4" />
              Xem demo
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
