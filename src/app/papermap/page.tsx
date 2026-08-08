'use client';

import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

import InputForm from './components/InputForm';
import { useMindMap } from './hooks/useMindMap';
import { AppsHeader } from '@/components/apps-header'
import AppsFooter from '@/components/apps-footer'
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaperMap() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  // State to track the current input type (pdf or text)
  const [inputType, setInputType] = useState<'pdf' | 'text' | null>(null);
  // Local error state for input validation
  const [inputError, setInputError] = useState<string | null>(null);

  // Add cleanup on page unload/refresh
  useEffect(() => {
    // Function to clean up session when page is closed/refreshed
    const cleanupSession = async () => {
      try {
        const sessionId = localStorage.getItem('currentSessionId');
        if (sessionId) {
          // Use sendBeacon for reliable delivery during page unload
          const data = JSON.stringify({
            sessionId,
            cleanupSession: true
          });

          // Try to use sendBeacon first (most reliable during page unload)
          if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/api/papermap', blob);
          } else {
            // Fall back to fetch with keepalive
            fetch('/api/papermap', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: data,
              keepalive: true
            }).catch(e => console.error('Error sending cleanup request:', e));
          }
        }
      } catch (error) {
        console.error('Failed to send cleanup request:', error);
      }
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', cleanupSession);

    // Return cleanup function
    return () => {
      window.removeEventListener('beforeunload', cleanupSession);
      cleanupSession(); // Also clean up when component unmounts
    };
  }, []);

  // Get all the mindmap related state and functions from the hook
  const {
    loading,
    loadingStage,
    error,
    handleFileUpload,
    handleTextInput,
    handleFileUploadStreaming,
    handleTextInputStreaming,
    handleFileUploadRealtime,
    handleTextInputRealtime,
    loadExampleMindMap,
  } = useMindMap();

  // Use combined error from multiple sources
  const combinedError = inputError || error || null;

  // Handler for example badge click
  const handleExampleClick = useCallback(() => {
    loadExampleMindMap();
    setInputType('pdf'); // Example is PDF-based
  }, [loadExampleMindMap]);

  // Custom handler for input that redirects after creation
  const isTextInputObject = (input: any): input is { text: string, isTextInput?: boolean, isWebContent?: boolean, sourceUrl?: string } => {
    return typeof input === 'object' && input !== null && 'text' in input && typeof input.text === 'string';
  };

  const isFileUploadObject = (input: any): input is { file: File, blobUrl: string, originalFileName: string, sourceUrl?: string } => {
    return typeof input === 'object' && input !== null && 'file' in input && input.file instanceof File && 'blobUrl' in input && 'originalFileName' in input;
  }

  // Use Phase 3 real-time streaming by default for best UX
  // Fallback chain: realtime → streaming → non-streaming
  const handleInput = useCallback(async (input: File | { text: string, isTextInput?: boolean, isWebContent?: boolean, sourceUrl?: string } | { file: File, blobUrl: string, originalFileName: string }, blobUrl?: string) => {
    let apiResponse = null;
    let usedRealtimeStreaming = false;

    try {
      // Try Phase 3: Real-time streaming (nodes appear one by one)
      if (isTextInputObject(input)) {
        if (input.isWebContent === true && input.sourceUrl) {
          setInputType('text');
          apiResponse = await handleTextInputRealtime(input.text, input.sourceUrl);
          usedRealtimeStreaming = true;
        } else if (input.isTextInput === true) {
          setInputType('text');
          apiResponse = await handleTextInputRealtime(input.text);
          usedRealtimeStreaming = true;
        } else {
          setInputError('Please upload a PDF file instead of a text file, or use the Text tab for questions.');
        }
      } else if (isFileUploadObject(input)) {
        setInputType('pdf');
        if (input.file.type === 'application/pdf') {
          apiResponse = await handleFileUploadRealtime(input.file, input.blobUrl, input.originalFileName, input.sourceUrl);
          usedRealtimeStreaming = true;
        } else {
          setInputError('Only PDF files are supported for file upload.');
        }
      } else if (input instanceof File) {
        setInputType('pdf');
        if (input.type === 'application/pdf') {
          apiResponse = await handleFileUploadRealtime(input, blobUrl);
          usedRealtimeStreaming = true;
        } else {
          setInputError('Only PDF files are supported for file upload.');
        }
      }
    } catch (realtimeError) {
      // Fallback to Phase 2: Progressive streaming
      console.warn('Real-time streaming failed, falling back to progressive streaming:', realtimeError);

      try {
        if (isTextInputObject(input)) {
          if (input.isWebContent === true && input.sourceUrl) {
            apiResponse = await handleTextInputStreaming(input.text, input.sourceUrl);
            usedRealtimeStreaming = true; // Still uses streaming
          } else if (input.isTextInput === true) {
            apiResponse = await handleTextInputStreaming(input.text);
            usedRealtimeStreaming = true;
          }
        } else if (isFileUploadObject(input)) {
          apiResponse = await handleFileUploadStreaming(input.file, input.blobUrl, input.originalFileName, input.sourceUrl);
          usedRealtimeStreaming = true;
        } else if (input instanceof File) {
          apiResponse = await handleFileUploadStreaming(input, blobUrl);
          usedRealtimeStreaming = true;
        }
      } catch (streamError) {
        // Final fallback: Non-streaming
        console.warn('Progressive streaming failed, falling back to non-streaming:', streamError);
        usedRealtimeStreaming = false;

        if (isTextInputObject(input)) {
          if (input.isWebContent === true && input.sourceUrl) {
            apiResponse = await handleTextInput(input.text, input.sourceUrl);
          } else if (input.isTextInput === true) {
            apiResponse = await handleTextInput(input.text);
          }
        } else if (isFileUploadObject(input)) {
          apiResponse = await handleFileUpload(input.file, input.blobUrl, input.originalFileName, input.sourceUrl);
        } else if (input instanceof File) {
          apiResponse = await handleFileUpload(input, blobUrl);
        }
      }
    }

    if (apiResponse && apiResponse.mindmapId) {
      // Add streaming=true param if we used streaming mode (so destination page polls)
      const streamingParam = usedRealtimeStreaming ? '?streaming=true' : '';
      router.push(`/papermap/${apiResponse.mindmapId}${streamingParam}`);
    }
  }, [handleFileUpload, handleTextInput, handleFileUploadStreaming, handleTextInputStreaming, handleFileUploadRealtime, handleTextInputRealtime, router]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/[0.065] blur-3xl dark:bg-blue-500/[0.075]"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

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
          title={<span className="text-sm font-semibold tracking-[-0.01em]">Papermap</span>}
        />
      </div>
      
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <motion.section
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
          className="my-auto w-full py-4 sm:py-6"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-6 max-w-3xl text-center sm:mb-7"
          >
            <h1 className="text-balance text-[2.5rem] font-semibold leading-none tracking-[-0.05em] sm:text-5xl">
              Create Interactive Mindmap
            </h1>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-2xl"
          >
            <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
            <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
            <div className="relative">
              <InputForm
                onFileUpload={handleInput}
                loading={loading}
                error={combinedError}
                onExampleClick={handleExampleClick}
              />
            </div>
          </motion.div>
        </motion.section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  );
}
