import { describe, expect, it } from 'vitest';
import {
  NODE_TYPE_EMOJI,
  NODE_TYPE_LABEL,
  NODE_TYPE_OPTIONS,
} from '@/lib/tree/node-meta';
import { RESOURCE_KINDS } from '@/lib/db/schema-resources';

describe('node type metadata (audit C2.2)', () => {
  it('covers the spec node type list', () => {
    const spec = [
      'course', 'phase', 'stage', 'week', 'session', 'module', 'lesson',
      'reading', 'video', 'tool', 'theory', 'lab', 'project', 'task',
      'milestone', 'exam', 'capstone', 'custom',
    ];
    for (const t of spec) {
      expect(NODE_TYPE_LABEL[t], `missing label for ${t}`).toBeTruthy();
      expect(NODE_TYPE_EMOJI[t], `missing emoji for ${t}`).toBeTruthy();
    }
  });

  it('derives NODE_TYPE_OPTIONS from the label map', () => {
    expect(NODE_TYPE_OPTIONS.map((o) => o.value)).toEqual(
      Object.keys(NODE_TYPE_LABEL),
    );
    const byValue = Object.fromEntries(NODE_TYPE_OPTIONS.map((o) => [o.value, o]));
    expect(byValue.reading).toEqual({ value: 'reading', label: 'Đọc tài liệu', emoji: '📖' });
    expect(byValue.video).toEqual({ value: 'video', label: 'Video', emoji: '▶️' });
    expect(byValue.tool).toEqual({ value: 'tool', label: 'Công cụ', emoji: '🛠️' });
  });
});

describe('resource kinds (audit C3.2)', () => {
  it('includes tool and lab alongside the original set', () => {
    expect(RESOURCE_KINDS).toEqual(['link', 'video', 'doc', 'book', 'tool', 'lab']);
  });
});
