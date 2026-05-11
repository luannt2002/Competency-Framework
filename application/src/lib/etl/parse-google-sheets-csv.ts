/**
 * CSV parsers for the two Google Sheets backing the DevOps competency framework.
 *
 * - Skills sheet:  Category, Skill, Description?, Tags?, "Display Order"?
 * - Levels sheet:  Code, Label, Numeric, Description?, Examples?
 *
 * Output shapes are normalised to match the canonical DB rows in
 * {@link ../db/schema} (skills / skill_categories / competency_levels).
 *
 * Validation uses Zod and throws `INGESTION_VALIDATION_FAILED` on schema
 * mismatch — the error's `cause` carries the underlying ZodError.
 */
import Papa from 'papaparse';
import { z } from 'zod';
import { toSlug } from '@/lib/utils';

/* ============================ Public types ============================ */

export interface ParsedSkillSeed {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  displayOrder: number;
}

export interface ParsedCategorySeed {
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  displayOrder: number;
  skills: ParsedSkillSeed[];
}

export interface ParsedSkillsSheet {
  categories: ParsedCategorySeed[];
  /** Flat count for telemetry/log lines. */
  skillCount: number;
}

export interface ParsedLevelSeed {
  code: string;
  label: string;
  numericValue: number;
  description: string | null;
  examples: string | null;
  color: string | null;
  displayOrder: number;
}

export interface ParsedLevelsSheet {
  levels: ParsedLevelSeed[];
}

/* ============================ CSV row schemas ============================ */

const skillsRowSchema = z
  .object({
    Category: z.string().min(1, 'Category required'),
    Skill: z.string().min(1, 'Skill required'),
    Description: z.string().optional(),
    Tags: z.string().optional(),
    'Display Order': z.string().optional(),
  })
  .passthrough();

const levelsRowSchema = z
  .object({
    Code: z.string().min(1, 'Code required'),
    Label: z.string().min(1, 'Label required'),
    Numeric: z.string().min(1, 'Numeric required'),
    Description: z.string().optional(),
    Examples: z.string().optional(),
  })
  .passthrough();

type SkillsRow = z.infer<typeof skillsRowSchema>;
type LevelsRow = z.infer<typeof levelsRowSchema>;

/* ============================ Helpers ============================ */

function parseCsv<T>(csvText: string, label: string): T[] {
  const { data, errors } = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (errors.length > 0) {
    // Surface only the first row error for clarity; rest are usually downstream.
    const first = errors[0];
    throw makeValidationError(`CSV parse error in ${label}: ${first?.message ?? 'unknown'}`);
  }
  return data;
}

function trimOrNull(s: string | undefined): string | null {
  const v = (s ?? '').trim();
  return v ? v : null;
}

function parseTags(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseDisplayOrder(s: string | undefined, fallback: number): number {
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function makeValidationError(message: string, cause?: unknown): Error {
  // Use the canonical code so the API layer can map to 422.
  const err = new Error('INGESTION_VALIDATION_FAILED') as Error & {
    detail: string;
    cause?: unknown;
  };
  err.detail = message;
  if (cause !== undefined) err.cause = cause;
  return err;
}

/* ============================ Skills CSV ============================ */

const CATEGORY_PALETTE: string[] = [
  '#FF9900', // AWS orange
  '#7C3AED', // purple
  '#3B82F6', // blue
  '#00ADD8', // go cyan
  '#10B981', // green
  '#F43F5E', // rose
  '#0EA5E9', // sky
  '#F59E0B', // amber
];

export function parseSkillsSheetCsv(csvText: string): ParsedSkillsSheet {
  const rawRows = parseCsv<unknown>(csvText, 'skills.csv');

  // Validate each row up front so the caller sees row-level error context.
  const validatedRows: SkillsRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parsed = skillsRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      throw makeValidationError(
        `skills.csv row ${i + 2}: ${parsed.error.issues.map((iss) => iss.message).join('; ')}`,
        parsed.error,
      );
    }
    validatedRows.push(parsed.data);
  }

  const byCategory = new Map<string, ParsedCategorySeed>();
  let categoryOrder = 0;
  let skillOrder = 0;
  for (const row of validatedRows) {
    const catName = row.Category.trim();
    const skillName = row.Skill.trim();
    if (!byCategory.has(catName)) {
      const idx = categoryOrder;
      byCategory.set(catName, {
        slug: toSlug(catName),
        name: catName,
        description: null,
        color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length] ?? null,
        icon: null,
        displayOrder: idx,
        skills: [],
      });
      categoryOrder++;
    }
    const cat = byCategory.get(catName);
    if (!cat) continue;
    cat.skills.push({
      slug: toSlug(skillName),
      name: skillName,
      description: trimOrNull(row.Description),
      tags: parseTags(row.Tags),
      displayOrder: parseDisplayOrder(row['Display Order'], skillOrder),
    });
    skillOrder++;
  }

  const categories = Array.from(byCategory.values());
  return { categories, skillCount: skillOrder };
}

/* ============================ Levels CSV ============================ */

const LEVEL_PALETTE: string[] = ['#64748B', '#0EA5E9', '#10B981', '#8B5CF6'];

export function parseLevelsSheetCsv(csvText: string): ParsedLevelsSheet {
  const rawRows = parseCsv<unknown>(csvText, 'levels.csv');

  const validatedRows: LevelsRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parsed = levelsRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      throw makeValidationError(
        `levels.csv row ${i + 2}: ${parsed.error.issues.map((iss) => iss.message).join('; ')}`,
        parsed.error,
      );
    }
    validatedRows.push(parsed.data);
  }

  const levels: ParsedLevelSeed[] = validatedRows.map((row, i) => {
    const numeric = Number(row.Numeric);
    if (!Number.isFinite(numeric)) {
      throw makeValidationError(
        `levels.csv row ${i + 2}: Numeric "${row.Numeric}" is not a number`,
      );
    }
    return {
      code: row.Code.trim(),
      label: row.Label.trim(),
      numericValue: numeric,
      description: trimOrNull(row.Description),
      examples: trimOrNull(row.Examples),
      color: LEVEL_PALETTE[i] ?? null,
      displayOrder: i,
    };
  });

  return { levels };
}
