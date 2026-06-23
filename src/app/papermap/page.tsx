'use client';

import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback, DragEvent } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import InputForm from './components/InputForm';
import { useMindMap } from './hooks/useMindMap';
import { AppsHeader } from '@/components/apps-header'
import AppsFooter from '@/components/apps-footer'
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define file size limits (copied from Sidebar.tsx)
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function PaperMap() {
  const { setTheme } = useTheme();
  const router = useRouter();
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden relative font-sans">
      {/* --- Ambient Background --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Animated Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        
        {/* Subtle Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader 
          leftButton={
            <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleHistorySidebar'))}>
              <Menu size={20} />
            </Button>
          }
        />
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-4 md:px-8 pt-16">
        <div className="text-center py-8 space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Paper
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x">map</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed">
            Learn Anything with AI Mindmap
          </p>
        </div>
        <div className="w-full relative group max-w-4xl mx-auto">
           <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200"></div>
           <InputForm
             onFileUpload={handleInput}
             loading={loading}
             error={combinedError}
             onExampleClick={handleExampleClick}
           />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  );
}
