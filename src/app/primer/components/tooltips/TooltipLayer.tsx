'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CORRIDOR_PAD,
  DISMISS_GRACE_MS,
  PRUNE_GRACE_MS,
  type ChainEntry,
} from './TooltipProvider';
import type { GlossaryEntry } from '../../types';
import { TooltipCard } from './TooltipCard';

interface LayerProps {
  chain: ChainEntry[];
  tooltipEls: React.MutableRefObject<Map<string, HTMLElement>>;
  reportTooltipEl: (id: string, el: HTMLElement | null) => void;
  setLocked: (id: string, locked: boolean) => void;
  pruneAfter: (index: number) => void;
  dismissAll: () => void;
  glossaryMap: Map<string, GlossaryEntry>;
  primerId: string;
}

interface Pt {
  x: number;
  y: number;
}

function rectContains(r: DOMRect, p: Pt): boolean {
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

function unionPadded(a: DOMRect, b: DOMRect | null, pad: number): DOMRect {
  const left = Math.min(a.left, b ? b.left : a.left) - pad;
  const right = Math.max(a.right, b ? b.right : a.right) + pad;
  const top = Math.min(a.top, b ? b.top : a.top) - pad;
  const bottom = Math.max(a.bottom, b ? b.bottom : a.bottom) + pad;
  return new DOMRect(left, top, right - left, bottom - top);
}

function getAnchorRect(entry: ChainEntry): DOMRect | null {
  return entry.anchorEl?.getBoundingClientRect() || entry.anchorRect || null;
}

export function TooltipLayer({
  chain,
  tooltipEls,
  reportTooltipEl,
  setLocked,
  pruneAfter,
  dismissAll,
  glossaryMap,
  primerId,
}: LayerProps) {
  const [version, setVersion] = useState(0);
  const cursor = useRef<Pt | null>(null);
  const chainRef = useRef(chain);
  chainRef.current = chain;

  const rafScheduled = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneTarget = useRef<number | null>(null);

  const clearGrace = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    if (pruneTimer.current) {
      clearTimeout(pruneTimer.current);
      pruneTimer.current = null;
      pruneTarget.current = null;
    }
  };

  const armDismiss = () => {
    if (pruneTimer.current) {
      clearTimeout(pruneTimer.current);
      pruneTimer.current = null;
      pruneTarget.current = null;
    }
    if (!dismissTimer.current) {
      dismissTimer.current = setTimeout(() => dismissAll(), DISMISS_GRACE_MS);
    }
  };

  const armPrune = (index: number) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    if (pruneTarget.current !== index) {
      if (pruneTimer.current) clearTimeout(pruneTimer.current);
      pruneTarget.current = index;
      pruneTimer.current = setTimeout(() => {
        pruneAfter(index);
        pruneTarget.current = null;
        pruneTimer.current = null;
      }, PRUNE_GRACE_MS);
    }
  };

  const runCheck = () => {
    rafScheduled.current = false;
    const c = cursor.current;
    const ch = chainRef.current;
    if (!c || ch.length === 0) return;

    let deepest = -1;
    for (let i = 0; i < ch.length; i++) {
      const anchorRect = getAnchorRect(ch[i]);
      if (!anchorRect) continue;
      const tipEl = tooltipEls.current.get(ch[i].id);
      const tipRect = tipEl ? tipEl.getBoundingClientRect() : null;

      // Lock when the cursor enters the tooltip's own bounds.
      if (!ch[i].locked && tipRect && rectContains(tipRect, c)) {
        setLocked(ch[i].id, true);
      }

      if (rectContains(unionPadded(anchorRect, tipRect, CORRIDOR_PAD), c)) {
        deepest = i;
      }
    }

    if (deepest === -1) {
      armDismiss();
    } else if (deepest < ch.length - 1) {
      armPrune(deepest);
    } else {
      clearGrace();
    }
  };

  const scheduleCheck = () => {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(runCheck);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY };
      scheduleCheck();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearGrace();
        dismissAll();
      }
    };
    const onReposition = () => setVersion((v) => v + 1);

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
      clearGrace();
    };
  }, [dismissAll]);

  // Clear grace timers whenever the chain changes (e.g. a new entry opened).
  useEffect(() => {
    clearGrace();
  }, [chain.length]);

  if (chain.length === 0) return null;

  return createPortal(
    <div className="primer-tooltip-layer pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {chain.map((entry, index) => (
        <TooltipCard
          key={entry.id}
          entry={entry}
          glossaryMap={glossaryMap}
          version={version}
          reportTooltipEl={reportTooltipEl}
          primerId={primerId}
          onClose={() => pruneAfter(index - 1)}
        />
      ))}
    </div>,
    document.body,
  );
}
