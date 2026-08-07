'use client';

import { Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrimerFont } from '../hooks/usePrimerFont';

export function PrimerFontButton() {
  const { font, cycleFont } = usePrimerFont();
  const hint = `Reading font: ${font.label}. Click to switch.`;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-9 px-0 sm:w-auto sm:px-3"
      title={hint}
      aria-label={hint}
      onClick={cycleFont}
    >
      <Type className="h-4 w-4" />
      <span className="hidden sm:inline">{font.label}</span>
    </Button>
  );
}
