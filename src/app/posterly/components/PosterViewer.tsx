'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileCode2, FileImage, LoaderCircle, Menu, Minus, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import type { PosterStatus } from '../types';

interface PosterViewerProps {
  id: string;
  title: string;
  style: string | null;
  status: PosterStatus;
  sourceFileName: string;
  initialUrls: { html?: string; pdf?: string; png?: string };
  errorMessage?: string | null;
}

export function PosterViewer({ id, title, style, status: initialStatus, sourceFileName, initialUrls, errorMessage }: PosterViewerProps) {
  const [status, setStatus] = useState<PosterStatus>(initialStatus);
  const [urls, setUrls] = useState(initialUrls);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (status === 'ready' || status === 'error') return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/posterly/${id}`);
      if (!response.ok) return;
      const data = await response.json();
      setStatus(data.status);
      if (data.urls) setUrls(data.urls);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [id, status]);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="fixed left-0 right-0 top-0 z-50 border-b bg-background/70 backdrop-blur-xl">
        <AppsHeader leftButton={<Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('togglePosterlyHistorySidebar'))}><Menu className="h-5 w-5" /></Button>} title={<span className="hidden sm:inline">Posterly</span>} rightContent={status === 'ready' && <div className="flex items-center gap-1">{urls.pdf && <Button variant="outline" size="sm" asChild><a href={urls.pdf} download={`${title}.pdf`}><Download className="mr-1.5 h-4 w-4" />PDF</a></Button>}{urls.png && <Button variant="default" size="sm" asChild><a href={urls.png} download={`${title}.png`}><FileImage className="mr-1.5 h-4 w-4" />PNG</a></Button>}</div>} />
      </div>

      <main className="flex flex-1 flex-col px-3 pb-14 pt-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Scientific poster · {style || 'minimal'}</p><h1 className="mt-1 line-clamp-2 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1><p className="mt-1 truncate text-sm text-muted-foreground">Source: {sourceFileName}</p></div>
            {status === 'processing' || status === 'pending' ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Building poster…</div> : status === 'error' ? <div className="flex items-center gap-2 text-sm text-red-500"><TriangleAlert className="h-4 w-4" />Generation failed</div> : <div className="flex items-center gap-2">{urls.html && <Button variant="outline" size="sm" asChild><a href={urls.html} target="_blank" rel="noreferrer"><FileCode2 className="mr-1.5 h-4 w-4" />Open HTML</a></Button>}{urls.pdf && <Button variant="outline" size="sm" asChild><a href={urls.pdf} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open PDF</a></Button>}</div>}
          </div>

          {status === 'ready' && (urls.png || urls.html) ? <>
            <div className="relative min-h-[60vh] overflow-auto rounded-2xl border bg-slate-950/95 p-3 shadow-2xl sm:p-6">
              <div className="flex min-h-[58vh] min-w-max items-start justify-center"><>{urls.png ? <img src={urls.png} alt={`Scientific poster: ${title}`} className="h-auto max-w-none origin-top rounded-sm shadow-2xl transition-transform duration-200" style={{ width: `${Math.round(100 * zoom)}%`, minWidth: zoom > 1 ? '900px' : undefined }} /> : urls.html && <iframe title={`HTML preview of ${title}`} src={urls.html} className="h-[70vh] w-full rounded-sm bg-white" />}</></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2"><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="Zoom out"><Minus className="h-4 w-4" /></Button><span className="w-14 text-center text-sm font-medium">{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" onClick={() => setZoom((value) => Math.min(2, value + 0.1))} aria-label="Zoom in"><Plus className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></Button></div><p className="text-xs text-muted-foreground">Landscape 60 × 36 in · generated as standalone HTML/CSS</p></div>
          </> : status === 'error' ? <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center"><TriangleAlert className="mx-auto h-10 w-10 text-red-500" /><h2 className="mt-4 text-lg font-semibold">We couldn’t build this poster</h2><p className="mt-2 text-sm text-muted-foreground">{errorMessage || 'The generation job failed. Please try the paper again.'}</p></div> : <div className="flex min-h-[65vh] items-center justify-center rounded-2xl border bg-muted/20"><div className="text-center"><LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-4 font-medium">Reading the paper and composing the poster</p><p className="mt-1 text-sm text-muted-foreground">This can take a minute for longer PDFs.</p></div></div>}
        </div>
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/70 py-1 text-center text-xs text-muted-foreground backdrop-blur-md"><AppsFooter /></div>
    </div>
  );
}
