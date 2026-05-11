/**
 * Export server actions — generate PDF or XLSX of Skills Matrix.
 * Returns base64-encoded buffer + filename for client to trigger download.
 *
 * Note: PDF rendering with @react-pdf/renderer happens inside this server action.
 * For large workspaces, consider moving to a background job (export_jobs table)
 * — see DESIGN_FUTURE.md §2.
 */
'use server';

import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, skillCategories, userSkillProgress, competencyLevels, workspaces } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return ws;
}

type ExportRow = {
  category: string;
  skill: string;
  level: string;
  numeric: number;
  target: string;
  crowns: number;
  updatedAt: string;
};

async function buildRows(workspaceSlug: string): Promise<{ rows: ExportRow[]; wsName: string }> {
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);

  const [data, levels] = await Promise.all([
    db
      .select({
        category: skillCategories.name,
        skill: skills.name,
        levelCode: userSkillProgress.levelCode,
        targetLevelCode: userSkillProgress.targetLevelCode,
        crowns: userSkillProgress.crowns,
        updatedAt: userSkillProgress.updatedAt,
      })
      .from(skills)
      .innerJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
      .leftJoin(
        userSkillProgress,
        and(
          eq(userSkillProgress.skillId, skills.id),
          eq(userSkillProgress.userId, user.id),
          eq(userSkillProgress.workspaceId, ws.id),
        ),
      )
      .where(eq(skills.workspaceId, ws.id))
      .orderBy(asc(skillCategories.displayOrder), asc(skills.displayOrder)),

    db
      .select()
      .from(competencyLevels)
      .where(eq(competencyLevels.workspaceId, ws.id)),
  ]);

  const numByCode = new Map(levels.map((l) => [l.code, l.numericValue]));

  const rows: ExportRow[] = data.map((r) => ({
    category: r.category,
    skill: r.skill,
    level: r.levelCode ?? '—',
    numeric: r.levelCode ? numByCode.get(r.levelCode) ?? 0 : 0,
    target: r.targetLevelCode ?? '—',
    crowns: r.crowns ?? 0,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '—',
  }));
  return { rows, wsName: ws.name };
}

/* ===== XLSX export ===== */
export async function exportXlsx(workspaceSlug: string): Promise<{ filename: string; base64: string }> {
  const { rows, wsName } = await buildRows(workspaceSlug);
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Competency Framework';
  wb.created = new Date();

  const ws = wb.addWorksheet('Skills');
  ws.columns = [
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Skill', key: 'skill', width: 40 },
    { header: 'Level', key: 'level', width: 8 },
    { header: 'Numeric', key: 'numeric', width: 10 },
    { header: 'Target', key: 'target', width: 8 },
    { header: 'Crowns', key: 'crowns', width: 8 },
    { header: 'Updated', key: 'updatedAt', width: 14 },
  ];
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2029' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFE6E8EC' } };

  const buf = await wb.xlsx.writeBuffer();
  return {
    filename: `${slugify(wsName)}-skills-${new Date().toISOString().slice(0, 10)}.xlsx`,
    base64: Buffer.from(buf).toString('base64'),
  };
}

/* ===== JSON dump (always works, no extra deps) ===== */
export async function exportJson(workspaceSlug: string): Promise<{ filename: string; base64: string }> {
  const { rows, wsName } = await buildRows(workspaceSlug);
  const payload = {
    workspace: wsName,
    exportedAt: new Date().toISOString(),
    skills: rows,
  };
  return {
    filename: `${slugify(wsName)}-skills-${new Date().toISOString().slice(0, 10)}.json`,
    base64: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
  };
}

/* ===== Simple HTML-to-PDF fallback (server-rendered HTML, user prints) ===== */
export async function exportHtmlReport(workspaceSlug: string): Promise<{ filename: string; base64: string }> {
  const { rows, wsName } = await buildRows(workspaceSlug);
  const lvlColor: Record<string, string> = {
    XS: '#64748B',
    S: '#0EA5E9',
    M: '#10B981',
    L: '#8B5CF6',
  };
  const tableRows = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.skill)}</td>
        <td style="color:${lvlColor[r.level] ?? '#888'};font-weight:bold">${r.level}</td>
        <td>${r.numeric}</td>
        <td>${r.target}</td>
        <td>${r.crowns}/5</td>
        <td style="color:#888">${r.updatedAt}</td>
      </tr>`,
    )
    .join('\n');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(wsName)} — Skills Matrix</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#0A0C10; color:#E6E8EC; padding:32px; }
  h1 { background: linear-gradient(135deg,#22D3EE,#8B5CF6); -webkit-background-clip:text; color:transparent; }
  table { border-collapse:collapse; width:100%; margin-top:16px; }
  th, td { padding:8px 12px; text-align:left; border-bottom:1px solid #242A33; font-size:13px; }
  th { background:#161A22; text-transform:uppercase; font-size:11px; letter-spacing:0.06em; }
  @media print { body { background:white; color:black; } th { background:#eee; } td { border-color:#ccc; } }
</style></head>
<body>
  <h1>${escapeHtml(wsName)} — Skills Matrix</h1>
  <p style="color:#9BA1AA">Exported ${new Date().toLocaleString()}. ${rows.length} skills.</p>
  <p style="color:#9BA1AA;font-size:12px">Tip: Use browser File → Print → Save as PDF for a PDF copy.</p>
  <table>
    <thead><tr><th>Category</th><th>Skill</th><th>Level</th><th>Num</th><th>Target</th><th>Crowns</th><th>Updated</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`;
  return {
    filename: `${slugify(wsName)}-skills-${new Date().toISOString().slice(0, 10)}.html`,
    base64: Buffer.from(html).toString('base64'),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
