import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Ở máy cá nhân, test bắn vào `next dev` — nơi mỗi route compile lần đầu mất
  // 3-6 giây. Hâm nóng trước để không worker nào phải trả cái giá đó giữa lúc
  // đang đo. Xem tests/e2e/warmup.ts.
  globalSetup: './tests/e2e/warmup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile là nơi lỗi layout thật sự xuất hiện: sidebar ẩn dưới 768px, bảng
    // tràn ngang, hàng flex không wrap. Không có project này thì mọi khẳng định
    // "responsive" đều chưa từng được kiểm.
    //
    // `dependencies`: mobile chỉ chạy SAU KHI desktop xong hẳn.
    //
    // lesson-runner.spec.ts ghi vào DB thật — nộp bài, chấm, để lượt làm settled
    // dưới ngưỡng đạt cho lần chạy sau. Cả hai project dùng CHUNG một user
    // DEV_AUTH_BYPASS, chung một workspace, chung một hàng bài tập. Chạy song
    // song thì desktop nộp xong đẩy bài sang `awaiting`, mobile tới nơi thấy
    // thẻ đã khoá, không còn nút "Làm lại" để bấm, và đỏ ở một chỗ chẳng liên
    // quan gì tới giao diện mobile.
    //
    // Đo được: `--workers=1` (tuần tự hoàn toàn) → 26/26 xanh; để song song →
    // đúng một test mobile đỏ, lặp lại được. Không có lỗi sản phẩm nào ở đây.
    //
    // Hạ hẳn `workers` xuống 1 cũng chữa được, nhưng phạt cả những test không
    // đụng trạng thái. `dependencies` chỉ tuần tự hoá GIỮA hai project, bên
    // trong mỗi project vẫn chạy song song.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['desktop'] },
  ],
  webServer: process.env.CI
    ? {
        command: 'pnpm start',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
