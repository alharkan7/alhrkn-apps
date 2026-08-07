'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { formulaToLatex } from '../../lib/formula-latex';
import { remarkConcepts } from '../../lib/remark-concepts';
import { remarkAutoLinkTerms, type AutoLinkTarget } from '../../lib/remark-autolink-terms';
import { ConceptLinkAnchor } from '../tooltips/ConceptLinkAnchor';
import { WidgetBlock } from '../widgets/WidgetBlock';
import { ExpandedReading } from '../ExpandedReading';

function extractText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return extractText((children as any).props?.children);
  }
  return '';
}

function CodeBlock(props: any) {
  const { className, children } = props;
  const text = extractText(children);
  const match = /language-(.+)$/.exec(className || '');
  const lang = match?.[1];

  if (lang?.startsWith('widget::')) {
    return <WidgetBlock type={lang.slice('widget::'.length)} raw={text} />;
  }
  if (lang === 'primer:expand') {
    return <ExpandedReading raw={text} />;
  }
  if (lang === 'primer:meta') {
    return null; // defensive: stripped from display before rendering
  }
  if (lang) {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
        <code className={`language-${lang} font-mono`}>{text}</code>
      </pre>
    );
  }
  // No language: plain fenced block (multiline) or inline code.
  if (text.includes('\n')) {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
        <code className="font-mono">{text}</code>
      </pre>
    );
  }

  // If the inline code looks like a JS formula leaked from a widget (e.g. contains Math.),
  // try to render it as LaTeX so it looks nice.
  if (text.includes('Math.') && /^[0-9+\-*/%.(),\sxA-Za-z_]+$/.test(text)) {
    const latex = formulaToLatex(text);
    if (latex) {
      try {
        const html = katex.renderToString(latex, { displayMode: false, throwOnError: false });
        if (!html.includes('katex-error')) {
          return <span className="katex-inline-formula" dangerouslySetInnerHTML={{ __html: html }} />;
        }
      } catch {
        // Fallback to plain code block
      }
    }
  }

  return (
    <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

export function MarkdownRenderer({
  children,
  compact = false,
  autoLinkTargets,
}: {
  children: string;
  compact?: boolean;
  /** Exact occurrences of explained phrases to underline as interactive concept links. */
  autoLinkTargets?: AutoLinkTarget[];
}) {
  // remarkAutoLinkTerms runs after remarkConcepts so [[Term]] markers are already
  // converted (and skipped) before we wrap plain-text occurrences. Re-memoize
  // only when the target set changes so react-markdown does not re-parse on every
  // render. The nested tuple is annotated so the plugins array stays assignable
  // to react-markdown's PluggableList.
  const remarkPlugins = useMemo(() => {
    const autolink: [typeof remarkAutoLinkTerms, AutoLinkTarget[]] = [remarkAutoLinkTerms, autoLinkTargets ?? []];
    return [remarkGfm, remarkMath, remarkConcepts, autolink];
  }, [autoLinkTargets]);

  return (
    <div
      className={cn(
        'primer-markdown max-w-none',
        compact ? 'prose prose-sm dark:prose-invert' : 'prose dark:prose-invert',
        'prose-headings:scroll-mt-20 prose-p:leading-relaxed prose-a:font-medium',
        '[&_pre]:my-3 [&_pre]:overflow-x-auto',
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ConceptLinkAnchor,
          pre: ({ children }) => <>{children}</>,
          code: CodeBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
