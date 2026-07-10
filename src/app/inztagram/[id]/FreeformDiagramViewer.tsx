'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import { Plus, Menu } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';
import { SvgArtifact } from '../components/SvgArtifact';
import { FreeformChatPanel } from '../components/FreeformChatPanel';
import type { InztagramMessage } from '../lib/types';
import type { SvgElementSelection } from '../lib/svg-selection';
import {
  buildAttachmentsDisplayMessage,
  buildMultiTargetedEditMessage,
  selectionKey,
} from '../lib/svg-selection';
import { cn } from '@/lib/utils';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';

/** Chat shortcut when SVG preview fails to parse/render. */
export const SVG_AUTO_FIX_MESSAGE =
  'The SVG failed to render in the browser (invalid or malformed markup). Please repair the current SVG so it is valid, well-formed XML that displays correctly. Preserve the intended diagram content, layout, and visual style as much as possible. Fix unclosed tags, bad attributes, broken paths, and any parse errors. Return a complete valid SVG.';

interface FreeformDiagramViewerProps {
  id: string;
  initialSvg: string | null;
  initialMessages: InztagramMessage[];
  initialDescription?: string | null;
  fileName?: string | null;
}

export function FreeformDiagramViewer({
  id,
  initialSvg,
  initialMessages,
  initialDescription,
  fileName,
}: FreeformDiagramViewerProps) {
  const router = useRouter();
  const [svg, setSvg] = useState(initialSvg || '');
  const [messages, setMessages] = useState<InztagramMessage[]>(initialMessages || []);
  const [error, setError] = useState<string | null>(null);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [attachments, setAttachments] = useState<SvgElementSelection[]>([]);

  // Setup streaming
  const { object, submit, isLoading } = useObject({
    api: `/api/inztagram/${id}/stream`,
    schema: z.object({
      svg: z.string(),
      title: z.string().optional(),
      summary: z.string().optional()
    }),
    onFinish: (result) => {
      if (result.object?.svg) {
        setSvg(result.object.svg);
      }
      
      const isInitial = !initialSvg && messages.length === 1;
      let summary = result.object?.summary || 'Updated diagram';
      
      if (isInitial && result.object?.title) {
         summary = `I have generated the diagram: ${result.object.title}`;
      } else if (isInitial) {
         summary = 'Generated diagram';
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: summary, createdAt: new Date().toISOString() }]);
    },
    onError: (e) => {
      setError(e.message || 'Failed to generate diagram');
    }
  });

  const isStreaming = isLoading;
  const displayedSvg = object?.svg || svg;

  // Sync final object state into svg when stream finishes (in case onFinish was skipped or delayed)
  useEffect(() => {
    if (!isStreaming && object?.svg) {
      setSvg(object.svg);
    }
  }, [isStreaming, object]);

  // Trigger initial generation if initialSvg is empty
  const hasTriggeredInitial = useRef(false);
  useEffect(() => {
    if (!initialSvg && !isLoading && (!object || !object.svg) && !hasTriggeredInitial.current) {
       hasTriggeredInitial.current = true;
       submit({ message: '', isInitial: true });
    }
  }, [initialSvg, isLoading, submit, object]);

  // New diagram content → drop stale element attachments
  useEffect(() => {
    setAttachments([]);
  }, [svg]);

  const handleSend = async (
    message: string,
    attachmentOverride?: SvgElementSelection[]
  ) => {
    if (!message.trim() || isStreaming) return;
    setError(null);

    const atts = attachmentOverride ?? attachments;
    const apiMessage =
      atts.length > 0 ? buildMultiTargetedEditMessage(message, atts) : message;
    const displayMessage =
      atts.length > 0 ? buildAttachmentsDisplayMessage(message, atts) : message;

    const optimisticUser: InztagramMessage = {
      role: 'user',
      content: displayMessage,
      createdAt: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticUser]);
    setAttachments([]);
    
    submit({ message: apiMessage, isInitial: false });
  };

  const handleAutoFixSvg = () => {
    if (isStreaming) return;
    setChatMinimized(false);
    void handleSend(SVG_AUTO_FIX_MESSAGE, []);
  };

  const handleAttachmentsChange = useCallback((next: SvgElementSelection[]) => {
    setAttachments(next);
    if (next.length > 0) {
      setChatMinimized(false);
    }
  }, []);

  const handleRemoveAttachment = useCallback((key: string) => {
    setAttachments((prev) => prev.filter((a) => selectionKey(a) !== key));
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>

      <div className="relative z-50 shrink-0 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader
          leftButton={(
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleInztagramHistorySidebar'))}>
                <Menu size={20} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" aria-label="Create new diagram">
                    <Plus className="size-5" /> New
                  </Button>
                </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create New Diagram?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your current diagram stays in history. Start a new freeform or Mermaid diagram.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => router.push('/inztagram')}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
          )}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-[1600px] mx-auto w-full px-2 md:px-4 min-h-0 pb-2 lg:pb-10">
        <div
          className={cn(
            'relative flex-1 flex flex-col gap-2 sm:gap-3 min-h-0 py-2 sm:py-3',
            !chatMinimized && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:gap-4'
          )}
        >
          <div className="flex-1 min-h-[200px] min-w-0 overflow-hidden lg:h-full lg:min-h-0">
            <SvgArtifact
              svg={displayedSvg}
              loading={isStreaming}
              isStreaming={isStreaming}
              fileName={fileName || undefined}
              description={initialDescription || undefined}
              onAutoFix={handleAutoFixSvg}
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
            />
          </div>

          <div
            className={cn(
              'overflow-hidden',
              chatMinimized
                ? 'shrink-0 h-auto w-full lg:absolute lg:right-0 lg:bottom-0 lg:z-20 lg:w-[min(280px,calc(100%-1rem))] lg:max-w-[280px]'
                : 'shrink-0 h-[32dvh] max-h-[280px] min-h-[200px] w-full sm:h-[34dvh] sm:max-h-[300px] lg:h-full lg:max-h-none lg:min-h-0 lg:w-auto lg:max-w-[280px] lg:justify-self-end'
            )}
          >
            <FreeformChatPanel
              messages={messages}
              loading={isStreaming}
              onSend={handleSend}
              error={error}
              minimized={chatMinimized}
              onToggleMinimize={() => setChatMinimized((v) => !v)}
              attachments={attachments}
              onRemoveAttachment={handleRemoveAttachment}
              onClearAttachments={() => setAttachments([])}
            />
          </div>
        </div>
      </div>

      <div className="hidden lg:block relative z-50 shrink-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md border-t">
        <AppsFooter />
      </div>
    </div>
  );
}
