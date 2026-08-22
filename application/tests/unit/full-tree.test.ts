import { describe, it, expect } from 'vitest';
import { countTreeNodes, type ShareTreeNode } from '@/lib/tree/full-tree';
import { defaultCollapsed, EXPAND_ALL_LIMIT } from '@/components/share/share-tree';

/**
 * `getFullTree` chạm DB nên được phủ ở `tests/integration/`. Ở đây kiểm hai
 * hàm thuần đi kèm — trước đợt này `full-tree` **không có một test nào**, và
 * đó là lý do phép đếm sai (48 thay vì 159) sống sót.
 */
function n(
  id: string,
  depth: number,
  orderIndex: number,
  children: ShareTreeNode[] = [],
): ShareTreeNode {
  return {
    id,
    slug: id,
    title: id,
    nodeType: 'lesson',
    description: null,
    estMinutes: null,
    orderIndex,
    depth,
    descendantCount: children.reduce((a, c) => a + 1 + c.descendantCount, 0),
    children,
  };
}

describe('countTreeNodes', () => {
  it('rừng rỗng', () => {
    expect(countTreeNodes([])).toBe(0);
  });

  it('đếm cả gốc lẫn mọi hậu duệ', () => {
    const tree = [
      n('r1', 0, 0, [n('a', 1, 0, [n('a1', 2, 0), n('a2', 2, 1)]), n('b', 1, 1)]),
      n('r2', 0, 1),
    ];
    // r1 + a + a1 + a2 + b + r2 = 6
    expect(countTreeNodes(tree)).toBe(6);
  });

  it('cây lệch sâu vẫn đếm đủ', () => {
    let deep = n('d5', 5, 0);
    for (let d = 4; d >= 0; d--) deep = n(`d${d}`, d, 0, [deep]);
    expect(countTreeNodes([deep])).toBe(6);
  });
});

describe('defaultCollapsed', () => {
  const wide = (count: number): ShareTreeNode[] => {
    const kids = Array.from({ length: count - 2 }, (_, i) => n(`k${i}`, 2, i));
    return [n('root', 0, 0, [n('mid', 1, 0, kids)])];
  };

  it('cây nhỏ: bung hết', () => {
    expect(defaultCollapsed(wide(10)).size).toBe(0);
  });

  it('ngưỡng đủ rộng cho một lộ trình thật (166 mục) vẫn bung hết', () => {
    // Đây là ràng buộc của bước A3: người xem thấy TOÀN BỘ cấu trúc trên một
    // trang. Sửa phép đếm mà quên ngưỡng thì cây tự thu gọn và A3 mất.
    expect(EXPAND_ALL_LIMIT).toBeGreaterThan(166);
    expect(defaultCollapsed(wide(166)).size).toBe(0);
  });

  it('cây rất lớn: thu gọn từ cấp 3 trở xuống, hai cấp đầu vẫn mở', () => {
    const huge = wide(EXPAND_ALL_LIMIT + 50);
    const collapsed = defaultCollapsed(huge);
    // 'root' (cấp 0) và 'mid' (cấp 1) không được thu gọn.
    expect(collapsed.has('root')).toBe(false);
    expect(collapsed.has('mid')).toBe(false);
  });
});
