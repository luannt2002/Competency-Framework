/**
 * Flexible Courses page — n-depth roadmap tree per workspace.
 * Unlike rigid /learn (Duolingo path) and /roadmap-tree (5-tier fixed),
 * this view lets users build ANY hierarchy: Course → Phase → Stage →
 * Week → Session → Lesson / Theory / Lab / Project / Task / ...
 *
 * No unlock gating — every node visible at all times, click to expand.
 * Order index editable per row (move up/down).
 */
import { GraduationCap } from 'lucide-react';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { listTreeForWorkspace } from '@/actions/tree-nodes';
import { FlexibleTree } from '@/components/learn/flexible-tree';

export default async function CoursesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireWorkspaceAccess(slug);
  const roots = await listTreeForWorkspace(slug);

  // Aggregate totals (flatten tree)
  const flatten = (nodes: typeof roots): typeof roots => {
    const out: typeof roots = [];
    const walk = (ns: typeof roots) => {
      for (const n of ns) {
        out.push(n);
        if (n.children.length > 0) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  };
  const all = flatten(roots);
  const totalDone = all.filter((n) => n.progress?.status === 'done').length;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <GraduationCap className="size-7 text-violet-400" />
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Khoá học của tôi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cây học tập linh hoạt — bạn tạo bao nhiêu cấp cũng được. Click 1 node để xổ con của nó.
          </p>
        </div>
      </header>

      {all.length > 0 && (
        <div className="surface p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <Stat label="Cây gốc" value={roots.length} />
          <Stat label="Tổng node" value={all.length} />
          <Stat label="Đã xong" value={totalDone} />
          <Stat label="% hoàn thành" value={all.length === 0 ? 0 : Math.round((totalDone / all.length) * 100)} suffix="%" />
        </div>
      )}

      {/* Inline guide for first-time users */}
      <details className="surface p-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          💡 Cách sử dụng (click để xem)
        </summary>
        <div className="mt-2 space-y-1 text-muted-foreground leading-relaxed">
          <p>• <b>Click vào node</b> hoặc icon ▶ để xổ ra danh sách con (không chuyển trang).</p>
          <p>• <b>Hover qua node</b> → hiện 5 nút: ↑ lên, ↓ xuống, ＋ thêm con, ✨ sửa, 🗑 xoá.</p>
          <p>• <b>Click ⭕ tròn</b> đầu mỗi node để đánh dấu xong (toggle).</p>
          <p>• Mỗi node có <b>#thứ tự</b> hiển thị bên trái — sửa thứ tự bằng nút ↑↓.</p>
          <p>• <b>Loại node</b> tuỳ ý: Khoá → Giai đoạn → Tuần → Buổi → Bài / Lab / Project / Task / Milestone / Capstone / Tuỳ chỉnh.</p>
          <p>• Không có khoá unlock — mọi node luôn truy cập được, bạn tự quản tiến độ.</p>
        </div>
      </details>

      <FlexibleTree workspaceSlug={slug} roots={roots} />
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums accent-gradient-text">
        {value}
        {suffix && <span className="text-sm">{suffix}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
