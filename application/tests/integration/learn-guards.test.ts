/**
 * Hai chốt của `completeLesson`, kiểm trên DB thật.
 *
 * Cả hai lỗi này cùng một thói quen: TIN THAM SỐ PHÍA GỌI GỬI LÊN.
 *
 *  1. `lessonId` không được đối chiếu với workspace. `startLesson` ngay trên
 *     có khối kiểm y hệt, `completeLesson` thì không — nên learner ở workspace
 *     A gọi được với `lessonId` của workspace B và sinh ra dòng tiến độ của A
 *     trỏ sang bài của B.
 *
 *  2. `scorePct` được nhận từ client và dùng làm nhánh dự phòng ngay dưới một
 *     chú thích ghi "never trust client". `computeLessonScore` trả `null` đúng
 *     khi bài học không có bài tập nào — và đó chính là lúc nhánh ấy chạy.
 *
 * Test này kiểm bằng ĐẾM HÀNG TRONG DB, không chỉ bắt exception: một hàm có thể
 * ném lỗi sau khi đã ghi xong, và đó chính là dạng lỗi vừa vá ở `submitExercise`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  workspaceMembers,
  levelTracks,
  weeks,
  modules,
  lessons,
  exercises,
  userLessonProgress,
} from '@/lib/db/schema';
import { computeLessonScore } from '@/lib/learn/xp-award';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000lg'.replace('lg', '1a');

let wsAId = '';
let wsBId = '';
let lessonBId = '';
let lessonAEmptyId = '';

beforeAll(async () => {
  const [a] = await db
    .insert(workspaces)
    .values({
      slug: `it-learn-a-${TAG}`,
      name: 'IT learn A',
      visibility: 'private',
      ownerUserId: USER,
    })
    .returning({ id: workspaces.id });
  wsAId = a!.id;

  const [b] = await db
    .insert(workspaces)
    .values({
      slug: `it-learn-b-${TAG}`,
      name: 'IT learn B',
      visibility: 'private',
      ownerUserId: '00000000-0000-0000-0000-0000000000bb',
    })
    .returning({ id: workspaces.id });
  wsBId = b!.id;

  // Người dùng là thành viên của A, KHÔNG phải của B.
  await db.insert(workspaceMembers).values({
    workspaceId: wsAId,
    userId: USER,
    role: 'learner',
  });

  // `lessons` treo dưới chuỗi level_tracks → weeks → modules (đều NOT NULL),
  // nên phải dựng đủ chuỗi trong workspace B mới tạo được bài học ở đó.
  const [track] = await db
    .insert(levelTracks)
    .values({ workspaceId: wsBId, levelCode: 'XS', title: 'T' })
    .returning({ id: levelTracks.id });
  const [week] = await db
    .insert(weeks)
    .values({ workspaceId: wsBId, trackId: track!.id, weekIndex: 1, title: 'W' })
    .returning({ id: weeks.id });
  const [mod] = await db
    .insert(modules)
    .values({ workspaceId: wsBId, weekId: week!.id, title: 'M' })
    .returning({ id: modules.id });

  const [les] = await db
    .insert(lessons)
    .values({
      workspaceId: wsBId,
      moduleId: mod!.id,
      slug: `bai-cua-b-${TAG}`,
      title: 'Bài của workspace B',
    })
    .returning({ id: lessons.id });
  lessonBId = les!.id;

  // Bài học của B PHẢI có bài tập, nếu không phép đo vô nghĩa: bài rỗng thì cả
  // code cũ lẫn code mới đều trả `null` và test xanh trên cả hai. Có bài tập
  // thuộc B thì mới phân biệt được — code cũ lọc theo mỗi `lessonId` nên đếm
  // được chúng, code mới lọc thêm workspace nên không.
  await db.insert(exercises).values({
    workspaceId: wsBId,
    lessonId: lessonBId,
    kind: 'mcq_single',
    promptMd: 'Bài tập của workspace B',
    payload: { choices: ['a', 'b'], answer: 0 },
  });

  // Bài học RỖNG trong workspace A — dùng cho phép kiểm "null nghĩa là 0".
  const [trackA] = await db
    .insert(levelTracks)
    .values({ workspaceId: wsAId, levelCode: 'XS', title: 'T' })
    .returning({ id: levelTracks.id });
  const [weekA] = await db
    .insert(weeks)
    .values({ workspaceId: wsAId, trackId: trackA!.id, weekIndex: 1, title: 'W' })
    .returning({ id: weeks.id });
  const [modA] = await db
    .insert(modules)
    .values({ workspaceId: wsAId, weekId: weekA!.id, title: 'M' })
    .returning({ id: modules.id });
  const [lesA] = await db
    .insert(lessons)
    .values({
      workspaceId: wsAId,
      moduleId: modA!.id,
      slug: `bai-rong-a-${TAG}`,
      title: 'Bài rỗng của workspace A',
    })
    .returning({ id: lessons.id });
  lessonAEmptyId = lesA!.id;
});

afterAll(async () => {
  const ids = [wsAId, wsBId].filter(Boolean);
  if (ids.length === 0) return;
  await db.delete(userLessonProgress).where(inArray(userLessonProgress.workspaceId, ids));
  await db.delete(exercises).where(inArray(exercises.workspaceId, ids));
  await db.delete(lessons).where(inArray(lessons.workspaceId, ids));
  await db.delete(workspaceMembers).where(inArray(workspaceMembers.workspaceId, ids));
  await db.delete(workspaces).where(inArray(workspaces.id, ids));
});

describe('computeLessonScore — không đếm bài tập của tenant khác', () => {
  it('bài của workspace B (CÓ bài tập), hỏi từ workspace A → null', async () => {
    // Đây là bài đo thật sự phân biệt được hai phiên bản. Bài học của B có 1
    // bài tập thuộc B. Code cũ lọc theo mỗi `lessonId` nên đếm được nó và trả
    // về một con số; code mới lọc thêm workspace nên không thấy gì → null.
    expect(await computeLessonScore(wsAId, USER, lessonBId)).toBeNull();
  });

  it('hỏi đúng workspace của bài thì thấy bài tập của nó', async () => {
    // Chưa làm đúng câu nào → 0/1 = 0, nhưng KHÁC null: "có bài để chấm".
    expect(await computeLessonScore(wsBId, USER, lessonBId)).toBe(0);
  });
});

describe('null nghĩa là "chưa có gì để chấm", không phải "giữ số client gửi"', () => {
  it('quy ước điểm cho bài không có bài tập là 0, và 0 thì KHÔNG mastered', async () => {
    const raw = await computeLessonScore(wsAId, USER, lessonAEmptyId);
    expect(raw).toBeNull();

    // Đúng phép quy đổi mà completeLesson đang dùng.
    const scorePct = raw ?? 0;
    const mastered = scorePct >= 0.999;

    expect(scorePct).toBe(0);
    expect(mastered).toBe(false);
  });
});

/**
 * Chốt tenant và việc bỏ `scorePct` nằm trong `completeLesson`, mà hàm đó gọi
 * `resolveWorkspace` → `requireUser()` → cần phiên đăng nhập thật. Vitest không
 * có phiên, nên kiểm ở mức nguồn: khối kiểm phải CÓ MẶT và tham số phải BIẾN MẤT.
 *
 * Thô hơn test hành vi, nhưng nó bắt đúng thứ có thể mất đi khi ai đó sửa lại
 * file này — và bắt được ngay trong `pnpm test`, không cần dựng phiên giả.
 */
describe('completeLesson giữ nguyên hai chốt', () => {
  it('có đối chiếu lessonId với workspace trước khi ghi', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/learn.ts', 'utf8');

    const start = src.indexOf('export async function completeLesson');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, start + 3000);

    expect(body).toMatch(/eq\(lessons\.workspaceId,\s*ws\.id\)/);
    expect(body).toMatch(/LESSON_NOT_FOUND/);
  });

  it('KHÔNG còn nhận scorePct từ phía gọi', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/learn.ts', 'utf8');

    // Bỏ dòng chú thích trước khi soi: chú thích giải thích lỗi cũ có nhắc tên
    // tham số, và đó là điều nên khuyến khích chứ không nên bị test phạt.
    const code = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    const start = code.indexOf('const completeInput');
    const end = code.indexOf('});', start);
    expect(code.slice(start, end)).not.toMatch(/scorePct/);

    // Nhánh dự phòng nhận điểm client phải biến mất, và điểm phải quy về 0.
    expect(code).not.toMatch(/\?\?\s*parsed\.scorePct/);
    expect(code).toMatch(/computeLessonScore\([^)]*\)\s*\)\s*\?\?\s*0/);
  });
});
