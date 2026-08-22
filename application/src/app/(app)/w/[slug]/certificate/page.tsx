/**
 * `/w/[slug]/certificate` — đưa người đang đăng nhập tới chứng nhận của CHÍNH họ.
 *
 * Đặc tả Flow G nói route là `/w/[slug]/certificate`, nhưng bản dựng chỉ có
 * `/certificate/[memberId]` (thêm memberId để owner xem được của thành viên).
 * Hệ quả đo được: `curl /w/devops-test/certificate` → **404**. Trang này lấp
 * đúng khoảng trống đó, không nhân bản logic — chuyển thẳng sang biến thể có
 * memberId, nơi mọi kiểm tra quyền và điều kiện ≥80% đã nằm sẵn.
 */
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/supabase-server';

export default async function MyCertificateRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  redirect(`/w/${slug}/certificate/${user.id}`);
}
