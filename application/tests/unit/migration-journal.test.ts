import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bất biến của đợt B: chuỗi migration là NGUỒN SỰ THẬT DUY NHẤT của schema.
 *
 * Lỗi đã xảy ra thật (2026-08-21): thư mục có 14 file .sql nhưng
 * `_journal.json` chỉ ghi 2 → `drizzle-kit migrate` bỏ qua 12 file, và
 * `0016_rls_policies.sql` chưa từng chạy dù đã viết xong. Không ai phát hiện
 * vì `db:setup` dùng `drizzle-kit push` (diff thẳng từ schema.ts), nên DB dev
 * vẫn "đúng" trong khi chuỗi migration thì không dựng lại nổi.
 *
 * Test này chặn đúng kiểu trôi đó: thêm file .sql mà quên khai vào journal là đỏ.
 */

const MIG_DIR = join(process.cwd(), 'drizzle', 'migrations');

/**
 * File CỐ TÌNH để ngoài chuỗi, kèm lý do. Danh sách này phải ngắn và mỗi dòng
 * phải có ngày gỡ cách ly dự kiến — nếu không nó lại thành chỗ giấu rác.
 */
const QUARANTINE: Record<string, string> = {
  '0016_rls_policies':
    'Bật RLS fail-closed. Chỉ được vào chuỗi SAU KHI withWorkspace() thật sự ' +
    'chạy `SET LOCAL app.workspace_id` trong transaction (đợt E). Vào chuỗi ' +
    'sớm hơn = mọi query trả rỗng = app chết.',
};

function journalTags(): string[] {
  const raw = readFileSync(join(MIG_DIR, 'meta', '_journal.json'), 'utf8');
  return (JSON.parse(raw).entries as Array<{ tag: string }>).map((e) => e.tag);
}

function sqlTags(): string[] {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, -4));
}

describe('chuỗi migration', () => {
  it('mọi file .sql đều nằm trong journal, trừ danh sách cách ly có lý do', () => {
    const inJournal = new Set(journalTags());
    const orphans = sqlTags().filter((t) => !inJournal.has(t) && !(t in QUARANTINE));
    expect(orphans, `file .sql không được khai vào _journal.json: ${orphans.join(', ')}`).toEqual([]);
  });

  it('journal không trỏ tới file không tồn tại', () => {
    const onDisk = new Set(sqlTags());
    const dangling = journalTags().filter((t) => !onDisk.has(t));
    expect(dangling, `journal trỏ file đã mất: ${dangling.join(', ')}`).toEqual([]);
  });

  it('file bị cách ly không được lẫn vào journal', () => {
    const inJournal = new Set(journalTags());
    const leaked = Object.keys(QUARANTINE).filter((t) => inJournal.has(t));
    expect(leaked, `file cách ly đã lọt vào chuỗi: ${leaked.join(', ')}`).toEqual([]);
  });

  it('idx liên tục từ 0 và when tăng dần', () => {
    const raw = readFileSync(join(MIG_DIR, 'meta', '_journal.json'), 'utf8');
    const entries = JSON.parse(raw).entries as Array<{ idx: number; when: number }>;
    expect(entries.map((e) => e.idx)).toEqual(entries.map((_, i) => i));
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const cur = entries[i];
      if (!prev || !cur) throw new Error(`journal thủng tại idx ${i}`);
      expect(cur.when, `when phải tăng dần tại idx ${i}`).toBeGreaterThan(prev.when);
    }
  });

  it('mọi lý do cách ly đều nói rõ điều kiện gỡ', () => {
    for (const [tag, reason] of Object.entries(QUARANTINE)) {
      expect(reason.length, `${tag}: lý do quá ngắn`).toBeGreaterThan(40);
    }
  });
});
