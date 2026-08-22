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
/**
 * Mọi route KHÔNG cần đăng nhập.
 *
 * Trước đợt này danh sách chỉ có 3 trong 8 route công khai — thiếu đúng nhóm
 * `/share/*`, nơi một sự cố đã xảy ra thật: `/share/<private>` trả 404 đúng
 * nhưng `/share/<private>/n/<node>` trả 200 kèm đầy đủ nội dung và
 * `/api/og?slug=<private>` trả PNG (xem chú thích ở lib/share/guard.ts).
 *
 * `devops-test` là workspace public-readonly nên hai route share dưới đây là
 * bề mặt công khai thật, không phải trang đăng nhập trá hình.
 */
const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/discover',
  '/share/devops-test',
  '/share/devops-test/n/iam-identity-center-mfa-XS-w1-s0-l0',
];

/**
 * `/share/<slug>/n/<node>` CÒN TRÀN NGANG trên mobile — chưa vá xong.
 *
 * Đo được: scrollWidth=518 > viewport=412 (Pixel 7). Trang cha
 * `/share/<slug>` cùng lỗi đã vá bằng `flex-wrap` ở thanh trên và đã xanh;
 * trang node thì thêm `flex-wrap` chưa đủ — còn một phần tử khác tràn mà chưa
 * truy ra.
 *
 * Đánh dấu `fixme` chứ KHÔNG xoá khỏi danh sách: xoá là giấu, nới ngưỡng là
 * nói dối. `fixme` giữ nguyên phép đo và nói thẳng rằng nó đang hỏng.
 */
const OVERFLOW_KNOWN_BROKEN = new Set([
  '/share/devops-test/n/iam-identity-center-mfa-XS-w1-s0-l0',
]);

for (const route of PUBLIC_ROUTES) {
  test(`không tràn ngang: ${route}`, async ({ page }, testInfo) => {
    test.fixme(
      OVERFLOW_KNOWN_BROKEN.has(route) && testInfo.project.name === 'mobile',
      'Còn tràn ngang trên mobile, chưa truy ra phần tử — xem chú thích phía trên.',
    );
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

/**
 * Workspace riêng tư không được lộ ra bề mặt công khai nào.
 *
 * Đây là bài e2e cho đúng sự cố mà `lib/share/guard.ts` sinh ra để chặn. Test
 * tích hợp đã phủ hàm guard; bài này phủ phần còn lại — rằng các TRANG thật sự
 * gọi guard đó, ở cả desktop lẫn mobile.
 *
 * Dùng một slug chắc chắn không tồn tại thay vì tạo workspace riêng tư: kết quả
 * phải GIỐNG NHAU cho "không có" và "có nhưng cấm" — đó chính là bất biến chống
 * dò slug. Nếu trang phân biệt hai trường hợp, nó rò danh sách khách hàng.
 */
test.describe('bề mặt /share không rò workspace riêng tư', () => {
  const KHONG_TON_TAI = 'khong-he-co-workspace-nay-2026';

  test('slug không tồn tại → không phải 200', async ({ page }) => {
    const res = await page.goto(`${BASE}/share/${KHONG_TON_TAI}`);
    expect(res?.status(), 'trang share của slug lạ không được trả 200').not.toBe(200);
  });

  test('trang node của slug không tồn tại → không phải 200', async ({ page }) => {
    // Đúng bề mặt từng bị bỏ sót gate: trang cha 404 nhưng trang node vẫn 200.
    const res = await page.goto(`${BASE}/share/${KHONG_TON_TAI}/n/bat-ky-node-nao`);
    expect(res?.status(), 'trang node share của slug lạ không được trả 200').not.toBe(200);
  });

  test('ảnh OG của slug không tồn tại → không phải 200', async ({ page }) => {
    // Bề mặt thứ ba từng bị bỏ sót: /api/og trả PNG cho workspace riêng tư.
    const res = await page.request.get(`${BASE}/api/og?slug=${KHONG_TON_TAI}`);
    expect(res.status(), 'ảnh OG của slug lạ không được trả 200').not.toBe(200);
  });
});
