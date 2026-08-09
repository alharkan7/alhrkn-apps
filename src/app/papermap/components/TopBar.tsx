'use client';

import { FileText, Plus, MessageSquare, ExternalLink, Menu, Loader2 } from 'lucide-react';
import Downloader from './Downloader';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { AppsHeader } from '@/components/apps-header';
import { useMindMapContext, usePdfViewerContext } from '../context';
import { useRouter } from 'next/navigation';

export default function TopBar() {
  const { loading, error } = useMindMapContext();

  const {
    fileName,
    openPdfViewer,
    sourceUrl: contextSourceUrl,
    inputType: contextInputType,
    isPdfAccessExpired,
    parsedPdfContent: contextParsedPdfContent,
    openArchivedContentViewer
  } = usePdfViewerContext();

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const router = useRouter();

  // Load sourceUrl from context when it mounts, falling back to localStorage
  useEffect(() => {
    if (contextSourceUrl) {
      setSourceUrl(contextSourceUrl);
    } else {
      const lsSourceUrl = localStorage.getItem('sourceUrl');
      setSourceUrl(lsSourceUrl);
    }
  }, [contextSourceUrl]);

  const isUrlType = contextInputType === 'url';
  const isPdfType = contextInputType === 'pdf';
  const isClickable = isPdfType || (isUrlType && !!sourceUrl);
  const isGenerating = loading && (!fileName || fileName === 'Generating...');

  const displayName = isPdfType
    ? (fileName !== 'mindmap' ? fileName : "Example: Steve Jobs' Stanford Commencement Speech")
    : isUrlType && sourceUrl
      ? (fileName || 'Web Content')
      : (fileName || 'Topic Mindmap');

  const handleSourceClick = () => {
    if (isPdfType) {
      if (isPdfAccessExpired) {
        if (contextParsedPdfContent) openArchivedContentViewer();
      } else {
        openPdfViewer(1);
      }
    } else if (isUrlType && sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleNewClick = () => router.push('/papermap');

  // Surface a concise, friendly error inline instead of a raw stack
  const friendlyError = error
    ? error.includes("[GoogleGenerativeAI Error]") && error.includes("exceeds the supported page limit of 1000")
      ? "PDF is too large. Use a document with fewer than 1000 pages."
      : error.includes("[GoogleGenerativeAI Error]")
        ? "AI service unavailable. Please try again later."
        : error.length > 60
          ? `${error.substring(0, 60)}…`
          : error
    : null;

  const SourceIcon = isPdfType ? FileText : isUrlType && sourceUrl ? ExternalLink : MessageSquare;

  const titleNode = friendlyError ? (
    <span
      className="max-w-[44vw] truncate text-sm font-medium text-destructive sm:max-w-[320px]"
      title={error ?? undefined}
    >
      {friendlyError}
    </span>
  ) : (
    <button
      type="button"
      disabled={!isClickable}
      onClick={handleSourceClick}
      title={
        isPdfType
          ? (isPdfAccessExpired ? (contextParsedPdfContent ? 'View archived text' : 'PDF expired') : 'Open source')
          : isUrlType && sourceUrl ? 'Open source in a new tab' : undefined
      }
      className={[
        'group inline-flex min-w-0 max-w-[44vw] items-center gap-2 text-sm font-medium tracking-[-0.01em] sm:max-w-[320px]',
        isClickable
          ? 'cursor-pointer text-[#191918] hover:text-black/70 dark:text-[#f2f2ef] dark:hover:text-white/80'
          : 'cursor-default text-black/55 dark:text-white/50'
      ].join(' ')}
    >
      {isGenerating ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-black/45 dark:text-white/45" />
      ) : (
        <SourceIcon className={[
          'size-4 shrink-0',
          isUrlType && sourceUrl ? 'text-black/55 dark:text-white/55' : ''
        ].join(' ')} />
      )}
      <span className="truncate">{displayName}</span>
    </button>
  );

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
      <AppsHeader
        leftButton={
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
            onClick={() => window.dispatchEvent(new Event('toggleHistorySidebar'))}
            aria-label="Open mindmap history"
          >
            <Menu size={18} />
          </Button>
        }
        title={titleNode}
        rightContent={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-9 rounded-xl border border-black/[0.08] bg-white text-[#191918] hover:bg-black/5 dark:border-white/[0.1] dark:bg-[#20201f] dark:text-[#f2f2ef] dark:hover:bg-[#2a2a29]"
              onClick={handleNewClick}
              title="New mindmap"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Downloader />
          </div>
        }
      />
    </div>
  );
}
