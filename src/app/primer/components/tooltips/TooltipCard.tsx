'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, Pin, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChainPathContext, useTooltip, type ChainEntry } from './TooltipProvider';
import { lookupGlossary } from '../../lib/parse';
import type { GlossaryEntry } from '../../types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

const MAX_WIDTH = 340;
const GAP = 10;

interface Pos {
  top: number;
  left: number;
}

function choosePosition(anchor: DOMRect, size: { width: number; height: number }): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(size.width || MAX_WIDTH, vw - 16);
  const h = size.height || 0;

  let left: number;
  // Prefer to the right of the anchor; flip left if it overflows.
  if (anchor.right + GAP + w <= vw - 8) {
    left = anchor.right + GAP;
  } else if (anchor.left - GAP - w >= 8) {
    left = anchor.left - GAP - w;
  } else {
    left = Math.max(8, Math.min(anchor.right + GAP, vw - 8 - w));
  }

  let top: number;
  // Vertically align near the anchor's top, clamp into the viewport.
  top = anchor.top;
  if (top + h > vh - 8) top = vh - 8 - h;
  if (top < 8) top = 8;

  return { top, left };
}

export function TooltipCard({
  entry,
  glossaryMap,
  version,
  reportTooltipEl,
  primerId,
  onClose,
}: {
  entry: ChainEntry;
  glossaryMap: Map<string, GlossaryEntry>;
  version: number;
  reportTooltipEl: (id: string, el: HTMLElement | null) => void;
  primerId: string;
  onClose: () => void;
}) {
  const def = lookupGlossary(glossaryMap, entry.term);
  const { registerExplanation } = useTooltip();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>({ top: -9999, left: -9999 });
  const [explanation, setExplanation] = useState<{ status: 'loading' | 'ready' | 'error'; description?: string }>({ status: entry.source === 'selection' && !def ? 'loading' : 'ready' });
  const [retry, setRetry] = useState(0);
  const [learnMoreLoading, setLearnMoreLoading] = useState(false);
  const [learnMoreError, setLearnMoreError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (entry.source !== 'selection' || def) return;
    const controller = new AbortController();
    let active = true;

    const poll = async () => {
      for (let attempt = 0; attempt < 80; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!active) return null;
        const response = await fetch(`/api/primer/${primerId}/explain?selection=${encodeURIComponent(entry.term)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.status === 404) continue;
        if (!response.ok) throw new Error('Could not check explanation status');
        const data = await response.json();
        if (data.status === 'ready' && data.description) return data.description as string;
        if (data.status === 'error') throw new Error('Explanation failed');
      }
      throw new Error('Explanation timed out');
    };

    (async () => {
      try {
        const response = await fetch(`/api/primer/${primerId}/explain`, {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selection: entry.term, context: entry.context, occurrence: entry.occurrence ?? null }),
        });
        const data = response.status === 409
          ? await poll()
          : response.ok
            ? (await response.json()).description
            : null;
        if (!response.ok && response.status !== 409) throw new Error('Explanation failed');
        if (!data) throw new Error('Explanation returned no content');
        if (active) {
          setExplanation({ status: 'ready', description: data });
          registerExplanation(entry.term, data, entry.occurrence ?? null);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && active) setExplanation({ status: 'error' });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [def, entry.context, entry.source, entry.term, primerId, retry, registerExplanation]);

  const handleLearnMore = async () => {
    setLearnMoreLoading(true);
    setLearnMoreError(null);
    try {
      const response = await fetch('/api/primer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: entry.term,
          parentId: primerId,
          options: entry.context ? { context: entry.context } : {},
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Could not create lesson');
      router.push(`/primer/${data.id}`);
    } catch (error: any) {
      setLearnMoreError(error?.message || 'Could not create lesson');
      setLearnMoreLoading(false);
    }
  };

  // Recompute the card position from the live anchor rect and the card's current
  // size. Invoked on mount/scroll/resize (via `version`) and whenever the card
  // resizes (e.g. when a selection explanation replaces the loading spinner),
  // so a card that grew after being positioned never overflows the viewport.
  const reposition = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const anchorRect = entry.anchorEl?.getBoundingClientRect() || entry.anchorRect;
    if (!anchorRect) return;
    setPos(choosePosition(anchorRect, { width: el.offsetWidth, height: el.offsetHeight }));
  }, [entry.anchorEl, entry.anchorRect]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, entry.id, version]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => reposition());
    observer.observe(el);
    return () => observer.disconnect();
  }, [reposition]);

  return (
    <div
      ref={(el) => {
        cardRef.current = el;
        reportTooltipEl(entry.id, el);
      }}
      role="dialog"
      aria-label={entry.term}
      className={cn(
        'primer-tooltip absolute max-h-[60vh] w-max max-w-[340px] overflow-y-auto rounded-xl border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md',
        entry.locked ? 'pointer-events-auto primer-tooltip--locked' : 'pointer-events-none primer-tooltip--open',
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {entry.locked && <Pin className="h-3 w-3 text-primary" />}
        <span className="truncate flex-1">{entry.term}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 -mr-1.5 text-muted-foreground hover:bg-muted"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ChainPathContext.Provider value={entry.chainPath}>
        <div className="primer-tooltip__body px-3 py-2 text-sm">
          {entry.source === 'selection' && !def && explanation.status === 'loading' ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Explaining this selection…</span>
            </div>
          ) : entry.source === 'selection' && !def && explanation.status === 'error' ? (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground">Couldn’t explain this selection.</span>
              <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => {
                setExplanation({ status: 'loading' });
                setRetry((value) => value + 1);
              }}>
                Try again
              </Button>
            </div>
          ) : def ? (
            <MarkdownRenderer compact>{def.definition}</MarkdownRenderer>
          ) : (
            <MarkdownRenderer compact>{explanation.description || 'No definition available.'}</MarkdownRenderer>
          )}
        </div>
        <div className="flex flex-col gap-1 border-t border-border/50 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full justify-center gap-1.5"
            disabled={learnMoreLoading}
            onClick={handleLearnMore}
          >
            {learnMoreLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {learnMoreLoading ? 'Preparing lesson…' : 'Learn more'}
          </Button>
          {learnMoreError && <span className="text-xs text-destructive">{learnMoreError}</span>}
        </div>
      </ChainPathContext.Provider>
    </div>
  );
}
