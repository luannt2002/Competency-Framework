import { test, expect } from '@playwright/test';

/**
 * The closed loop for a manually-graded exercise, end to end, against the real
 * app and the real database.
 *
 * nộp → pending_review → hàng đợi /grading → chấm → learner thấy điểm
 *
 * Unit tests can prove the folding rules; only this can prove the wiring —
 * that the node page opens the runner, that submitting an essay produces a
 * `pending_review` row instead of a verdict, that the grading queue picks it
 * up, and that the grade travels back to the learner's screen.
 *
 * Requires the dev server with DEV_AUTH_BYPASS (the bypass user owns
 * `devops-test` and is super_admin, so it can both learn and grade).
 *
 * Not part of `pnpm test` — run with `pnpm test:e2e`. It writes attempts, so
 * it is a dev-database test by design: each run submits, grades, and leaves the
 * manual exercises settled BELOW their pass bar, which is what makes the next
 * run able to retry them. A run aborted between submit and grade leaves an
 * attempt in `pending_review`, and the following run will fail loudly on the
 * locked card rather than pretend it passed.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const WS = 'devops-test';
const NODE = 'iam-identity-center-mfa-XS-w1-s0-l0';

/** Unique per run so the graded attempt can be identified in the queue. */
const STAMP = `e2e-${Date.now()}`;

/**
 * The verdict strip, scoped to the exercise card.
 *
 * `role="status"` is also used by the Next dev overlay's "Static route" toast,
 * so an unscoped lookup is ambiguous in development.
 */
const verdictOf = (page: import('@playwright/test').Page) =>
  page.locator('article').getByRole('status');

/**
 * Wait for a graded card to leave the queue.
 *
 * The card sets a local "đã chấm" state AND calls router.refresh(); whichever
 * lands first wins, and the refreshed list no longer contains the attempt at
 * all. Asserting on one of the two races the other, so accept either.
 */
