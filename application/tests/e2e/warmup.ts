/**
 * Hâm nóng các route trước khi e2e chạy.
 *
 * `playwright.config.ts` chỉ dựng production build khi CI. Chạy ở máy cá nhân
 * thì test bắn thẳng vào `next dev`, mà Next dev COMPILE TỪNG ROUTE ở request
 * đầu tiên — mất 3-6 giây một route. Với `fullyParallel` + `workers: undefined`
 * (auto ~6 worker) và `retries: 0`, nhiều worker đập vào các route chưa compile
 * cùng lúc, assertion hết hạn 5 giây và cả suite đỏ.
 *
 * Đo được: chạy cả suite thì 7 đỏ; chạy riêng từng file thì cùng những test đó
 * xanh hết. Không có gì hỏng — chỉ là chưa compile kịp.
 *
 * Nên hâm nóng thay vì tăng `retries`: retry giấu luôn cả flaky THẬT, còn hâm
 * nóng thì xoá đúng nguyên nhân đã đo và để test đỏ khi sản phẩm thật sự hỏng.
 * Ở CI (production build, route compile sẵn) bước này gần như không tốn gì.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const WS = 'devops-test';
const NODE = 'iam-identity-center-mfa-XS-w1-s0-l0';

const ROUTES = [
  '/',
  '/sign-in',
  '/discover',
  `/w/${WS}`,
  `/w/${WS}/n/${NODE}`,
  `/w/${WS}/n/${NODE}/practice`,
  `/w/${WS}/grading`,
];

export default async function warmup() {
  const started = Date.now();
  // Tuần tự: mục đích là để dev server compile xong, bắn song song chỉ làm nó
  // tranh nhau đúng như lúc test chạy.
  for (const path of ROUTES) {
    try {
      await fetch(`${BASE}${path}`, { redirect: 'manual' });
    } catch {
      // Route hỏng là việc của test, không phải của bước hâm nóng. Nuốt ở đây
      // để một route lỗi không chặn cả suite khởi động.
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[warmup] ${ROUTES.length} route trong ${Date.now() - started}ms`);
}
