'use client';

import { useState } from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToggleWidgetProps } from '../../types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

export function ToggleWidget({ prompt, reveal }: ToggleWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 text-left text-sm font-medium text-foreground"
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1">{prompt}</span>
        <ChevronRight
          className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div className="mt-2 pl-6 text-sm text-muted-foreground">
          <MarkdownRenderer>{reveal}</MarkdownRenderer>
        </div>
      )}
    </div>
  );
}
