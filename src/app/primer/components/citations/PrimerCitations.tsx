'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CitationPopover } from './CitationPopover';
import { type BibliographyEntry } from '../../lib/citation-merge';
import type { PrimerCitation, PrimerReference } from '../../types';

interface CiteRequest {
  selection: string;
  rect: DOMRect;
  context: string;
  occurrence: number | null;
}

type Result = { status: 'loading' | 'ready' | 'error'; verdict?: string; references?: PrimerReference[] };

interface PrimerCitationsProps {
  primerId: string;
  /** dedupeKey(reference) -> bibliography entry, forwarded to the popover. */
  refMap: Map<string, BibliographyEntry>;
  onCitationSaved: (citation: PrimerCitation) => void;
}

/**
 * Listens for `openPrimerCite` events (dispatched from the selection chip),
 * runs the cite request (POST, polling on 409), and shows the verdict popover.
 * On success it notifies the parent so the inline marker + bibliography render.
 */
export function PrimerCitations({ primerId, refMap, onCitationSaved }: PrimerCitationsProps) {
  const [active, setActive] = useState<CiteRequest | null>(null);
  const [result, setResult] = useState<Result>({ status: 'loading' });
  const abortRef = useRef<AbortController | null>(null);
  const onSavedRef = useRef(onCitationSaved);
  onSavedRef.current = onCitationSaved;

  const start = useCallback(async (req: CiteRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setActive(req);
    setResult({ status: 'loading' });

    const poll = async (): Promise<any> => {
      for (let attempt = 0; attempt < 80; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        if (controller.signal.aborted) return null;
        const res = await fetch(`/api/primer/${primerId}/cite?selection=${encodeURIComponent(req.selection)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 404) continue;
        if (!res.ok) throw new Error('Could not check citation status');
        const data = await res.json();
        if (data.status === 'ready') return data;
        if (data.status === 'error') throw new Error('Citation failed');
      }
      throw new Error('Citation timed out');
    };

    try {
      const res = await fetch(`/api/primer/${primerId}/cite`, {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection: req.selection, context: req.context, occurrence: req.occurrence }),
      });

      let data: any;
      if (res.status === 409) {
        data = await poll();
      } else if (res.ok) {
        data = await res.json();
      } else {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Citation failed');
      }
      if (!data || data.status !== 'ready') throw new Error('Citation failed');

      const references: PrimerReference[] = Array.isArray(data.references) ? data.references : [];
      setResult({ status: 'ready', verdict: data.verdict || '', references });
      onSavedRef.current({
        // Client-side id keyed by the selection; the parent dedupes on this.
        id: `cite-${req.selection.replace(/\s+/g, ' ').trim().toLowerCase()}`,
        selection: req.selection,
        occurrence: req.occurrence,
        verdict: data.verdict || '',
        references,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('primer cite failed', error);
      setResult({ status: 'error' });
    }
  }, [primerId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Partial<CiteRequest> | undefined;
      if (!detail || typeof detail.selection !== 'string' || !detail.selection.trim() || !detail.rect) return;
      start({
        selection: detail.selection.replace(/\s+/g, ' ').trim(),
        rect: detail.rect,
        context: typeof detail.context === 'string' ? detail.context : '',
        occurrence: typeof detail.occurrence === 'number' ? detail.occurrence : null,
      });
    };
    window.addEventListener('openPrimerCite', handler as EventListener);
    return () => window.removeEventListener('openPrimerCite', handler as EventListener);
  }, [start]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setActive(null);
  }, []);

  if (!active) return null;

  return (
    <CitationPopover
      selection={active.selection}
      rect={active.rect}
      status={result.status}
      verdict={result.verdict}
      references={result.references}
      refMap={refMap}
      onClose={close}
    />
  );
}
