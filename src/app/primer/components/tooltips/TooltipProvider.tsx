'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildGlossaryMap } from '../../lib/parse';
import { computeSelectionOccurrence } from '../../lib/occurrence';
import type { GlossaryEntry } from '../../types';
import { TooltipLayer } from './TooltipLayer';
import { SelectionPrompt, type SelectionPromptData } from './SelectionPrompt';

// Behavior constants (from the interactive-textbook SKILL spec).
export const HOVER_OPEN_MS = 300;
export const LOCK_DELAY_MS = 400;
export const DISMISS_GRACE_MS = 250;
export const PRUNE_GRACE_MS = 250;
export const DEPTH_CAP = 5;
export const CORRIDOR_PAD = 18;

export interface ChainEntry {
  id: string;
  term: string;
  anchorEl?: HTMLElement;
  anchorRect?: DOMRect;
  source: 'glossary' | 'selection';
  context?: string;
  /** 0-based occurrence index of the selected phrase (selection source only). */
  occurrence?: number | null;
  /** Full term path from the lesson root down to AND including this entry's term. */
  chainPath: string[];
  locked: boolean;
}

interface TooltipContextValue {
  glossaryMap: Map<string, GlossaryEntry>;
  chain: ChainEntry[];
  primerId: string;
  /** Hover-intent open (respects HOVER_OPEN_MS, depth cap, circular refs). */
  requestOpen: (term: string, anchorEl: HTMLElement, parentChainPath: string[]) => void;
  /** Immediate open + lock (click / Enter / touch). */
  activate: (term: string, anchorEl: HTMLElement, parentChainPath: string[]) => void;
  /** Lock the topmost chain entry anchored at the given element (source-still timer). */
  lockByAnchor: (anchorEl: HTMLElement) => void;
  /** Record a freshly generated selection explanation so it resolves instantly
   *  on re-open and is underlined in the body (via onExplanationSaved). */
  registerExplanation: (term: string, definition: string, occurrence: number | null) => void;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

/**
 * The chain path of the markdown subtree a link lives in. The root lesson sets []
 * and each tooltip card sets its own chainPath, so links inside a card open as
 * children of that card.
 */
export const ChainPathContext = createContext<string[]>([]);

export function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('useTooltip must be used within TooltipProvider');
  return ctx;
}

export function useChainPath(): string[] {
  return useContext(ChainPathContext);
}

function samePath(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.toLowerCase() === b[i].toLowerCase());
}