async function expectGraded(page: import('@playwright/test').Page, stamp: string) {
  await expect(async () => {
    const stillQueued = await page.locator('article').filter({ hasText: stamp }).count();
    const doneBanner = await page.getByText(/Đã chấm xong bài này/).count();
    expect(stillQueued === 0 || doneBanner > 0).toBe(true);
  }).toPass({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test('node page offers practice and the runner grades an auto kind instantly', async ({
  page,
}) => {
  await page.goto(`${BASE}/w/${WS}/n/${NODE}`);

  const practice = page.getByRole('region', { name: /Bài tập/ });
  await expect(practice).toBeVisible();
  await practice.getByRole('link', { name: /Bắt đầu làm bài|Làm tiếp|Xem lại bài/ }).click();

  await expect(page).toHaveURL(new RegExp(`/n/${NODE}/practice$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Câu 1 is an mcq. The radio itself is `sr-only` (the styled label is the
  // hit target, as a sighted user experiences it), so click the label — that
  // is the real interaction, and it keeps keyboard/SR support intact.
  const submit = page.getByRole('button', { name: 'Kiểm tra' });
  if (await submit.count()) {
    await page.locator('fieldset label').first().click();
    await expect(page.getByRole('radio').first()).toBeChecked();
    await submit.click();
  }

  const verdict = verdictOf(page);
  await expect(verdict).toBeVisible({ timeout: 15_000 });
  await expect(verdict).toContainText(/Chính xác|Chưa đúng/);
  // An auto-graded kind must never park the learner in "waiting".
  await expect(verdict).not.toContainText('Đang chờ chấm');
});

test('an essay shows "đang chờ chấm", never a verdict', async ({ page }) => {
  await page.goto(`${BASE}/w/${WS}/n/${NODE}/practice`);

  // Jump to the essay via the step rail (câu 4 in display order).
  await page.getByRole('button', { name: 'Câu 4' }).click();
  await expect(page.getByText('Tự luận')).toBeVisible();

  // Re-runnable: a previous run leaves this exercise settled at 80% (partial),
  // which locks the card until the learner asks to try again.
  const retry = page.getByRole('button', { name: 'Làm lại' });
  if (await retry.count()) await retry.click();

  // The promise is made BEFORE writing, not discovered afterwards.
  await expect(page.getByText(/do người chấm đọc và cho điểm/)).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Câu trả lời' })
    .fill(
      `${STAMP} — Access key dài hạn không tự hết hạn nên một lần rò rỉ là rò rỉ vĩnh viễn. ` +
        'IAM Identity Center phát hành credential tạm thời qua STS nên blast radius bị giới hạn theo phiên. ' +
        'Toàn bộ đăng nhập đi qua một điểm nên audit tập trung được ở CloudTrail thay vì rải rác theo từng account.',
    );
  await page.getByRole('button', { name: 'Nộp bài' }).click();

  const verdict = verdictOf(page);
  await expect(verdict).toBeVisible({ timeout: 15_000 });
  await expect(verdict).toContainText('Đang chờ chấm');
  await expect(verdict).not.toContainText(/Chính xác|Chưa đúng|Đúng một phần/);
  // The explanation is withheld while unsettled — it restates the answer.
  await expect(verdict).not.toContainText('Giải thích');
  await expect(verdict).not.toContainText('%');
});

test('the pending essay reaches the grading queue and the grade travels back', async ({
  page,
}) => {
  await page.goto(`${BASE}/w/${WS}/grading`);
  await expect(page.getByRole('heading', { name: 'Chấm bài' })).toBeVisible();

  const card = page.locator('article').filter({ hasText: STAMP });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // 80% is deliberate: below the essay engine's pass bar, so the attempt
  // settles `partial` and the exercise stays retryable on the next run.
  await card.getByLabel(/^Điểm/).fill('80');
  await card.getByLabel(/Nhận xét/).fill(`Đủ 3 luận điểm, thiếu ví dụ cụ thể. (${STAMP})`);
  await card.getByRole('button', { name: 'Chấm điểm' }).click();
  await expectGraded(page, STAMP);

  // Back on the learner's screen: no longer waiting, and the grader's note is
  // visible along with the score.
  await page.goto(`${BASE}/w/${WS}/n/${NODE}/practice`);
  await page.getByRole('button', { name: 'Câu 4' }).click();

  const verdict = verdictOf(page);
  await expect(verdict).toBeVisible({ timeout: 15_000 });
  await expect(verdict).not.toContainText('Đang chờ chấm');
  await expect(verdict).toContainText('80%');
  await expect(verdict).toContainText('Nhận xét của người chấm');
  await expect(verdict).toContainText(STAMP);
});

test('a tenant-defined kind runs with no code: row in exercise_types, rubric engine', async ({
  page,
}) => {
  // `sre_postmortem` exists only as a row in `exercise_types` for this
  // workspace, built on the shared `rubric` engine. No file in src/ mentions
  // it. If this renders and submits, a workspace can add a dạng bài without
  // a deploy — which is the entire point of the open kind system.
  await page.goto(`${BASE}/w/${WS}/n/${NODE}/practice`);
  await page.getByRole('button', { name: 'Câu 6' }).click();

  // The tenant's own label, not a built-in one.
  await expect(page.getByText('Postmortem sự cố')).toBeVisible();
  // Criteria the tenant authored are visible; their marking guidance is not.
  await expect(page.getByText('Bạn sẽ được chấm theo')).toBeVisible();
  await expect(page.getByText('Nguyên nhân gốc, không đổ lỗi')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('BI MAT TIEU CHI');

  // A previous run leaves this settled at 63% (partial), which locks the card.
  const retry = page.getByRole('button', { name: 'Làm lại' });
  if (await retry.count()) await retry.click();

  // The engine's hybrid mode reached the UI: promised to a human, not scored.
  // Only shown while the box is writable, so it is asserted after the unlock.
  await expect(page.getByText(/do người chấm đọc và cho điểm/)).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Câu trả lời' })
    .fill(`${STAMP} postmortem — timeline, impact, root cause, action items.`);
  await page.getByRole('button', { name: 'Nộp bài' }).click();
  await expect(verdictOf(page)).toContainText('Đang chờ chấm', { timeout: 15_000 });

  // It reaches the same queue as a built-in manual kind, labelled as the
  // tenant named it, with the tenant's criteria to score.
  await page.goto(`${BASE}/w/${WS}/grading`);
  const card = page.locator('article').filter({ hasText: `${STAMP} postmortem` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText('Postmortem sự cố')).toBeVisible();
  await expect(card.getByText('Dòng thời gian rõ ràng')).toBeVisible();

  // Score per criterion. Weights 2 / 3 / 1 -> (2*1 + 3*0.6 + 1*0) / 6 = 0.633,
  // under the tenant's 0.75 bar, so it settles `partial`. The weighted total is
  // recomputed by the rubric engine server-side; the form only previews it.
  await card.getByLabel('Dòng thời gian rõ ràng').fill('100');
  await card.getByLabel('Nguyên nhân gốc, không đổ lỗi').fill('60');
  await card.getByLabel('Hành động khắc phục đo được').fill('0');
  await card.getByRole('button', { name: 'Chấm điểm' }).click();
  await expectGraded(page, `${STAMP} postmortem`);

  await page.goto(`${BASE}/w/${WS}/n/${NODE}/practice`);
  await page.getByRole('button', { name: 'Câu 6' }).click();
  const graded = verdictOf(page);
  await expect(graded).toBeVisible({ timeout: 15_000 });
  await expect(graded).not.toContainText('Đang chờ chấm');
  await expect(graded).toContainText('63%');
});
