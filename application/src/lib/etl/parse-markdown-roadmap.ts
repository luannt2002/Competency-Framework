/**
 * Pure markdown parser for the 4 PHASE roadmap files
 * (02_PHASE1_*.md, 03_PHASE2_*.md, 04_PHASE3_*.md, 05_PHASE4_*.md).
 *
 * Heading conventions enforced by the source files:
 *
 *   # 🟢 PHASE 1 — Q1 (Tháng 1–3)
 *   ## AWS Deep Dive + Terraform Mastery ...           ← phaseTitle (h2 right after h1)
 *   ### 🗓️ **WEEK N — Title**                          ← week block start
 *     #### Main Topics
 *     #### Core Knowledge & Key Concepts
 *     #### Hands-on Projects / Labs                    (contains **Lab N.X: ...** blocks
 *                                                        and optional 🛠️ **Tool #N: ...** blocks)
 *     #### AI-Assisted Tasks
 *     #### Resources
 *     #### Milestone & Deliverables
 *     #### Self-Assessment                             (terminator of a week)
 *
 * The parser is forgiving: any of the inner sub-sections may be missing on a
 * given week, in which case the corresponding output field is `[]`. The week
 * block is closed by the next `### ` heading (or EOF).
 *
 * Output type {@link ParsedPhase} maps cleanly onto the `level_tracks` /
 * `weeks` / `labs` tables in {@link ../db/schema}.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type PhaseLevelCode = 'XS' | 'S' | 'M' | 'L';

export interface ParsedLab {
  title: string;
  description: string;
}

export interface ParsedWeek {
  index: number;
  title: string;
  summary: string;
  goals: string[];
  keywords: string[];
  estHours: number;
  mainTopics: string[];
  coreKnowledge: string[];
  labs: ParsedLab[];
  resources: string[];
}

export interface ParsedPhase {
  phaseTitle: string;
  quarter: Quarter;
  levelCode: PhaseLevelCode;
  weeks: ParsedWeek[];
}

/* ============================ constants ============================ */

/**
 * Phase number → level code mapping is fixed by the roadmap files:
 *   Phase 1 (Q1) → XS  (Foundational / Intern)
 *   Phase 2 (Q2) → S   (Junior / Working)
 *   Phase 3 (Q3) → M   (Mid / Strong)
 *   Phase 4 (Q4) → L   (Senior / Expert)
 */
const PHASE_TO_LEVEL: Record<number, PhaseLevelCode> = {
  1: 'XS',
  2: 'S',
  3: 'M',
  4: 'L',
};

const PHASE_TO_QUARTER: Record<number, Quarter> = {
  1: 'Q1',
  2: 'Q2',
  3: 'Q3',
  4: 'Q4',
};

/* ============================ helpers ============================ */

/** Drop emojis and zero-width chars used as section icons. */
function stripIconChars(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lines like "- foo" / "* foo" / "1. foo" → "foo"; preserves order, trims. */
function extractBulletList(block: string): string[] {
  const out: string[] = [];
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const m = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    if (m && m[1]) out.push(m[1].trim());
  }
  return out;
}

/** Given the full text and a (start, end) range, return body slice. */
function sliceLines(lines: string[], start: number, end: number): string {
  return lines.slice(start, end).join('\n');
}

/* ============================ phase header ============================ */

interface PhaseHeader {
  phaseNumber: number;
  phaseTitle: string;
  quarter: Quarter;
  levelCode: PhaseLevelCode;
}

