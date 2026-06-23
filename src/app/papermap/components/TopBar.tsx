import { FileText, Plus, RefreshCw, MessageSquare, ExternalLink } from 'lucide-react';
import Downloader from './Downloader';
import { useCallback, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useMindMapContext, usePdfViewerContext } from '../context';
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
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

interface TopBarProps {
  onFileUpload: (file: File | { text: string, isTextInput?: boolean }, blobUrl?: string) => void;
  onNewClick: () => void;
  inputType: 'pdf' | 'text' | 'url' | null;
}

export default function TopBar({
  onFileUpload,
  onNewClick,
  inputType
}: TopBarProps) {
  // Get state from contexts
  const { 
    loading, 
    error, 
    loadExampleMindMap 
  } = useMindMapContext();
  
  const { 
    fileName, 
    openPdfViewer, 
    handlePdfFile, 
    sourceUrl: contextSourceUrl, 
    inputType: contextInputType,
    isPdfAccessExpired,
    parsedPdfContent: contextParsedPdfContent,
    openArchivedContentViewer
  } = usePdfViewerContext();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const router = useRouter();

  // Load sourceUrl from context when component mounts or context changes
  useEffect(() => {
    if (contextSourceUrl) {
      setSourceUrl(contextSourceUrl);
    } else {
      // Fallback to localStorage if not in context (e.g. for initial load before context is fully populated)
      const lsSourceUrl = localStorage.getItem('sourceUrl');
      setSourceUrl(lsSourceUrl);
    }
  }, [contextSourceUrl]);

  // Custom file upload handler for PDF files
  const handleUpload = useCallback(async (file: File, blobUrl?: string) => {
    // Process the PDF file for viewing first
    await handlePdfFile(file, blobUrl);
    
    // Then call the parent handler for mind map generation
    // Make sure we're passing the file as a File object, not as text
    onFileUpload(file, blobUrl);
  }, [onFileUpload, handlePdfFile]);

  // Function to handle file name click and open PDF viewer or archived content
  const handleFileNameClick = () => {
    if (contextInputType === 'pdf') {
      if (isPdfAccessExpired) {
        if (contextParsedPdfContent) {
          openArchivedContentViewer();
        } else {
          // Optionally, inform user that PDF is expired and no archive exists
          alert('The PDF for this mindmap has expired, and no archived text is available.');
        }
      } else {
        openPdfViewer(1); // Open to the first page if not expired
      }
    }
  };

  // Function to handle URL click and open in new tab
  const handleUrlClick = () => {
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Determine if the title is a URL based on contextInputType
  const isUrlType = contextInputType === 'url';

  // Replace the onNewClick handler to navigate to root
  const handleNewClick = () => {
    router.push('/papermap');
  };

  return (
    <div className="sticky top-0 py-4 px-2 bg-muted/50 backdrop-blur-sm print:hidden z-50 overscroll-none">
      <div className="flex items-center justify-between gap-4 relative">
        {/* Left side - New button */}
        <div className="absolute left-0 z-10">
          <Button
            variant="default"
            className="flex items-center"
            title="New Mindmap"
            onClick={handleNewClick}
          >
            <span className=""><Plus className="h-4 w-4" /></span>
            <span className="sm:inline hidden">New</span>
          </Button>
        </div>
        
        {/* Center - Status messages */}
        <div className="flex-1 text-center min-w-0 mx-[72px] sm:mx-[85px]">
          {loading && (
            <div className="flex items-center justify-center text-primary">
              <span>Loading Mindmap</span>
            </div>
          )}

          {error && (
            <div className="text-destructive">
              {error.includes("[GoogleGenerativeAI Error]") && error.includes("exceeds the supported page limit of 1000")
                ? "PDF is too large. Please use a document with fewer than 1000 pages."
                : error.includes("[GoogleGenerativeAI Error]") 
                  ? "AI service unavailable. Please try again later." 
                  : error.length > 60 
                    ? `${error.substring(0, 60)}...` 
                    : error
              }
            </div>
          )}

          {!loading && !error && (
            <div 
              className={`font-extrabold text-primary relative inline-flex items-center max-w-[calc(100%-2rem)] ${
                contextInputType === 'pdf' || (isUrlType && sourceUrl) ? 'cursor-pointer hover:text-blue-600 group' : ''
              }`}
              onClick={
                contextInputType === 'pdf' 
                  ? handleFileNameClick 
                  : isUrlType && sourceUrl 
                    ? handleUrlClick 
                    : undefined
              }
              title={
                contextInputType === 'pdf' 
                  ? (isPdfAccessExpired 
                      ? (contextParsedPdfContent ? "View Archived Text" : "PDF Expired (No Archive)") 
                      : "Click to open PDF")
                  : isUrlType && sourceUrl 
                    ? "Click to open URL in new tab" 
                    : ""
              }
            >
              <div className={`${contextInputType === 'pdf' || (isUrlType && sourceUrl) ? "group-hover:text-blue-600 mr-2" : "mr-2"}`}>
                {contextInputType === 'pdf' ? (
                  <FileText className="h-4 w-4" />
                ) : isUrlType && sourceUrl ? (
                  <ExternalLink className="h-4 w-4 text-blue-600" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </div>
              <div className="truncate max-w-full">
                {contextInputType === 'pdf' 
                  ? (fileName !== 'mindmap' ? fileName : "Example: Steve Jobs' Stanford Commencement Speech")
                  : isUrlType && sourceUrl 
                    ? (
                      <span className="flex items-center gap-1 text-blue-600 group-hover:underline">
                        {fileName || "Web Content"} 
                      </span>
                    )
                    : (fileName || "Topic Mindmap")
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Right side - Download button */}
        <div className="absolute right-0 z-10">
          <Downloader />
        </div>
      </div>
    </div>
  );
} 
