'use client';

/**
 * MarkdownRenderer — opinionated wrapper around react-markdown.
 *
 * Renders node `body_md` content with consistent styling across LEARN
 * (/w/[slug]/n/[nodeSlug]) and SHARE (/share/[slug]/n/[nodeSlug]) modes:
 *
 *   - Inline code: subtle pill chip (bg-muted).
 *   - Fenced code blocks: top bar showing the language tag and a copy
 *     button; body is monospace and scrolls horizontally. Light/dark
 *     theming applies automatically via tailwind dark: variants.
 *   - Headings (h1/h2/h3): receive auto-generated slug ids matching the
 *     server-side regex in tree/queries → node-toc; an anchor `#` icon
 *     appears on hover and copies the deep link to the clipboard.
 *   - External links: target="_blank" rel="noopener" + ExternalLink icon.
 *   - Images: wrapped in a `<figure>` with optional `<figcaption>` derived
 *     from alt text. Marked `loading="lazy"` to defer offscreen images.
 *   - Blockquotes: coral left border, italic body — matches roadmap palette.
 *   - Tables: full-width with subtle borders + alternating row background.
 *
 * Client component because the code-block copy button needs an onClick
 * handler; the rest of the rendering happens during the React commit phase.
 */
import * as React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- slug ---------- */
/** Mirror of `slugifyHeading` in node-toc.tsx — keep them identical. */
export function slugifyHeading(text: string): string {
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

/* ---------- helpers to derive plain text from React children ---------- */
function childrenToText(children: React.ReactNode): string {
  let out = '';
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      out += String(child);
    } else if (React.isValidElement(child)) {
      const props = child.props as { children?: React.ReactNode };
      out += childrenToText(props.children);
    }
  });
  return out;
}

/* ---------- code block (fenced) ---------- */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — silently fail */
    }
  };

  return (
    <div
      data-copy-button
      className={cn(
        'my-4 overflow-hidden rounded-lg border',
        'bg-slate-50 border-slate-200',
        'dark:bg-slate-900 dark:border-slate-700',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 text-xs',
          'bg-slate-100/70 border-b border-slate-200 text-slate-600',
          'dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-400',
        )}
      >
        <span className="font-mono uppercase tracking-wider">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy code"
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
            'hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors',
          )}
        >
          {copied ? (
            <>
              <Check className="size-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

/* ---------- heading with anchor ---------- */
function HeadingAnchor({
  level,
  children,
}: {
  level: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const text = childrenToText(children);
  const id = slugifyHeading(text);

  const onCopyAnchor = async () => {
    try {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}#${id}`
          : `#${id}`;
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard denied */
    }
  };

  const headingClass =
    level === 1
      ? 'text-2xl font-bold tracking-tight mt-8 mb-3'
      : level === 2
        ? 'text-xl font-semibold tracking-tight mt-6 mb-2'
        : 'text-base font-semibold mt-5 mb-2';

  const inner = (
    <span className="group relative inline-flex items-center gap-1.5">
      {children}
      <button
        type="button"
        onClick={onCopyAnchor}
        aria-label={`Copy link to ${text}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <LinkIcon className="size-3.5" />
      </button>
    </span>
  );

  if (level === 1) return <h1 id={id} className={headingClass}>{inner}</h1>;
  if (level === 2) return <h2 id={id} className={headingClass}>{inner}</h2>;
  return <h3 id={id} className={headingClass}>{inner}</h3>;
}

/* ---------- component overrides ---------- */
const components: Components = {
  code({ className, children, ...props }) {
    // Detect fenced vs inline: react-markdown sets className "language-xxx"
    // on fenced blocks via remark; absence of className means inline.
    const match = /language-([\w-]+)/.exec(className ?? '');
    const isInline = !match;
    if (isInline) {
      return (
        <code
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    const code = String(children).replace(/\n$/, '');
    return <CodeBlock language={match![1] ?? ''} code={code} />;
  },
  // react-markdown wraps fenced code in <pre><code>; we render the whole
  // block ourselves in `code` above, so passthrough <pre> as a fragment.
  pre({ children }) {
    return <>{children}</>;
  },
  h1: ({ children }) => <HeadingAnchor level={1}>{children}</HeadingAnchor>,
  h2: ({ children }) => <HeadingAnchor level={2}>{children}</HeadingAnchor>,
  h3: ({ children }) => <HeadingAnchor level={3}>{children}</HeadingAnchor>,
  a({ href, children, ...props }) {
    const isExternal =
      typeof href === 'string' && /^https?:\/\//i.test(href);
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline decoration-cyan-500/40 hover:decoration-cyan-500 text-cyan-600 dark:text-cyan-400"
          {...props}
        >
          {children}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      );
    }
    return (
      <a
        href={href}
        className="underline decoration-cyan-500/40 hover:decoration-cyan-500 text-cyan-600 dark:text-cyan-400"
        {...props}
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const altText = (alt ?? '').trim();
    return (
      <figure className="my-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={typeof src === 'string' ? src : ''}
          alt={altText}
          loading="lazy"
          className="rounded-lg border border-border max-w-full h-auto"
        />
        {altText && (
          <figcaption className="text-xs text-muted-foreground text-center mt-1">
            {altText}
          </figcaption>
        )}
      </figure>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-4 border-l-4 border-[#ff6b6b] pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-secondary/40">{children}</thead>;
  },
  tr({ children }) {
    return (
      <tr className="border-t border-border odd:bg-transparent even:bg-secondary/20">
        {children}
      </tr>
    );
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="px-3 py-2 align-top">{children}</td>;
  },
  ul({ children }) {
    return <ul className="my-3 ml-5 list-disc space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-3 ml-5 list-decimal space-y-1">{children}</ol>;
  },
  p({ children }) {
    return <p className="my-3 leading-relaxed">{children}</p>;
  },
  hr() {
    return <hr className="my-6 border-border" />;
  },
};

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="max-w-none text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
