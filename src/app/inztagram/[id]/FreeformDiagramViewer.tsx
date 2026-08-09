'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
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
import { PlayfulLoader } from '../components/PlayfulLoader';
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
  initialVersions?: { svgCode: string | null, createdAt: Date }[];
  isOwner?: boolean;
}

import { toast } from 'sonner';

export function FreeformDiagramViewer({
  id,
  initialSvg,
  initialMessages,
  initialDescription,
  fileName,
  initialVersions,
  isOwner = true,
}: FreeformDiagramViewerProps) {
  const router = useRouter();
  const [svg, setSvg] = useState(initialSvg || '');
  const [messages, setMessages] = useState<InztagramMessage[]>(initialMessages || []);
  const [error, setError] = useState<string | null>(null);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [attachments, setAttachments] = useState<SvgElementSelection[]>([]);
  const [versions, setVersions] = useState<{svgCode: string | null, createdAt: Date}[]>(
    initialVersions && initialVersions.length > 0
      ? initialVersions
      : (initialSvg ? [{ svgCode: initialSvg, createdAt: new Date() }] : [])
  );
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [hasAutoImproved, setHasAutoImproved] = useState(false);
  const [isGeneratingSync, setIsGeneratingSync] = useState(false);

  const handleMakeCopy = async () => {
    try {
      const res = await fetch(`/api/inztagram/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      window.location.href = `/inztagram/${data.newId}`;
    } catch (error) {
      console.error('Failed to duplicate diagram', error);
      toast.error('Failed to copy document. Please try again.');
    }
  };

  const handleInteract = (e?: React.SyntheticEvent | Event) => {
    if (!isOwner) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      toast('View Only', {
        description: "You're not the owner of this diagram.",
        action: {
          label: 'Make Copy',
          onClick: handleMakeCopy
        }
      });
      return false;
    }
    return true;
  };

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
        setVersions(prev => [{ svgCode: result.object!.svg, createdAt: new Date() }, ...prev]);
        setCurrentVersionIndex(0);
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
  const displayedSvg = (isStreaming && object?.svg) ? object.svg : (versions[currentVersionIndex]?.svgCode || svg);

  // Sync final object state into svg when stream finishes (in case onFinish was skipped or delayed)
  useEffect(() => {
    if (!isStreaming && object?.svg) {
      setSvg(object.svg);
    }
  }, [isStreaming, object]);

  // Trigger initial generation if initialSvg is empty
  const hasTriggeredInitial = useRef(false);
  useEffect(() => {
    if (!initialSvg && !isLoading && !isGeneratingSync && (!object || !object.svg) && !hasTriggeredInitial.current && !svg) {
       hasTriggeredInitial.current = true;
       const useStream = process.env.NEXT_PUBLIC_DISABLE_FREEFORM_STREAM !== 'true';
       if (useStream) {
         submit({ message: '', isInitial: true });
       } else {
         setIsGeneratingSync(true);
         fetch(`/api/inztagram/${id}/generate`, { method: 'POST' })
           .then(res => res.json())
           .then(data => {
              if (data.svg) {
                setSvg(data.svg);
                setVersions(prev => [{ svgCode: data.svg, createdAt: new Date() }, ...prev]);
                setCurrentVersionIndex(0);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Generated diagram', createdAt: new Date().toISOString() }]);
              } else if (data.error) {
                setError(data.error);
              }
           })
           .catch(e => setError(e.message || 'Failed to generate diagram'))
           .finally(() => setIsGeneratingSync(false));
       }
    }
  }, [initialSvg, isLoading, isGeneratingSync, submit, object, id, svg]);

  // New diagram content → drop stale element attachments
  useEffect(() => {
    setAttachments([]);
  }, [svg]);

  const handleSend = async (
    message: string,
    attachmentOverride?: SvgElementSelection[]
  ) => {
    if (!handleInteract()) return;
    if (!message.trim() || isStreaming) return;
    setError(null);

    let isAutoImprove = false;
    try {
      const parsed = JSON.parse(message);
      if (parsed.action === 'auto_improve') isAutoImprove = true;
    } catch(e){}

    const atts = attachmentOverride ?? attachments;
    const apiMessage =
      (atts.length > 0 && !isAutoImprove) ? buildMultiTargetedEditMessage(message, atts) : message;
    const displayMessage = isAutoImprove
      ? "Auto Improve Diagram"
      : (atts.length > 0 ? buildAttachmentsDisplayMessage(message, atts) : message);

    const optimisticUser: InztagramMessage = {
      role: 'user',
      content: displayMessage,
      createdAt: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticUser]);
    setAttachments([]);
    const useStream = process.env.NEXT_PUBLIC_DISABLE_FREEFORM_STREAM !== 'true';
    if (useStream) {
      submit({ message: apiMessage, isInitial: false });
    } else {
      setIsGeneratingSync(true);
      fetch(`/api/inztagram/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: apiMessage })
      })
      .then(res => res.json())
      .then(data => {
         if (data.svg) {
           setSvg(data.svg);
           setVersions(prev => [{ svgCode: data.svg, createdAt: new Date() }, ...prev]);
           setCurrentVersionIndex(0);
           setMessages(data.messages || []);
         } else if (data.error) {
           setError(data.error);
         }
      })
      .catch(e => setError(e.message || 'Failed to edit diagram'))
      .finally(() => setIsGeneratingSync(false));
    }
  };

  const handleAutoFixSvg = () => {
    if (!handleInteract()) return;
    if (isStreaming) return;
    setChatMinimized(false);
    void handleSend(SVG_AUTO_FIX_MESSAGE, []);
  };

  const handleAutoImprove = useCallback((dataUrl: string) => {
    if (!handleInteract()) return;
    if (isStreaming) return;
    setHasAutoImproved(true);
    setChatMinimized(false);
    const payload = JSON.stringify({ action: 'auto_improve', image: dataUrl });
    void handleSend(payload);
  }, [isStreaming, handleSend]);

  const handleAttachmentsChange = useCallback((next: SvgElementSelection[]) => {
    if (next.length > 0 && !isOwner) {
      handleInteract();
      return;
    }
    setAttachments(next);
    if (next.length > 0) {
      setChatMinimized(false);
    }
  }, [isOwner]);

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
                  <Button variant="ghost" className="px-2 text-sm font-semibold tracking-[-0.01em]" aria-label="Create new diagram">
                    Inztagram
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

      <div className={cn('relative z-10 mx-auto flex w-full flex-1 flex-col px-2 md:px-4 min-h-0 pb-2 lg:pb-10', chatMinimized ? 'max-w-6xl' : 'max-w-[1600px]')}>
        <div
          className={cn(
            'relative flex-1 flex flex-col gap-2 sm:gap-3 min-h-0 py-2 sm:py-3',
            !chatMinimized && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:gap-4'
          )}
        >
          <div className="flex-1 min-h-[200px] min-w-0 overflow-hidden lg:h-full lg:min-h-0">
            {isGeneratingSync ? (
              <div className="w-full h-full border rounded-xl shadow-lg bg-card overflow-hidden">
                <PlayfulLoader />
              </div>
            ) : (
              <div className="relative w-full h-full">
                {!isOwner && (
                  <div 
                    className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-sans font-medium px-3 py-1.5 rounded-full shadow-sm hover:shadow-md cursor-pointer select-none transition-all flex items-center gap-1 z-50" 
                    onClick={handleMakeCopy}
                  >
                    <span>View Only</span>
                  </div>
                )}
                <SvgArtifact
                  svg={displayedSvg}
                  loading={isStreaming}
                  isStreaming={isStreaming}
                  fileName={fileName || undefined}
                  description={initialDescription || undefined}
                  onAutoFix={handleAutoFixSvg}
                  showEditButton={chatMinimized}
                  onEdit={() => setChatMinimized(false)}
                  attachments={attachments}
                  onAttachmentsChange={handleAttachmentsChange}
                  hasPrevious={currentVersionIndex < versions.length - 1}
                  hasNext={currentVersionIndex > 0}
                  onPreviousVersion={() => setCurrentVersionIndex(i => Math.min(i + 1, versions.length - 1))}
                  onNextVersion={() => setCurrentVersionIndex(i => Math.max(i - 1, 0))}
                  showAutoImprove={versions.length <= 1 && !hasAutoImproved && !isStreaming && !!displayedSvg}
                  onAutoImprove={handleAutoImprove}
                  onLocalSave={async (newSvg) => {
                    if (!handleInteract()) return;
                    try {
                      const res = await fetch(`/api/inztagram/${id}/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ svg: newSvg }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.svg) {
                          setSvg(data.svg);
                          setVersions(prev => [{ svgCode: data.svg, createdAt: new Date() }, ...prev]);
                          setCurrentVersionIndex(0);
                        }
                      }
                    } catch (e) {
                      console.error('Error saving local edits:', e);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {!chatMinimized && (
            <div className="shrink-0 h-[32dvh] max-h-[280px] min-h-[200px] w-full overflow-hidden sm:h-[34dvh] sm:max-h-[300px] lg:h-full lg:max-h-none lg:min-h-0 lg:w-auto lg:max-w-[280px] lg:justify-self-end">
              <FreeformChatPanel
                messages={messages}
                loading={isStreaming}
                onSend={handleSend}
                error={error}
                minimized={false}
                onToggleMinimize={() => setChatMinimized(true)}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                onClearAttachments={() => setAttachments([])}
                onInteract={handleInteract}
              />
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block relative z-50 shrink-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md border-t">
        <AppsFooter />
      </div>
    </div>
  );
}
