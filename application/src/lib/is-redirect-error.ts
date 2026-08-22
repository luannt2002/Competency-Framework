/**
 * `redirect()` của Next báo hiệu bằng cách NÉM LỖI — không được nuốt nó.
 *
 * Mọi `try/catch` bọc quanh một server action có `redirect()` phải để lỗi này
 * đi tiếp, nếu không thao tác thành công sẽ hiện ra như một thất bại: người
 * dùng ở lại trang cũ kèm toast lỗi, trong khi dữ liệu đã ghi xong.
 *
 * Gom về đây vì phép kiểm này đã bị chép tay ở `delete-workspace-form.tsx` và
 * sắp cần thêm ở `fork-button.tsx` — chép lần thứ ba là lúc một trong ba bản sẽ
 * lệch đi mà không ai biết.
 *
 * Kiểm cả `digest` chứ không chỉ `message`: Next đặt `digest` dạng
 * `NEXT_REDIRECT;replace;/duong-dan;...`, và đó là dấu hiệu ổn định hơn.
 * `NEXT_NOT_FOUND` (từ `notFound()`) cũng cùng cơ chế nên gom luôn.
 */
export function isNextControlFlowError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === 'string') {
    if (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND') return true;
  }

  const message = (err as { message?: unknown }).message;
  return message === 'NEXT_REDIRECT' || message === 'NEXT_NOT_FOUND';
}
