/**
 * Server-safe heading parser for markdown `body_md` strings.
 *
 * Extracts `## ` and `### ` ATX headings and produces stable slugs that
 * match the ones generated client-side by `MarkdownRenderer` — so the
 * `NodeToc` anchor `#hash` links resolve to the rendered heading `id`s.
 *
 * Code fences are stripped before scanning so we don't pick up `# foo`
 * lines that appear inside example code samples.
 *
 * Kept in `lib/` instead of next to `node-toc.tsx` so it can be imported
 * from server components (the TOC component itself is `'use client'`).
 */
export interface TocHeading {
  /** 2 for `##`, 3 for `###` */
  level: 2 | 3;
  text: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseHeadings(md: string | null | undefined): TocHeading[] {
  if (!md) return [];
  const stripped = md.replace(/```[\s\S]*?```/g, '');
  const out: TocHeading[] = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const level = m[1]!.length as 2 | 3;
    const text = m[2]!.trim().replace(/\s*#*\s*$/, '');
    if (!text) continue;
    out.push({ level, text, slug: slugify(text) });
  }
  return out;
}
