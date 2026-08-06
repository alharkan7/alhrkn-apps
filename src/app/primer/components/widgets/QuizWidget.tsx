'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizWidgetProps } from '../../types';

export function QuizWidget({ question, options, answer, explanation }: QuizWidgetProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const safeAnswer = answer >= 0 && answer < options.length ? answer : -1;

  return (
    <div className="my-4 rounded-xl border border-border/60 bg-muted/30 p-4">
      <p className="mb-3 text-sm font-medium text-foreground">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isCorrect = i === safeAnswer;
          const isChosen = i === selected;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setSelected(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                !answered && 'border-border/60 bg-background/50 hover:border-primary/50 hover:bg-background',
                answered && isCorrect && 'border-green-500/60 bg-green-500/10 text-foreground',
                answered && isChosen && !isCorrect && 'border-red-500/60 bg-red-500/10 text-foreground',
                answered && !isCorrect && !isChosen && 'border-border/40 opacity-60',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
                {answered && isCorrect ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : answered && isChosen && !isCorrect ? (
                  <X className="h-3 w-3 text-red-600" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && explanation && (
        <p className="mt-3 rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          {explanation}
        </p>
      )}
      {answered && (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
