'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from './tooltips/TooltipProvider';
import { MarkdownRenderer } from './markdown/MarkdownRenderer';
import { DocumentMap } from '@/app/outliner/components/DocumentMap';

import { PrimerBreadcrumbs, type PrimerBreadcrumbItem } from './PrimerBreadcrumbs';
import { PrimerNetworkMap } from './PrimerNetworkMap';
import { PrimerChat } from './chat/PrimerChat';
import { PrimerBibliography } from './PrimerBibliography';
import { PrimerCitations } from './citations/PrimerCitations';
import { buildCitations, dedupeKey } from '../lib/citation-merge';
import { getDisplayBody, parseMeta, type AutoLinkTarget } from '../lib/parse';
import type { GlossaryEntry, PrimerCitation } from '../types';

export interface PrimerLessonViewProps {
  id: string;
  title: string | null;
  topic: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  content: string | null;
  glossary: GlossaryEntry[] | null;
  /** Exact occurrences of user-explained phrases to underline in the body. */
  autoLinkTargets?: AutoLinkTarget[];
  createdAt: string | null;
  breadcrumbs: PrimerBreadcrumbItem[];
  initialCitations?: PrimerCitation[];
}

type Phase = 'streaming' | 'waiting' | 'error';

const GENERATION_TIMEOUT_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 1500;

