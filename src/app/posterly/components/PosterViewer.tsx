'use client';

import Link from 'next/link';
import { type SyntheticEvent, type TouchEvent as ReactTouchEvent, type TouchList as ReactTouchList, type WheelEvent as ReactWheelEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileCode2, FileImage, FileText, LoaderCircle, Menu, Plus, TriangleAlert } from 'lucide-react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PosterStatus } from '../types';

const POSTER_WIDTH = 1600;
const INITIAL_POSTER_HEIGHT = 960;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
type ExportFormat = 'pdf' | 'png' | 'html';

function touchDistance(touches: ReactTouchList): number | null {
  if (touches.length < 2) return null;
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return null;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

interface PosterViewerProps {
  id: string;
  title: string;
  status: PosterStatus;
  initialHtml: string | null;
  initialUrls: { html?: string; pdf?: string; png?: string };
  errorMessage?: string | null;
}

export function PosterViewer({ id, title, status: initialStatus, initialHtml, initialUrls, errorMessage }: PosterViewerProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PosterStatus>(initialStatus);
  const [html, setHtml] = useState(initialHtml || '');
  const [urls, setUrls] = useState(initialUrls);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [previewScale, setPreviewScale] = useState(0.7);
  const [posterHeight, setPosterHeight] = useState(INITIAL_POSTER_HEIGHT);
  const [zoom, setZoom] = useState(1);
  const pinchDistanceRef = useRef<number | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    const updateScale = () => {
      const previewElement = previewRef.current;
      if (!previewElement) return;
      const computedStyle = window.getComputedStyle(previewElement);
      const horizontalPadding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
      const availableWidth = Math.max(320, (previewElement.clientWidth || POSTER_WIDTH) - horizontalPadding);
      setPreviewWidth(availableWidth);
      setPreviewScale(Math.min(1, availableWidth / POSTER_WIDTH));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPosterHeight(INITIAL_POSTER_HEIGHT);
  }, [html]);

  useEffect(() => {
    if (status === 'ready' || status === 'error') return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/posterly/${id}`);
      if (!response.ok) return;
      const data = await response.json();
      setStatus(data.status);
      if (data.html) setHtml(data.html);
      if (data.urls) setUrls(data.urls);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [id, status]);

  const handlePreviewLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const documentElement = event.currentTarget.contentDocument?.documentElement;
    const body = event.currentTarget.contentDocument?.body;
    const measuredHeight = Math.max(documentElement?.scrollHeight || 0, body?.scrollHeight || 0, INITIAL_POSTER_HEIGHT);
    setPosterHeight(measuredHeight);
  };

  const handlePreviewWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    // Preserve normal scrolling; Ctrl/Cmd + wheel follows the standard desktop zoom gesture.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY || event.deltaX;
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value * Math.exp(-delta * 0.002))));
  };

  const handlePreviewTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    pinchDistanceRef.current = touchDistance(event.touches);
  };

  const handlePreviewTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const distance = touchDistance(event.touches);
    const previousDistance = pinchDistanceRef.current;
    if (!distance || !previousDistance) return;
    event.preventDefault();
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value * (distance / previousDistance))));
    pinchDistanceRef.current = distance;
  };

  const handlePreviewTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    pinchDistanceRef.current = touchDistance(event.touches);
  };

  const downloadHtml = () => {
    if (!html) return;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${title || 'scientific-poster'}.html`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const downloadLegacyArtifact = (format: 'pdf' | 'png' | 'html') => {
    const url = urls[format];
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'scientific-poster'}.${format}`;
    link.click();
  };

  const exportFile = async (format: 'pdf' | 'png') => {
    if (!html || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const response = await fetch(`/api/posterly/${id}/export?format=${format}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Failed to export ${format.toUpperCase()}`);
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title || 'scientific-poster'}.${format}`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      setExportError(error?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const handleDownload = (format: ExportFormat) => {
    if (format === 'html') {
      if (html) downloadHtml();
      else downloadLegacyArtifact('html');
      return;
    }
    if (html) {
      void exportFile(format);
    } else {
      downloadLegacyArtifact(format);
    }
  };

  const canDownload = (format: ExportFormat) => Boolean(html || urls[format]);
  const hasPreview = Boolean(html || urls.html || urls.png);
  const scaledPosterWidth = POSTER_WIDTH * previewScale * zoom;
  const posterOverflowsHorizontally = previewWidth > 0 && scaledPosterWidth > previewWidth;
  const downloadMenu = status === 'ready' ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 sm:w-auto sm:px-3"
          disabled={Boolean(exporting)}
          aria-label={exporting ? `Preparing ${exporting.toUpperCase()}` : 'Download poster'}
        >
          {exporting ? <LoaderCircle className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Download className="h-4 w-4 sm:mr-1.5" />}
          <span className="hidden sm:inline">{exporting ? `Preparing ${exporting.toUpperCase()}…` : 'Download'}</span>
          {!exporting && <ChevronDown className="hidden h-4 w-4 sm:inline" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!canDownload('pdf')} onSelect={() => handleDownload('pdf')}><FileText className="h-4 w-4" /> PDF</DropdownMenuItem>
        <DropdownMenuItem disabled={!canDownload('png')} onSelect={() => handleDownload('png')}><FileImage className="h-4 w-4" /> PNG</DropdownMenuItem>
        <DropdownMenuItem disabled={!canDownload('html')} onSelect={() => handleDownload('html')}><FileCode2 className="h-4 w-4" /> HTML</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="fixed left-0 right-0 top-0 z-50 border-b bg-background/70 backdrop-blur-xl">
        <AppsHeader
          leftButton={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="sidebar-toggle h-9 w-9"
                onClick={() => window.dispatchEvent(new Event('togglePosterlyHistorySidebar'))}
                title="History"
                aria-label="History"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href="/posterly">
                  <Plus className="mr-1 h-4 w-4" />
                  New
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      <main className="flex flex-1 flex-col px-3 pb-14 pt-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight sm:text-2xl" title={title}>{title}</h1>
            {status === 'processing' || status === 'pending' ? <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Building poster…</span></div> : status === 'error' ? <div className="flex shrink-0 items-center gap-2 text-sm text-red-500"><TriangleAlert className="h-4 w-4" /><span className="hidden sm:inline">Generation failed</span></div> : <div className="shrink-0">{downloadMenu}</div>}
          </div>

          {status === 'ready' && hasPreview ? <>
            <div
              ref={previewRef}
              className="relative min-h-[65vh] overflow-auto rounded-2xl border bg-slate-950/95 p-3 shadow-2xl sm:p-6"
              style={{ touchAction: 'pan-x pan-y' }}
              onWheel={handlePreviewWheel}
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
              onTouchCancel={handlePreviewTouchEnd}
            >
              <div className={`flex min-h-full min-w-full items-start ${posterOverflowsHorizontally ? 'justify-start' : 'justify-center'}`}>
                {html ? <div className="relative shrink-0" style={{ width: `${POSTER_WIDTH * previewScale * zoom}px`, height: `${posterHeight * previewScale * zoom}px` }}><iframe title={`HTML preview of ${title}`} srcDoc={html} sandbox="allow-same-origin" onLoad={handlePreviewLoad} className="pointer-events-none absolute left-0 top-0 origin-top-left rounded-sm bg-white shadow-2xl" style={{ width: `${POSTER_WIDTH}px`, height: `${posterHeight}px`, transform: `scale(${previewScale * zoom})` }} /></div> : urls.png ? <img src={urls.png} alt={`Scientific poster: ${title}`} className="pointer-events-none h-auto max-w-none origin-top rounded-sm shadow-2xl transition-transform duration-200" style={{ width: `${Math.round(100 * zoom)}%`, minWidth: zoom > 1 ? '900px' : undefined }} /> : urls.html && <iframe title={`HTML preview of ${title}`} src={urls.html} sandbox="allow-same-origin" className="pointer-events-none h-full min-h-[60vh] w-full rounded-sm bg-white" />}
              </div>
            </div>
            {exportError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{exportError}</div>}
          </> : status === 'error' ? <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center"><TriangleAlert className="mx-auto h-10 w-10 text-red-500" /><h2 className="mt-4 text-lg font-semibold">We couldn’t build this poster</h2><p className="mt-2 text-sm text-muted-foreground">{errorMessage || 'The generation job failed. Please try the paper again.'}</p></div> : <div className="flex min-h-[65vh] items-center justify-center rounded-2xl border bg-muted/20"><div className="text-center"><LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-4 font-medium">Reading the paper and composing the poster</p><p className="mt-1 text-sm text-muted-foreground">This can take a minute for longer PDFs.</p></div></div>}
        </div>
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/70 py-1 text-center text-xs text-muted-foreground backdrop-blur-md"><AppsFooter /></div>
    </div>
  );
}
