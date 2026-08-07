'use client';

import { useCallback, useEffect, useState } from 'react';

export interface PrimerFontOption {
  key: string;
  label: string;
}

// Five reading typefaces chosen for distinct vibes, so readers of any age can
// pick a feel: Modern (app sans) -> Classic (serif) -> Friendly (rounded) ->
// Easy (accessible) -> Code (mono), then back to Modern.
export const PRIMER_FONTS: PrimerFontOption[] = [
  { key: 'sans', label: 'Modern' },
  { key: 'serif', label: 'Classic' },
  { key: 'rounded', label: 'Friendly' },
  { key: 'lexend', label: 'Easy' },
  { key: 'mono', label: 'Code' },
];

const STORAGE_KEY = 'primer-font';

export function usePrimerFont() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Restore the user's last choice on mount.
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const found = PRIMER_FONTS.findIndex((font) => font.key === stored);
      if (found >= 0) setIndex(found);
    } catch {
      // Ignore storage errors (private mode, disabled storage, etc.).
    }
  }, []);

  // Reflect the active font on <html> so the lesson CSS can react.
  useEffect(() => {
    document.documentElement.setAttribute('data-primer-font', PRIMER_FONTS[index].key);
  }, [index]);

  // Only persist after the initial restore, so we never overwrite a saved
  // preference with the default before reading it back.
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, PRIMER_FONTS[index].key);
    } catch {
      // Ignore.
    }
  }, [index, mounted]);

  const cycleFont = useCallback(() => {
    setIndex((current) => (current + 1) % PRIMER_FONTS.length);
  }, []);

  return { font: PRIMER_FONTS[index], cycleFont, mounted };
}