export function PrimerLessonView(props: PrimerLessonViewProps) {
  const { id, title, topic, content: initialContent, glossary: initialGlossary, status: initialStatus, autoLinkTargets: initialAutoLinkTargets, breadcrumbs, initialCitations } = props;

  const [streamed, setStreamed] = useState('');
  const [phase, setPhase] = useState<Phase>(initialStatus === 'error' ? 'error' : 'streaming');
  const [retryCount, setRetryCount] = useState(0);
  const [polledContent, setPolledContent] = useState<string | null>(null);
  const [polledGlossary, setPolledGlossary] = useState<GlossaryEntry[] | null>(null);
  // Occurrences underlined in the body. Seeded from the server-merged explanations
  // and extended live when a new selection is explained in this session.
  const [liveTargets, setLiveTargets] = useState<AutoLinkTarget[]>(initialAutoLinkTargets ?? []);
  // Cited passages: seeded from the server, extended live when a passage is cited.
  const [citations, setCitations] = useState<PrimerCitation[]>(initialCitations ?? []);

  const handleExplanationSaved = useCallback((term: string, _definition: string, occurrence: number | null) => {
    if (occurrence == null) return;
    const key = term.trim().toLowerCase();
    setLiveTargets((prev) => {
      const existing = prev.findIndex((t) => t.term.trim().toLowerCase() === key);
      if (existing >= 0) {
        // Same term, possibly a different occurrence the reader re-selected.
        if (prev[existing].occurrence === occurrence) return prev;
        const next = prev.slice();
        next[existing] = { term, occurrence };
        return next;
      }
      return [...prev, { term, occurrence }];
    });
  }, []);

  const handleCitationSaved = useCallback((citation: PrimerCitation) => {
    const key = citation.selection.replace(/\s+/g, ' ').trim().toLowerCase();
    setCitations((prev) => {
      const filtered = prev.filter((c) => c.selection.replace(/\s+/g, ' ').trim().toLowerCase() !== key);
      return [...filtered, citation];
    });
  }, []);

  // Number/dedupe references and derive inline-marker targets + a ref->entry map
  // (the map lets the verdict popover label its [n] anchors correctly).
  const builtCitations = useMemo(() => buildCitations(citations), [citations]);
  const refMap = useMemo(
    () => new Map(builtCitations.bibliography.map((entry) => [dedupeKey(entry.ref), entry])),
    [builtCitations],
  );

  useEffect(() => {
    // Nothing to do if the lesson is already persisted. An errored lesson is
    // intentionally idle until the user explicitly retries it.
    if (initialContent || (initialStatus === 'error' && retryCount === 0)) return;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const pollForResult = async () => {
      const deadline = Date.now() + GENERATION_TIMEOUT_MS;
      while (active && Date.now() < deadline) {
        await wait(POLL_INTERVAL_MS);
        if (!active) return;

        const statusRes = await fetch(`/api/primer/${id}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!statusRes.ok) throw new Error('Could not check lesson status');
        const statusData = await statusRes.json();

        if (statusData.status === 'error') throw new Error('Lesson generation failed');
        if (statusData.status === 'ready' && statusData.content) {
          setPolledContent(statusData.content);
          setPolledGlossary(statusData.glossary ?? []);
          setPhase('streaming');
          return;
        }
        if (statusData.status === 'ready') throw new Error('Lesson is marked ready but has no content');
      }
      throw new Error('Lesson generation timed out. Please try again.');
    };

    (async () => {
      try {
        setPhase('streaming');
        timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
        const res = await fetch(`/api/primer/${id}/generate`, {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (res.status === 409) {
          // Another tab may own the stream. Wait for the saved result, but never
          // leave the reader in a permanent spinner if that job has died.
          setPhase('waiting');
          await pollForResult();
          return;
        }
        if (!res.ok || !res.body) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.error || 'Generation failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        let lastFlush = 0;
        // toTextStreamResponse() emits raw text deltas: append directly, throttle renders.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (now - lastFlush > 100) {
            setStreamed(acc);
            lastFlush = now;
          }
        }
        acc += decoder.decode();
        if (!acc.trim()) throw new Error('Lesson generation returned no content');
        setStreamed(acc);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          if (active) setPhase('error');
          return;
        }
        console.error('primer stream failed', e);
        setPhase('error');
      }
    })();

    return () => {
      active = false;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, initialContent, initialStatus, retryCount]);

  const savedContent = initialContent || polledContent;
  const showSaved = !!savedContent;
  const bodyText = showSaved ? savedContent! : getDisplayBody(streamed);
  const glossary: GlossaryEntry[] = showSaved
    ? initialContent
      ? initialGlossary ?? []
      : polledGlossary ?? []
    : parseMeta(streamed).glossary;

  // Context for the in-lesson chat: the lesson title plus a compact excerpt of
  // the body (concept-link markers stripped to their bare term).
  const chatTitle = title || topic;
  const chatExcerpt = bodyText
    ? bodyText.slice(0, 1000).replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 700)
    : undefined;

  // Body for rendering: drop a trailing thematic break (the model often emits
  // "---" before the primer:meta block, which survives getDisplayBody and would
  // duplicate the bibliography's own separator).
  const renderBody = bodyText
    ? bodyText.replace(/\s+$/, '').replace(/\n+(-{3,}|\*{3,}|_{3,})$/, '').replace(/\s+$/, '\n')
    : bodyText;

  const showGenerating = !showSaved && !streamed && phase !== 'error';
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    const openMap = () => setMapOpen(true);
    window.addEventListener('openPrimerNetworkMap', openMap);
    return () => window.removeEventListener('openPrimerNetworkMap', openMap);
  }, []);

  return (
    <TooltipProvider primerId={id} glossary={glossary} lessonText={bodyText} onExplanationSaved={handleExplanationSaved}>
      <div id="document-wrapper">
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PrimerBreadcrumbs items={breadcrumbs} />
        {phase === 'error' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm text-muted-foreground">
              This lesson could not be generated. Please try again.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setStreamed('');
              setPolledContent(null);
              setPolledGlossary(null);
              setPhase('streaming');
              setRetryCount((count) => count + 1);
            }}>
              Try again
            </Button>
          </div>
        ) : phase === 'waiting' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lesson is generating…</p>
          </div>
        ) : showGenerating ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Writing your lesson on “{topic}”…</p>
          </div>
        ) : (
          <MarkdownRenderer autoLinkTargets={liveTargets} citationTargets={builtCitations.citationTargets}>{renderBody}</MarkdownRenderer>
        )}
      </article>
      <PrimerBibliography entries={builtCitations.bibliography} />
      </div>
      <PrimerNetworkMap primerId={id} open={mapOpen} onOpenChange={setMapOpen} />
      <PrimerChat title={chatTitle} topic={topic} excerpt={chatExcerpt} />
      <PrimerCitations primerId={id} refMap={refMap} onCitationSaved={handleCitationSaved} />
      <DocumentMap containerId="document-wrapper" />
    </TooltipProvider>
  );
}
