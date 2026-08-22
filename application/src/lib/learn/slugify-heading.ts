/**
 * Sinh `id` cho tiêu đề trong nội dung markdown — MỘT bản duy nhất.
 *
 * Hàm này đứng ở hai đầu của cùng một sợi dây:
 *   - `MarkdownRenderer` dùng nó đặt `id` lên thẻ tiêu đề khi render nội dung.
 *   - `parseHeadings()` dùng nó sinh `href` cho mục lục trỏ tới các `id` đó.
 *
 * Hai bên PHẢI cho ra chuỗi giống hệt nhau. Lệch một ký tự thì bấm mục lục
 * không nhảy đi đâu cả, và không có lỗi nào hiện ra — trang vẫn 200, neo vẫn
 * tồn tại, chỉ là không khớp.
 *
 * Trước đợt này mỗi bên tự giữ một bản chép, kèm chú thích "Mirror of
 * `slugifyHeading` in node-toc.tsx — keep them identical". Chú thích ấy trỏ
 * sai file (hàm đã chuyển sang `parse-headings.ts` từ lâu), và một lời dặn
 * "keep them identical" thì không ai thi hành được ngoài trí nhớ.
 *
 * KHÔNG gộp với hai hàm slugify khác trong repo — chúng khác mục đích:
 *   - `actions/exports.ts:slugify`      → tên file tải về, không chuẩn hoá NFD
 *   - `lib/badges/rule-form.ts:slugifyBadgeName` → xử lý `đ`, cắt 60 ký tự
 * Gộp cả bốn lại là ép ba nhu cầu khác nhau vào một khuôn.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Tách dấu tiếng Việt thành ký tự tổ hợp rồi bỏ đi: "Kiến trúc" → "kien-truc".
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