function parsePhaseHeader(text: string, filePath: string): PhaseHeader {
  // First non-empty line should be `# 🟢 PHASE N — Q? (...)`
  const lines = text.split(/\r?\n/);
  let h1: string | null = null;
  let h2: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ') && h1 === null) {
      h1 = line;
      continue;
    }
    if (line.startsWith('## ') && h2 === null) {
      h2 = line;
      break;
    }
  }
  if (!h1) {
    throw new Error(
      `parseMarkdownPhase: missing top-level "# PHASE N ..." heading in ${basename(filePath)}`,
    );
  }
  const phaseMatch = /PHASE\s+(\d+)/i.exec(h1);
  if (!phaseMatch || !phaseMatch[1]) {
    throw new Error(
      `parseMarkdownPhase: could not extract phase number from "${h1}" in ${basename(filePath)}`,
    );
  }
  const phaseNumber = Number(phaseMatch[1]);
  const levelCode = PHASE_TO_LEVEL[phaseNumber];
  const quarter = PHASE_TO_QUARTER[phaseNumber];
  if (!levelCode || !quarter) {
    throw new Error(
      `parseMarkdownPhase: unknown phase number ${phaseNumber} in ${basename(filePath)}`,
    );
  }

  // Prefer the H2 (e.g. "## AWS Deep Dive + Terraform Mastery ...") as phase
  // title; fall back to the H1 minus the "# 🟢 PHASE N — ..." prefix.
  const phaseTitle = h2
    ? stripIconChars(h2.replace(/^##\s+/, ''))
    : stripIconChars(h1.replace(/^#\s+/, ''));

  return { phaseNumber, phaseTitle, quarter, levelCode };
}

/* ============================ week block extraction ============================ */

interface WeekBlock {
  /** 1-based index parsed from the heading (e.g. "WEEK 13" → 13). */
  rawIndex: number;
  /** Title without the icon / "WEEK N — " prefix. */
  title: string;
  /** Inclusive line index of the `### ...` heading. */
  startLine: number;
  /** Exclusive end line (next `### ` heading or EOF). */
  endLine: number;
}

function findWeekBlocks(lines: string[]): WeekBlock[] {
  const blocks: WeekBlock[] = [];
  // Indices of `### ` headings throughout the file.
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && /^###\s/.test(line)) headingIndices.push(i);
  }

  for (let i = 0; i < headingIndices.length; i++) {
    const idx = headingIndices[i];
    if (idx === undefined) continue;
    const line = lines[idx];
    if (!line) continue;
    // Match `### 🗓️ **WEEK N — Title**` (icon optional, ** optional).
    const m = /^###\s+(?:\S+\s+)?\*?\*?WEEK\s+(\d+)\s*[—\-:]\s*(.+?)\*?\*?\s*$/i.exec(
      line,
    );
    if (!m || !m[1] || !m[2]) continue;
    const rawIndex = Number(m[1]);
    const title = stripIconChars(m[2].replace(/\*\*/g, '').trim());
    const next = headingIndices[i + 1] ?? lines.length;
    blocks.push({ rawIndex, title, startLine: idx, endLine: next });
  }
  return blocks;
}

/* ============================ inside-week section extraction ============================ */

type WeekSectionKey =
  | 'mainTopics'
  | 'coreKnowledge'
  | 'labs'
  | 'aiTasks'
  | 'resources'
  | 'milestones'
  | 'selfAssessment';

interface SectionRange {
  start: number;
  end: number;
}

const SECTION_PATTERNS: Array<{ key: WeekSectionKey; pattern: RegExp }> = [
  { key: 'mainTopics', pattern: /^####\s+Main\s+Topics\b/i },
  { key: 'coreKnowledge', pattern: /^####\s+Core\s+Knowledge/i },
  { key: 'labs', pattern: /^####\s+Hands-?on\s+Projects/i },
  { key: 'aiTasks', pattern: /^####\s+AI[-\s]?Assisted/i },
  { key: 'resources', pattern: /^####\s+Resources\b/i },
  { key: 'milestones', pattern: /^####\s+Milestone/i },
  { key: 'selfAssessment', pattern: /^####\s+Self[-\s]?Assessment/i },
];

function classifyHeading(line: string): WeekSectionKey | null {
  for (const { key, pattern } of SECTION_PATTERNS) {
    if (pattern.test(line)) return key;
  }
  return null;
}

function extractSections(weekLines: string[]): Partial<Record<WeekSectionKey, SectionRange>> {
  // First pass: collect all `#### ` heading indices and classify them.
  const out: Partial<Record<WeekSectionKey, SectionRange>> = {};
  const order: Array<{ key: WeekSectionKey; line: number }> = [];
  for (let i = 0; i < weekLines.length; i++) {
    const line = weekLines[i];
    if (!line || !line.startsWith('#### ')) continue;
    const key = classifyHeading(line);
    if (!key) continue;
    order.push({ key, line: i });
  }
  for (let j = 0; j < order.length; j++) {
    const cur = order[j];
    if (!cur) continue;
    const next = order[j + 1];
    out[cur.key] = {
      start: cur.line + 1, // skip the heading itself
      end: next ? next.line : weekLines.length,
    };
  }
  return out;
}

/* ============================ labs extraction ============================ */

/**
 * Within the "Hands-on Projects / Labs" section, individual labs are denoted
 * by a bolded title line like:
 *   **Lab 1.1: Setup tài khoản AWS chuẩn**
 *   **🛠️ Tool #1: `shopctl` — multi-command CLI**
 *
 * The description is everything between that line and the next bold-title line
 * (or end of the labs block).
 */
function extractLabs(block: string): ParsedLab[] {
  const lines = block.split(/\r?\n/);
  const titles: Array<{ line: number; raw: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    // Bold-only line starting with **
    if (/^\*\*[^*].*\*\*\s*$/.test(trimmed)) {
      titles.push({ line: i, raw: trimmed });
    }
  }

  const labs: ParsedLab[] = [];
  for (let j = 0; j < titles.length; j++) {
    const cur = titles[j];
    if (!cur) continue;
    const next = titles[j + 1];
    const titleClean = stripIconChars(cur.raw.replace(/^\*\*|\*\*$/g, '').trim());
    // Drop blocks that aren't Lab/Tool/Capstone titles (e.g. random bold lines
    // inside other content) — be conservative on what we promote to a lab row.
    if (!/^(?:Lab\s+\d|Tool\s+#?\d|Capstone|🛠️|Final|Major\s+Project)/i.test(titleClean)) {
      continue;
    }
    const startBody = cur.line + 1;
    const endBody = next ? next.line : lines.length;
    const description = lines.slice(startBody, endBody).join('\n').trim();
    labs.push({ title: titleClean, description });
  }
  return labs;
}

/* ============================ summary / goals / keywords ============================ */

/**
 * Heuristic synthesis from existing sections — we don't try to invent data the
 * markdown doesn't contain:
 *  - summary    = first paragraph of `Main Topics` (≤ ~280 chars).
 *  - goals      = the bullet list under `Milestone & Deliverables`.
 *  - keywords   = the bullet list under `Main Topics` (top-level only).
 *  - estHours   = 8 (the markdown does not state per-week hours; this matches
 *                 the DB column default for `weeks.est_hours`).
 *
 * If a section is missing we return an empty array / empty string. We never
 * fabricate placeholder content.
 */
function synthesizeWeek(
  mainTopics: string[],
  coreKnowledge: string[],
  labs: ParsedLab[],
  resources: string[],
  milestones: string[],
): { summary: string; goals: string[]; keywords: string[] } {
  const summary = mainTopics.slice(0, 3).join(' • ');
  const goals = milestones;
  const keywords = mainTopics;
  void coreKnowledge;
  void labs;
  void resources;
  return { summary, goals, keywords };
}

/* ============================ top-level ============================ */

export function parseMarkdownPhase(filePath: string): ParsedPhase {
  const raw = readFileSync(filePath, 'utf8');
  const header = parsePhaseHeader(raw, filePath);
  const lines = raw.split(/\r?\n/);

  const weekBlocks = findWeekBlocks(lines);

  const weeks: ParsedWeek[] = [];
  for (let i = 0; i < weekBlocks.length; i++) {
    const wb = weekBlocks[i];
    if (!wb) continue;
    const weekLines = lines.slice(wb.startLine, wb.endLine);
    const sections = extractSections(weekLines);

    const mainTopics = sections.mainTopics
      ? extractBulletList(sliceLines(weekLines, sections.mainTopics.start, sections.mainTopics.end))
      : [];
    const coreKnowledge = sections.coreKnowledge
      ? extractBulletList(
          sliceLines(weekLines, sections.coreKnowledge.start, sections.coreKnowledge.end),
        )
      : [];
    const labsBlock = sections.labs
      ? sliceLines(weekLines, sections.labs.start, sections.labs.end)
      : '';
    const labs = extractLabs(labsBlock);
    const resources = sections.resources
      ? extractBulletList(sliceLines(weekLines, sections.resources.start, sections.resources.end))
      : [];
    const milestones = sections.milestones
      ? extractBulletList(sliceLines(weekLines, sections.milestones.start, sections.milestones.end))
      : [];

    const { summary, goals, keywords } = synthesizeWeek(
      mainTopics,
      coreKnowledge,
      labs,
      resources,
      milestones,
    );

    weeks.push({
      // Normalise to 1..12 within a phase (file uses absolute 13..24 for phase 2, etc.).
      index: ((wb.rawIndex - 1) % 12) + 1,
      title: wb.title,
      summary,
      goals,
      keywords,
      estHours: 8,
      mainTopics,
      coreKnowledge,
      labs,
      resources,
    });
  }

  return {
    phaseTitle: header.phaseTitle,
    quarter: header.quarter,
    levelCode: header.levelCode,
    weeks,
  };
}
