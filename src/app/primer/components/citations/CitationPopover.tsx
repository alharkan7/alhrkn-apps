'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { formatApa } from '@/lib/citation-format';
import { dedupeKey, type BibliographyEntry } from '../../lib/citation-merge';
import type { PrimerReference } from '../../types';

interface Pos {
  top: number;
  left: number;
}

const MAX_WIDTH = 380;
const GAP = 10;

function choosePosition(anchor: DOMRect, w: number, h: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(w || MAX_WIDTH, vw - 16);
  let left: number;
  if (anchor.right + GAP + width <= vw - 8) {
    left = anchor.right + GAP;
  } else if (anchor.left - GAP - width >= 8) {
    left = anchor.left - GAP - width;
  } else {
    left = Math.max(8, Math.min(anchor.right + GAP, vw - 8 - width));
  }
  let top = anchor.top;
  if (top + h > vh - 8) top = vh - 8 - h;
  if (top < 8) top = 8;
  return { top, left };
}

function doiHref(doi?: string): string | undefined {
  if (!doi) return undefined;
  return `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
}

function scrollToRef(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('citation-ref--flash');
  window.setTimeout(() => el.classList.remove('citation-ref--flash'), 1600);
}

interface CitationPopoverProps {
  selection: string;
  rect: DOMRect;
  status: 'loading' | 'ready' | 'error';
  verdict?: string;
  references?: PrimerReference[];
  /** dedupeKey(reference) -> bibliography entry, so anchors show the right [n]. */
  refMap: Map<string, BibliographyEntry>;
  onClose: () => void;
}

/**
 * Transient popover shown when a reader clicks "Cite": loading, then the LLM
 * verdict with [n] anchors that smooth-scroll to the References section.
 * Fixed-positioned near the selection rect; dismissible via X, Escape, or
 * outside click.
 */
export function CitationPopover({ selection, rect, status, verdict, references, refMap, onClose }: CitationPopoverProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>({ top: -9999, left: -9999 });

  const reposition = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    setPos(choosePosition(rect, el.offsetWidth, el.offsetHeight));
  }, [rect]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, status, verdict]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => reposition());
    obs.observe(el);
    const onResize = () => reposition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.primer-citation-popover')) onClose();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [reposition, onClose]);

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Citation verdict"
      className="primer-citation-popover pointer-events-auto fixed z-[70] w-max max-w-[380px] overflow-hidden rounded-xl border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex-1 truncate">Citation check</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1.5 text-muted-foreground hover:bg-muted" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto px-3 py-2 text-sm">
        {selection ? (
          <p className="mb-2 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">{selection}</p>
        ) : null}
        {status === 'loading' ? (
          <div className="flex items-center gap-2 py-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Finding sources and verifying…</span>
          </div>
        ) : status === 'error' ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span>Couldn&rsquo;t verify this passage. Try again.</span>
          </div>
        ) : (
          <>
            <div className="primer-tooltip__body">
              <MarkdownRenderer compact>{verdict || 'No verdict available.'}</MarkdownRenderer>
            </div>
            {references && references.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1.5 border-t border-border/50 pt-2">
                {references.map((ref, i) => {
                  const entry = refMap.get(dedupeKey(ref));
                  const anchorId = entry?.anchorId;
                  const num = entry?.num ?? i + 1;
                  const link = doiHref(ref.doi) || ref.url;
                  return (
                    <div key={`${num}-${i}`} className="flex gap-2 text-xs leading-relaxed">
                      {anchorId ? (
                        <button
                          type="button"
                          onClick={() => scrollToRef(anchorId)}
                          className="shrink-0 font-semibold text-primary hover:underline"
                          title="Jump to reference"
                        >
                          [{num}]
                        </button>
                      ) : (
                        <span className="shrink-0 font-semibold text-muted-foreground">[{num}]</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground/90">{formatApa(ref)}</span>
                        {link ? (
                          <>
                            {' '}
                            <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                              {ref.doi ? 'DOI' : 'Link'}
                            </a>
                          </>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
