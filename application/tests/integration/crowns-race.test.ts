/**
 * `awardCrowns` — không được mất lượt khi hai luồng chạy song song.
 *
 * Bản cũ SELECT `crowns`, cộng trong JS, rồi UPDATE đè. Hai tab hoàn thành bài
 * cùng lúc đọc được cùng một số, cộng ra cùng một kết quả, ghi đè lên nhau —
 * người học mất một vương miện mà không có dấu vết gì. Nhánh `insert` còn tệ
 * hơn: hai lượt song song cùng thấy "chưa có dòng" rồi cùng chèn, đâm vào
 * `usp_ws_user_skill_uq`.
 *
 * Hai nhóm test ở đây gác hai thứ khác nhau:
 *  1. Cuộc đua: chạy song song thật rồi đếm kết quả cuối.
 *  2. Bản sao logic: `level_source` giờ được viết hai lần — `nextLevelSource`
 *     trong TS và một CASE trong SQL. Bài cuối đối chiếu từng giá trị enum để
 *     hai bản không âm thầm lệch nhau.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  skillCategories,
  skills,
  levelTracks,
  weeks,
  modules,
  lessons,
  lessonSkillMap,
  userSkillProgress,
} from '@/lib/db/schema';
import { awardCrowns } from '@/lib/gamification/crowns';
import { nextLevelSource, type LevelSource } from '@/lib/skills/level-source';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000cc';

let wsId = '';
let lessonId = '';
let skillId = '';
const allIds: string[] = [];

beforeEach(async () => {
  const [ws] = await db
    .insert(workspaces)
    .values({
      slug: `it-crown-${TAG}-${process.hrtime()[1]}`,
      name: 'IT crowns',
      visibility: 'private',
      ownerUserId: USER,
    })
    .returning({ id: workspaces.id });
  wsId = ws!.id;
  allIds.push(wsId);

  const [cat] = await db
    .insert(skillCategories)
    .values({ workspaceId: wsId, slug: `c-${TAG}`, name: 'C' })
    .returning({ id: skillCategories.id });
  const [sk] = await db
    .insert(skills)
    .values({ workspaceId: wsId, categoryId: cat!.id, slug: `s-${TAG}`, name: 'S' })
    .returning({ id: skills.id });
  skillId = sk!.id;

  const [track] = await db
    .insert(levelTracks)
    .values({ workspaceId: wsId, levelCode: 'XS', title: 'T' })
    .returning({ id: levelTracks.id });
  const [week] = await db
    .insert(weeks)
    .values({ workspaceId: wsId, trackId: track!.id, weekIndex: 1, title: 'W' })
    .returning({ id: weeks.id });
  const [mod] = await db
    .insert(modules)
    .values({ workspaceId: wsId, weekId: week!.id, title: 'M' })
    .returning({ id: modules.id });
  const [les] = await db
    .insert(lessons)
    .values({ workspaceId: wsId, moduleId: mod!.id, slug: `l-${TAG}`, title: 'L' })
    .returning({ id: lessons.id });
  lessonId = les!.id;

  await db.insert(lessonSkillMap).values({
    lessonId,
    skillId,
    contributesToLevel: 'XS',
  });
});

afterAll(async () => {
  if (allIds.length === 0) return;
  await db.delete(userSkillProgress).where(inArray(userSkillProgress.workspaceId, allIds));
  await db.delete(workspaces).where(inArray(workspaces.id, allIds));
});

const readCrowns = async () => {
  const rows = await db
    .select({ crowns: userSkillProgress.crowns, source: userSkillProgress.levelSource })
    .from(userSkillProgress)
    .where(
      and(
        eq(userSkillProgress.workspaceId, wsId),
        eq(userSkillProgress.userId, USER),
        eq(userSkillProgress.skillId, skillId),
      ),
    )
    .limit(1);
  return rows[0];
};

describe('hai lượt song song không làm mất vương miện', () => {
  it('3 lượt cùng lúc từ số 0 → đúng 3, không phải 1', async () => {
    await Promise.all([
      awardCrowns(wsId, USER, lessonId, false),
      awardCrowns(wsId, USER, lessonId, false),
      awardCrowns(wsId, USER, lessonId, false),
    ]);

    // Bản cũ: cả ba đọc 0 (hoặc thấy "chưa có dòng"), cùng ghi 1 → kết quả 1.
    expect((await readCrowns())?.crowns).toBe(3);
  });

  it('chạm trần 5 thì dừng ở 5, không vượt', async () => {
    await Promise.all(
      Array.from({ length: 8 }, () => awardCrowns(wsId, USER, lessonId, false)),
    );
    expect((await readCrowns())?.crowns).toBe(5);
  });
});

describe('delta báo về đúng mức tăng thật', () => {
  it('lượt chạm trần chỉ tính phần cộng được', async () => {
    // Đưa lên 4 rồi cộng 2 (mastered): trần là 5 nên chỉ tăng được 1.
    for (let i = 0; i < 4; i++) await awardCrowns(wsId, USER, lessonId, false);
    expect((await readCrowns())?.crowns).toBe(4);

    const advances = await awardCrowns(wsId, USER, lessonId, true);
    expect(advances).toHaveLength(1);
    expect(advances[0]!.newCrowns).toBe(5);
    // Suy ngược từ số mới là không đủ: cũ=4 và cũ=3 đều cho mới=5.
    expect(advances[0]!.delta).toBe(1);
  });

  it('đã đầy 5 thì không báo advance nào', async () => {
    for (let i = 0; i < 5; i++) await awardCrowns(wsId, USER, lessonId, false);
    expect(await awardCrowns(wsId, USER, lessonId, false)).toEqual([]);
  });
});

describe('CASE trong SQL không được lệch với nextLevelSource', () => {
  /** Đúng ba nhánh mà CASE trong crowns.ts đang viết. */
  function sqlCaseEquivalent(prev: LevelSource | null): LevelSource {
    if (prev === 'verified') return 'verified';
    if (prev === 'self_claimed' || prev === 'both') return 'both';
    return 'learned';
  }

  it.each<LevelSource | null>([
    null,
    'self_claimed',
    'learned',
    'both',
    'verified',
  ])('prev=%s cho cùng kết quả ở cả hai bản', (prev) => {
    expect(sqlCaseEquivalent(prev)).toBe(nextLevelSource(prev, 'learn'));
  });

  it('CASE trong crowns.ts vẫn đủ ba nhánh', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/lib/gamification/crowns.ts', 'utf8');
    expect(src).toMatch(/= 'verified' THEN 'verified'/);
    expect(src).toMatch(/IN \('self_claimed', 'both'\) THEN 'both'/);
    expect(src).toMatch(/ELSE 'learned'/);
  });

  it('hoàn thành bài KHÔNG xoá dấu đã-duyệt', async () => {
    await awardCrowns(wsId, USER, lessonId, false);
    await db
      .update(userSkillProgress)
      .set({ levelSource: 'verified' })
      .where(
        and(
          eq(userSkillProgress.workspaceId, wsId),
          eq(userSkillProgress.userId, USER),
          eq(userSkillProgress.skillId, skillId),
        ),
      );

    await awardCrowns(wsId, USER, lessonId, false);
    expect((await readCrowns())?.source).toBe('verified');
  });
});
