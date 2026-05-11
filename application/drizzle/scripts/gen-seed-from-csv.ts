/**
 * Generate (or update) drizzle/seeds/devops.json from 2 CSV files exported from Google Sheets.
 *
 * Inputs:
 *   - drizzle/seeds/raw-csv/skills.csv  (Sheet 1: gid 1970847068)
 *   - drizzle/seeds/raw-csv/levels.csv  (Sheet 2: gid 1890838692)
 *
 * Output:
 *   - drizzle/seeds/devops.json  (overwrites `categories` + `levels` blocks)
 *
 * Tracks / weeks / modules / lessons / exercises are PRESERVED — manage them separately
 * in the JSON (or via the Framework Editor UI after fork).
 *
 * Run:
 *   pnpm gen:seed-from-csv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';

const ROOT = resolve(__dirname, '..');
const SKILLS_CSV = resolve(ROOT, 'seeds/raw-csv/skills.csv');
const LEVELS_CSV = resolve(ROOT, 'seeds/raw-csv/levels.csv');
const TARGET_JSON = resolve(ROOT, 'seeds/devops.json');

type SkillCsvRow = {
  Category: string;
  Skill: string;
  Description?: string;
  Tags?: string;
  'Display Order'?: string;
};

type LevelCsvRow = {
  Code: string;
  Label: string;
  Numeric: string;
  Description?: string;
  Examples?: string;
};

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseCsv<T>(path: string, label: string): T[] {
  if (!existsSync(path)) {
    throw new Error(
      `${label} not found at ${path}\n` +
        `Export the sheet to CSV and place it in drizzle/seeds/raw-csv/ (see README there).`,
    );
  }
  const text = readFileSync(path, 'utf-8');
  const { data, errors } = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (errors.length > 0) {
    console.warn(`[gen-seed] ${label}: ${errors.length} CSV warning(s).`);
  }
  return data;
}

function buildCategories(rows: SkillCsvRow[]) {
  const byCategory = new Map<string, { slug: string; name: string; skills: SkillSeed[] }>();
  let order = 0;
  for (const row of rows) {
    const catName = row.Category?.trim();
    const skillName = row.Skill?.trim();
    if (!catName || !skillName) continue;
    if (!byCategory.has(catName)) {
      byCategory.set(catName, { slug: toSlug(catName), name: catName, skills: [] });
    }
    const cat = byCategory.get(catName)!;
    cat.skills.push({
      slug: toSlug(skillName),
      name: skillName,
      description: row.Description?.trim() || undefined,
      tags: row.Tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
      displayOrder: Number(row['Display Order'] ?? order++),
    });
  }
  return Array.from(byCategory.values());
}

type SkillSeed = {
  slug: string;
  name: string;
  description?: string;
  tags?: string[];
  displayOrder?: number;
};

function buildLevels(rows: LevelCsvRow[]) {
  return rows
    .filter((r) => r.Code?.trim())
    .map((r, i) => ({
      code: r.Code.trim(),
      label: r.Label?.trim() ?? r.Code,
      numeric: Number(r.Numeric) || 0,
      description: r.Description?.trim() || undefined,
      examples: r.Examples?.trim() || undefined,
      color: ['#64748B', '#0EA5E9', '#10B981', '#8B5CF6'][i] ?? '#94A3B8',
    }));
}

function main() {
  console.log('[gen-seed] Reading CSVs ...');
  const skillsRows = parseCsv<SkillCsvRow>(SKILLS_CSV, 'skills.csv');
  const levelsRows = parseCsv<LevelCsvRow>(LEVELS_CSV, 'levels.csv');
  console.log(`[gen-seed] ${skillsRows.length} skill rows, ${levelsRows.length} level rows.`);

  const categories = buildCategories(skillsRows);
  const levels = buildLevels(levelsRows);

  console.log('[gen-seed] Loading existing devops.json ...');
  const existing = JSON.parse(readFileSync(TARGET_JSON, 'utf-8'));

  const merged = {
    ...existing,
    levels,
    categories,
  };

  writeFileSync(TARGET_JSON, JSON.stringify(merged, null, 2));
  console.log(`[gen-seed] Wrote ${TARGET_JSON}`);
  console.log(`[gen-seed] Categories: ${categories.length}, Skills: ${categories.reduce((n, c) => n + c.skills.length, 0)}, Levels: ${levels.length}`);
  console.log(`[gen-seed] Next: pnpm db:seed`);
}

main();
