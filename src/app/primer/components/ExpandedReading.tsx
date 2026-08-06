'use client';

import { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown/MarkdownRenderer';

/**
 * Renders a `primer:expand` block. `raw` is the fenced body: the first line is
 * the title, the remainder is Markdown shown when expanded.
 */
export function ExpandedReading({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false);
  const lines = raw.split('\n');
  const title = lines[0]?.trim() || 'Further reading';
  const body = lines.slice(1).join('\n').trim();

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">{title}</span>
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && body && (
        <div className="border-t border-border/40 px-4 py-3 text-sm text-muted-foreground">
          <MarkdownRenderer>{body}</MarkdownRenderer>
        </div>
      )}
    </div>
  );
}
