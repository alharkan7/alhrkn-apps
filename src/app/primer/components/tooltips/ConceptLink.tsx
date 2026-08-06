'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HOVER_OPEN_MS, LOCK_DELAY_MS, useChainPath, useTooltip } from './TooltipProvider';
import { lookupGlossary } from '../../lib/parse';

/**
 * Inline element for a [[term]] marker. Owns its open/lock timers; the dismissal
 * timers live in the layer. Renders as a plain span when the term has no
 * glossary entry, or as a dashed span when it would create a circular reference.
 */
export const ConceptLink = React.memo(function ConceptLink({ term }: { term: string }) {
  const { glossaryMap, requestOpen, activate, lockByAnchor } = useTooltip();
  const chainPath = useChainPath();

  const ref = useRef<HTMLAnchorElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locking, setLocking] = useState(false);

  const entry = lookupGlossary(glossaryMap, term);
  const isCircular = chainPath.some((t) => t.toLowerCase() === term.toLowerCase());

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    openTimer.current = null;
    lockTimer.current = null;
    setLocking(false);
  };

  const onEnter = () => {
    if (!entry || isCircular) return;
    if (openTimer.current) return;
    openTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      requestOpen(term, el, chainPath);
      // Source-still lock: if the cursor lingers on the source, lock after LOCK_DELAY.
      setLocking(true);
      lockTimer.current = setTimeout(() => {
        lockByAnchor(el);
        setLocking(false);
      }, LOCK_DELAY_MS);
    }, HOVER_OPEN_MS);
  };

  const onLeave = () => clearTimers();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (isCircular) return;
    clearTimers();
    const el = ref.current;
    if (el) activate(term, el, chainPath);
  };

  const onFocus = () => {
    if (!entry || isCircular) return;
    const el = ref.current;
    if (el) {
      requestOpen(term, el, chainPath);
      lockByAnchor(el);
    }
  };

  if (!entry) {
    return (
      <span className="concept-link concept-link--unknown" title={`"${term}" (no glossary entry)`}>
        {term}
      </span>
    );
  }
  if (isCircular) {
    return (
      <span className="concept-link concept-link--circular" title="Already open in this chain">
        {term}
      </span>
    );
  }

  return (
    <a
      ref={ref}
      href={`#primer-concept-${encodeURIComponent(term)}`}
      className="concept-link"
      tabIndex={0}
      aria-haspopup="dialog"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onLeave}
      onTouchEnd={(e) => {
        e.preventDefault();
        const el = ref.current;
        if (el) activate(term, el, chainPath);
      }}
    >
      {term}
      <span className="concept-link__lockbar" style={locking ? { transform: 'scaleX(1)', transitionDuration: `${LOCK_DELAY_MS}ms` } : undefined} />
    </a>
  );
});
