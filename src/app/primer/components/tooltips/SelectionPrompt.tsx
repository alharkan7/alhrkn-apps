'use client';

import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SelectionPromptData {
  term: string;
  rect: DOMRect;
  context: string;
  occurrence: number | null;
  /** Occurrence computed for citation (link-inclusive) — see computePassageOccurrence. */
  citeOccurrence: number | null;
}

function getPosition(rect: DOMRect): React.CSSProperties {
  if (typeof window === 'undefined') return { top: -9999, left: -9999 };
  const width = 240;
  const height = 38;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - height - 8);
  return { top, left };
}

export function SelectionPrompt({
  selection,
  onConfirm,
  onCite,
  onDismiss,
}: {
  selection: SelectionPromptData;
  onConfirm: () => void;
  onCite: () => void;
  onDismiss: () => void;
}) {
  const [position, setPosition] = useState<React.CSSProperties>(() => getPosition(selection.rect));

  useLayoutEffect(() => {
    setPosition(getPosition(selection.rect));
  }, [selection.rect]);

  return createPortal(
    <div
      className="primer-selection-prompt pointer-events-auto fixed z-[65] flex items-center gap-0.5 rounded-full border bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-md"
      style={position}
      role="status"
      aria-label="Explain or cite selected text?"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
        title={`Explain “${selection.term}”`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onConfirm}
      >
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        Explain?
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
        title={`Find citations for “${selection.term}”`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCite}
      >
        <Quote className="h-3.5 w-3.5 text-primary" />
        Cite
      </Button>
    </div>,
    document.body,
  );
}
