'use client';
import React, { useEffect, useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MindMapProvider, PdfViewerProvider } from '../context';
import { useMindMap } from '../hooks/useMindMap';
import MindMapFlow from '../components/MindMapFlow';
import TopBar from '../components/TopBar';
import PdfViewer from '../components/PdfViewer';
import { MindMapNode } from '../types';
import { ReactFlowProvider } from 'reactflow';
import ArchivedContentViewer from '../components/ArchivedContentViewer';
import { usePdfViewerContext } from '../context';
import { useSearchParams, useRouter } from 'next/navigation';

interface MindmapClientViewProps {
  mindMapNodes: MindMapNode[];
  mindmapTitle: string;
  mindmapInputType: 'pdf' | 'text' | 'url';
  mindmapPdfUrl?: string;
  mindmapSourceUrl?: string;
  mindmapExpiresAt?: string;
  mindmapParsedPdfContent?: string;
  mindmapId?: string;
  isOwner?: boolean;
}

interface MindmapViewLayoutProps {
  mindMap: ReturnType<typeof useMindMap> & { setLoading: (loading: boolean) => void };
  isOwner?: boolean;
  mindmapId?: string;
}

import { toast } from 'sonner';

const MindmapViewLayout: React.FC<MindmapViewLayoutProps> = ({ mindMap, isOwner = true, mindmapId }) => {
  const prefersReducedMotion = useReducedMotion();
  const {
    viewMode,
    closeViewer,
    parsedPdfContent: archivedContent
  } = usePdfViewerContext();

  const handleMakeCopy = async () => {
    if (!mindmapId) return;
    try {
      const res = await fetch(`/api/papermap/${mindmapId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      window.location.href = `/papermap/${data.newId}`;
    } catch (error) {
      console.error('Failed to duplicate mindmap', error);
      toast.error('Failed to copy document. Please try again.');
    }
  };

  const handleInteract = () => {
    if (!isOwner) {
      toast('View Only', {
        description: "You're not the owner of this mindmap.",
        action: {
          label: 'Make Copy',
          onClick: handleMakeCopy
        }
      });
    }
  };

  return (
    <MindMapProvider value={mindMap}>
      <ReactFlowProvider>
        <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
          {/* --- Ambient Background --- */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
            <motion.div
              className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/[0.06] blur-3xl dark:bg-blue-500/[0.07]"
              animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.4, 0.65, 0.4] }}
              transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="relative z-10 flex h-full w-full flex-col pt-14">
            <TopBar />

            {viewMode === 'pdf' && <PdfViewer />}
            {viewMode === 'archived' && archivedContent && (
              <ArchivedContentViewer
                isOpen={true}
                markdownContent={archivedContent}
                onClose={closeViewer}
              />
            )}

            <div className="relative flex-grow" onDoubleClick={handleInteract}>
              {!isOwner && (
                <div 
                  className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-sans font-medium px-3 py-1.5 rounded-full shadow-sm hover:shadow-md cursor-pointer select-none transition-all flex items-center gap-1 z-50" 
                  onClick={handleMakeCopy}
                >
                  <span>View Only</span>
                </div>
              )}
              <MindMapFlow isOwner={isOwner} onInteract={handleInteract} />
            </div>
          </div>
        </div>
      </ReactFlowProvider>
    </MindMapProvider>
  );
};

export default function MindmapClientView({
  mindMapNodes,
  mindmapTitle,
  mindmapInputType,
  mindmapPdfUrl,
  mindmapSourceUrl,
  mindmapExpiresAt,
  mindmapParsedPdfContent,
  mindmapId,
  isOwner = true
}: MindmapClientViewProps) {
  const mindMap = useMindMap() as ReturnType<typeof useMindMap> & { setLoading: (loading: boolean) => void };
  const searchParams = useSearchParams();
  const router = useRouter();
  const isStreaming = searchParams.get('streaming') === 'true';

  const [displayTitle, setDisplayTitle] = useState(mindmapTitle);
  const [nodesLoaded, setNodesLoaded] = useState(mindMapNodes.length > 0);

  // Store stable refs to avoid dependency issues
  const mindMapRef = useRef(mindMap);
  const routerRef = useRef(router);
  mindMapRef.current = mindMap;
  routerRef.current = router;

  // Effect 1: Initialize with provided data
  useEffect(() => {
    if (mindMapNodes && mindMapNodes.length > 0) {
      mindMapRef.current.setMindMapData({ nodes: mindMapNodes });
      mindMapRef.current.setFileName(mindmapTitle || 'Mindmap');
      mindMapRef.current.setLoading(false);
      setDisplayTitle(mindmapTitle);
      setNodesLoaded(true);
    } else if (isStreaming) {
      mindMapRef.current.setMindMapData({ nodes: [] });
      mindMapRef.current.setFileName('Generating...');
      mindMapRef.current.setLoading(true);
    }
  }, [mindMapNodes, mindmapTitle, isStreaming]);

  // Helper function to get appropriate layout index based on screen size/orientation
  const getLayoutIndexForScreen = (): number => {
    if (typeof window === 'undefined') return 1; // Default to TB for SSR

    const isMobileOrPortrait = window.innerWidth < 768 || window.innerHeight > window.innerWidth;
    return isMobileOrPortrait ? 0 : 1; // 0 = LR for mobile/portrait, 1 = TB for desktop/landscape
  };

  // Effect 2: Polling - continues until streaming is complete
  useEffect(() => {
    // Skip if not streaming
    if (!isStreaming || !mindmapId) {
      return;
    }

    let isActive = true;
    let pollCount = 0;
    let lastNodeCount = 0;
    let noChangeCount = 0;
    const maxPolls = 120; // Max 4 minutes at 2s intervals
    const noChangeThreshold = 2; // Stop after 2 polls with no new nodes (~4 seconds)

    const poll = async () => {
      if (!isActive) return;

      try {
        const response = await fetch(`/api/papermap/poll?mindmapId=${mindmapId}&knownCount=${lastNodeCount}`);
        if (!response.ok || !isActive) return;

        const data = await response.json();

        if (data.nodes && data.nodes.length > 0) {
          // Update mindmap with current nodes
          mindMapRef.current.setMindMapData({ nodes: data.nodes });

          // Update title if available
          if (data.title && data.title !== 'Generating...') {
            mindMapRef.current.setFileName(data.title);
            setDisplayTitle(data.title);
          }

          // Hide loader once we have first batch of nodes
          mindMapRef.current.setLoading(false);

          // Check if we got new nodes since last poll
          if (data.nodes.length > lastNodeCount) {
            noChangeCount = 0;
            lastNodeCount = data.nodes.length;
          } else {
            // Only count as "no change" if we've already received nodes
            // This prevents marking complete before streaming even starts
            if (lastNodeCount > 0) {
              noChangeCount++;
            }
          }
        } else {
          // Only count as "no change" if we've already received nodes
          // Don't count initial empty polls before streaming starts
          if (lastNodeCount > 0) {
            noChangeCount++;
          }
        }

        // Stop polling if no changes for threshold polls (streaming complete)
        // This only triggers after we've received at least one node
        if (noChangeCount >= noChangeThreshold && lastNodeCount > 0) {
          isActive = false;
          setNodesLoaded(true);

          // Apply appropriate layout when streaming completes
          // Force layout recalculation by cycling through layouts quickly
          setTimeout(() => {
            // Cycle layout twice to come back to the correct one with recalculation
            if (mindMapRef.current.cycleLayout) {
              mindMapRef.current.cycleLayout();
              // Small delay to let first cycle complete, then cycle back
              setTimeout(() => {
                mindMapRef.current.cycleLayout();
              }, 50);
            }
          }, 500);

          // Remove streaming param from URL
          routerRef.current.replace(`/papermap/${mindmapId}`, { scroll: false });
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls || !isActive) {
        clearInterval(pollInterval);
        mindMapRef.current.setLoading(false);
        setNodesLoaded(true);

        // Apply appropriate layout when polling times out
        // Force layout recalculation by cycling through layouts quickly
        setTimeout(() => {
          // Cycle layout twice to come back to the correct one with recalculation
          if (mindMapRef.current.cycleLayout) {
            mindMapRef.current.cycleLayout();
            // Small delay to let first cycle complete, then cycle back
            setTimeout(() => {
              mindMapRef.current.cycleLayout();
            }, 50);
          }
        }, 500);

        routerRef.current.replace(`/papermap/${mindmapId}`, { scroll: false });
        return;
      }
      await poll();
    }, 2000);

    // First poll immediately
    poll();

    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, [isStreaming, mindmapId]);

  return (
    <PdfViewerProvider
      initialFileName={displayTitle || 'Mindmap'}
      initialPdfUrl={mindmapPdfUrl}
      initialSourceUrl={mindmapSourceUrl}
      initialInputType={mindmapInputType}
      initialExpiresAt={mindmapExpiresAt}
      initialParsedPdfContent={mindmapParsedPdfContent}
    >
      <MindmapViewLayout
        mindMap={mindMap}
        isOwner={isOwner}
        mindmapId={mindmapId}
      />
    </PdfViewerProvider>
  );
}