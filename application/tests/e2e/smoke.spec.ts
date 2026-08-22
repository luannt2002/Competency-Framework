import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — các route công khai phải render đúng, ở CẢ desktop lẫn mobile.
 *
 * Bản trước kỳ vọng chữ tiếng Anh ("competency framework" / "get started")
 * trong khi trang thật đã là tiếng Việt từ lâu → test này đỏ sẵn nhiều đợt mà
 * không ai vá, nên nó không còn gác được gì. Giờ assert đúng chữ đang hiển thị.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Smoke', () => {
  test('landing hiện hero + CTA', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /lộ trình học tập/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /tạo lộ trình của bạn/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /khám phá cộng đồng/i })).toBeVisible();
  });

  test('sign-in hiện form email', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
  });

  test('/discover render không 500', async ({ page }) => {
    const res = await page.goto(`${BASE}/discover`);
    expect(res?.status()).toBeLessThan(400);
  });
});

/**
 * Không route công khai nào được tràn ngang.
 *
 * Đây là loại lỗi chỉ hiện ở bề rộng nhỏ nên không ai thấy khi phát triển trên
 * màn to: một hàng flex thiếu `flex-wrap` đủ đẩy `document.scrollWidth` vượt
 * viewport, và cả trang trôi ngang trên điện thoại. Đo bằng số thay vì nhìn.
 *
 * Ngưỡng +1px: trình duyệt làm tròn subpixel khi zoom/scale.
 */
const PUBLIC_ROUTES = ['/', '/sign-in', '/discover'];

for (const route of PUBLIC_ROUTES) {
  test(`không tràn ngang: ${route}`, async ({ page }, testInfo) => {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${route} tràn ngang ở ${testInfo.project.name}: scrollWidth=${scrollWidth} > viewport=${clientWidth}`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  });
}

/**
 * Mỗi trang đúng MỘT `<h1>`.
 *
 * Cùng họ với phép đo tràn ngang ở trên: lỗi chỉ tồn tại ở một bề rộng. Thanh
 * trên cùng của mobile từng đặt tên workspace trong `<h1 class="md:hidden">`,
 * nên dưới breakpoint md trang có hai `<h1>` — trình đọc màn hình nghe tên
 * workspace ngang hàng với tên bài học, và nghe trước vì nó đứng trên trong
 * DOM. Desktop không lộ vì `md:hidden` giấu đi.
 *
 * Chạy trên cả hai project nên phép đo này bắt được đúng loại lỗi đó.
 */
for (const route of PUBLIC_ROUTES) {
  test(`đúng một h1: ${route}`, async ({ page }, testInfo) => {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle');
    const texts = await page.locator('h1').allTextContents();
    expect(
      texts.length,
      `${route} có ${texts.length} thẻ h1 ở ${testInfo.project.name}: ${JSON.stringify(texts)}`,
    ).toBe(1);
  });
}
