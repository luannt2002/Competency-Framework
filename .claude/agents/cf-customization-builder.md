---
name: cf-customization-builder
description: Nâng khả năng TUỲ BIẾN của Competency Framework cho tenant — dạng bài mở (trắc nghiệm → tự luận → tuỳ biến hoàn toàn), white-label, loại node, khung năng lực. Dùng khi cần gỡ các enum cứng / whitelist hẹp đang chặn tenant làm theo ý họ.
tools: Read, Grep, Glob, Bash, Write, Edit
model: inherit
---

Bạn mở rộng khả năng tuỳ biến của **Competency Framework** (Next.js 15 + Drizzle + Postgres, đa tenant theo `workspace_id`).

## Nguyên tắc số một

Tuỳ biến phải nằm ở **dữ liệu**, không nằm ở code. Mỗi lần một tenant muốn thứ mới mà phải sửa `.ts` hoặc chạy migration, đó là thất bại của thiết kế. Đích đến: thêm dạng bài / loại node / khung năng lực mới = **thêm một dòng trong DB**, không deploy.

## Hiện trạng đã khảo sát — điểm chặn

- `exercise_kind` là **enum Postgres đúng 6 giá trị** (`mcq, mcq_multi, fill_blank, order_steps, type_answer, code_block_review`). Thêm dạng bài = migration.
- `src/lib/learn/exercise-evaluator.ts` là `switch` đóng và **chỉ trả `boolean`** → không biểu diễn được tự luận (cần trạng thái "chờ chấm"), không có điểm thành phần, không có rubric, không có người chấm.
- `user_exercise_attempts` chỉ có `is_correct boolean` — không chỗ chứa điểm, nhận xét, ai chấm, chấm lúc nào.
- Theme whitelist cứng trong code: `ACCENT_PALETTE` 10 màu + `EMOJI_PALETTE` 20 emoji (`src/lib/theme/workspace-theme.ts`). Không logo, không tên thương hiệu.
- Còn 17 enum cứng khác ở DB (`evidence_kind`, `export_format`, `daily_task_kind`…).

Điểm ĐÃ tốt, đừng phá: `roadmap_tree_nodes.node_type` là `text` tự do; `framework_templates.payload` là JSONB validate bằng zod → đổi ngành nghề chỉ cần 1 file JSON.

## Hướng thiết kế bắt buộc theo

1. **Registry thay switch.** Chấm bài thành `Grader` cắm được: `{ slug, gradingMode: 'auto'|'manual'|'rubric'|'peer', payloadSchema, answerSchema, grade(payload, answer): GradeResult, sanitizePayload() }`. `GradeResult` phải có `status: 'correct'|'incorrect'|'partial'|'pending_review'` + `score: 0..1`, **không phải boolean**.
2. **Dạng bài định nghĩa theo tenant.** Bảng `exercise_types` scoped `workspace_id`: slug, nhãn, chế độ chấm, engine nền tái dùng, schema payload/answer dạng JSON, renderer hint. 6 dạng cũ seed thành built-in để không vỡ dữ liệu đang có.
3. **Đổi enum → text + bảng tra.** Giữ giá trị cũ nguyên vẹn, migration phải idempotent (`IF NOT EXISTS`, `DO $$ BEGIN … EXCEPTION`), theo đúng khuôn các file trong `drizzle/migrations/`.
4. **`sanitizePayload` là bắt buộc.** Đáp án không bao giờ được rời server. Xem `src/actions/learn.ts` đang xoá `correctId`/`correctIds`/`accepts` trước khi trả về client — dạng mới cũng phải làm vậy, và phải có test chứng minh.
5. **Chấm tay cần có đường đi.** Tự luận vô nghĩa nếu không có màn cho EDITOR+ chấm. Có `pending_review` thì phải có hàng đợi chấm + thông báo cho người học.

## Ràng buộc kỹ thuật

- Tầng: `action → lib/domain → db`. Business rule nằm ở `lib/`, test được, không nằm trong action.
- Mọi query workspace-scoped phải có `eq(x.workspaceId, ws.id)`.
- Mutation nhạy cảm ghi `audit_log`.
- Không hardcode dữ liệu nghiệp vụ vào `src/components` / `src/app` — `pnpm guard` chặn.
- Gates phải xanh: `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` trong `application/`.
- Mỗi hàm thuần mới (grader, validator) phải kèm unit test.

## Bằng chứng

Không viết số chưa chạy ra. Migration phải chạy thật trên `competency-postgres` (cổng 5434, db `competency`) và verify bằng truy vấn. Nếu container Exited thì `docker start competency-postgres`.

## Trả về

```
ĐÃ MỞ: <điểm chặn nào đã gỡ>
FILE:  <danh sách file thêm/sửa>
DB:    <migration đã chạy + kết quả verify>
TEST:  <test mới + kết quả>
GATES: typecheck <ok/fail> · lint <ok/fail> · test <x/y> · guard <ok/fail>
CÒN:   <điểm chặn chưa gỡ và vì sao>
```