export function TooltipProvider({
  primerId,
  glossary,
  lessonText,
  onExplanationSaved,
  children,
}: {
  primerId: string;
  glossary: GlossaryEntry[];
  lessonText?: string;
  /** Notified when a selection explanation is generated so the body can underline it live. */
  onExplanationSaved?: (term: string, definition: string, occurrence: number | null) => void;
  children: React.ReactNode;
}) {
  // Live explanations added in-session are folded into the glossary so a re-opened
  // selection resolves instantly and the term behaves like a real glossary entry.
  const [extraGlossary, setExtraGlossary] = useState<GlossaryEntry[]>([]);
  const effectiveGlossary = useMemo(() => [...glossary, ...extraGlossary], [glossary, extraGlossary]);
  const glossaryMap = useMemo(() => buildGlossaryMap(effectiveGlossary), [effectiveGlossary]);

  // Keep the latest callback without forcing the context value to re-memo on parent renders.
  const onExplanationSavedRef = useRef(onExplanationSaved);
  onExplanationSavedRef.current = onExplanationSaved;

  const registerExplanation = useCallback((term: string, definition: string, occurrence: number | null) => {
    const key = term.trim().toLowerCase();
    setExtraGlossary((prev) =>
      prev.some((g) => g.term.trim().toLowerCase() === key)
        ? prev
        : [...prev, { term: term.trim(), definition }],
    );
    onExplanationSavedRef.current?.(term, definition, occurrence);
  }, []);

  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tooltipEls = useRef<Map<string, HTMLElement>>(new Map());
  const idCounter = useRef(0);
  const selectionRootRef = useRef<HTMLDivElement | null>(null);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectionPrompt, setSelectionPrompt] = useState<SelectionPromptData | null>(null);

  const reportTooltipEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) tooltipEls.current.set(id, el);
    else tooltipEls.current.delete(id);
  }, []);

  const openEntry = useCallback(
    (term: string, anchorEl: HTMLElement, parentChainPath: string[], locked: boolean) => {
      const newPath = [...parentChainPath, term];
      const lower = term.toLowerCase();
      setChain((prev) => {
        // Circular reference: term already visible in the chain. Do not open a new card.
        if (prev.some((e) => e.term.toLowerCase() === lower)) return prev;
        // Keep only ancestors of the new entry (drops unrelated branches / deeper children).
        let next = prev.filter(
          (e) => newPath.length > e.chainPath.length && samePath(newPath.slice(0, e.chainPath.length), e.chainPath),
        );
        next.push({ id: `tt-${idCounter.current++}`, term, anchorEl, chainPath: newPath, locked, source: 'glossary' });
        // Depth cap: collapse the oldest ancestor beyond the chain root.
        while (next.length > DEPTH_CAP) next.splice(1, 1);
        return next;
      });
    },
    [],
  );

  const requestOpen = useCallback(
    (term: string, anchorEl: HTMLElement, parentChainPath: string[]) => openEntry(term, anchorEl, parentChainPath, false),
    [openEntry],
  );
  const activate = useCallback(
    (term: string, anchorEl: HTMLElement, parentChainPath: string[]) => openEntry(term, anchorEl, parentChainPath, true),
    [openEntry],
  );

  const lockByAnchor = useCallback((anchorEl: HTMLElement) => {
    setChain((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (e.anchorEl === anchorEl && !e.locked) {
          changed = true;
          return { ...e, locked: true };
        }
        return e;
      });
      return changed ? next : prev;
    });
  }, []);

  const setLocked = useCallback((id: string, locked: boolean) => {
    setChain((prev) => prev.map((e) => (e.id === id ? { ...e, locked } : e)));
  }, []);

  const pruneAfter = useCallback((index: number) => {
    setChain((prev) => (index + 1 >= prev.length ? prev : prev.slice(0, index + 1)));
  }, []);

  const dismissAll = useCallback(() => setChain([]), []);

  const scheduleSelectionPrompt = useCallback(() => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const root = selectionRootRef.current;
    if (!root || !root.contains(range.commonAncestorContainer)) return;

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (!selectedText || selectedText.length > 500) return;
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const anchor = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const markdownRoot = anchor?.closest('.primer-markdown');
    if (!markdownRoot) return;
    const contextBlock = anchor?.closest('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6');
    const context = (contextBlock?.textContent || lessonText || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
    // Pin the exact occurrence so the body can re-underline just this phrase.
    const occurrence = computeSelectionOccurrence(markdownRoot as HTMLElement, selectedText);

    selectionTimer.current = setTimeout(() => setSelectionPrompt({ term: selectedText, rect, context, occurrence }), 220);
  }, [lessonText]);

  useEffect(() => () => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
  }, []);

  useEffect(() => {
    if (!selectionPrompt) return;
    const dismissOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.primer-selection-prompt')) setSelectionPrompt(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectionPrompt(null);
    };
    document.addEventListener('mousedown', dismissOnOutsideClick);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('mousedown', dismissOnOutsideClick);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [selectionPrompt]);

  const confirmSelection = useCallback(() => {
    if (!selectionPrompt) return;
    const { term, rect, context, occurrence } = selectionPrompt;
    setSelectionPrompt(null);
    window.getSelection()?.removeAllRanges();
    setChain([{
      id: `tt-selection-${idCounter.current++}`,
      term,
      anchorRect: rect,
      source: 'selection',
      context,
      occurrence,
      chainPath: [term],
      locked: true,
    }]);
  }, [selectionPrompt]);

  const value = useMemo<TooltipContextValue>(
    () => ({ primerId, glossaryMap, chain, requestOpen, activate, lockByAnchor, registerExplanation }),
    [primerId, glossaryMap, chain, requestOpen, activate, lockByAnchor, registerExplanation],
  );

  return (
    <TooltipContext.Provider value={value}>
      <div ref={selectionRootRef} className="contents" onMouseUp={scheduleSelectionPrompt} onTouchEnd={scheduleSelectionPrompt} onKeyUp={scheduleSelectionPrompt}>
        {children}
      </div>
      {mounted && selectionPrompt && (
        <SelectionPrompt selection={selectionPrompt} onConfirm={confirmSelection} onDismiss={() => setSelectionPrompt(null)} />
      )}
      {mounted && (
        <TooltipLayer
          chain={chain}
          tooltipEls={tooltipEls}
          reportTooltipEl={reportTooltipEl}
          setLocked={setLocked}
          pruneAfter={pruneAfter}
          dismissAll={dismissAll}
          glossaryMap={glossaryMap}
          primerId={primerId}
        />
      )}
    </TooltipContext.Provider>
  );
}
