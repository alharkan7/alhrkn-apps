'use client';

import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SelectionPromptData {
  term: string;
  rect: DOMRect;
  context: string;
}

function getPosition(rect: DOMRect): React.CSSProperties {
  if (typeof window === 'undefined') return { top: -9999, left: -9999 };
  const width = 150;
  const height = 38;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - height - 8);
  return { top, left };
}

export function SelectionPrompt({
  selection,
  onConfirm,
  onDismiss,
}: {
  selection: SelectionPromptData;
  onConfirm: () => void;
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
      aria-label="Explain selected text?"
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
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        title="Dismiss"
        aria-label="Dismiss explanation prompt"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>,
    document.body,
  );
}
