import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Moon, Sun, LoaderCircle, X, Waypoints, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppsGrid } from "@/components/ui/apps-grid";
import { upload } from '@vercel/blob/client';

// Define file size limit constant - increased with Vercel Blob
const MAX_FILE_SIZE_MB = 25; // Maximum file size for PDF uploads
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File, blobUrl?: string) => void;
  loading: boolean;
  error: string | null;
  loadExampleMindMap?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  onFileUpload, 
  loading, 
  error,
  loadExampleMindMap
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [useUrl, setUseUrl] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const currentYear = new Date().getFullYear();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setUrl('');
      setUrlError(null);
      setUrlLoading(false);
      setUseUrl(false);
      setFileSizeError(null);
      setUploadProgress(0);
      setIsUploading(false);
    }
  }, [isOpen]);

  // Handle the animation states when isOpen changes
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Small delay to ensure DOM is ready before starting animation
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Check if file size is within limits
  const checkFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileSizeError(`File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
      return false;
    }
    setFileSizeError(null);
    return true;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (checkFileSize(selectedFile)) {
        setFile(selectedFile);
        setUrl('');
      } else {
        setFile(null);
        // Keep the file selected in the input for better UX
        event.target.value = '';
      }
    }
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer.files?.length) {
      const droppedFile = event.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        if (checkFileSize(droppedFile)) {
          setFile(droppedFile);
          setUrl('');
        }
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
    setUrlError(null);
    setFileSizeError(null);
    if (event.target.value) {
      setFile(null);
    }
  };

  // Upload file to Vercel Blob storage using direct client upload
  const uploadFileToBlob = async (fileToUpload: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(10); // Start progress

      // Set progress to mimic upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      try {
        // Use the custom GCP upload endpoint
        const formData = new FormData();
        formData.append('file', fileToUpload);
        
        const response = await fetch('/api/papermap/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();
        const blobUrl = data.url;

        // Clear interval and complete progress
        clearInterval(progressInterval);
        setUploadProgress(100);

        // Return the blob URL
        return blobUrl;
      } catch (error) {
        // Clear interval
        clearInterval(progressInterval);
        
        // Check for specific error types
        if (error instanceof Error) {
          // Check for size-related error messages
          if (error.message.includes('too large') || 
              error.message.includes('size exceeds') ||
              error.message.includes('413') ||
              error.message.includes('Request Entity Too Large')) {
            throw new Error(`File is too large. Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
          }
          throw error;
        }
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading to Blob storage:', error);
      setUrlError(error instanceof Error ? error.message : 'Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Upload URL content to Vercel Blob storage
  const uploadUrlToBlob = async (pdfUrl: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(10); // Start progress
      
      // Set progress to mimic upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      
      try {
        // Validate URL format before proceeding
        try {
          new URL(pdfUrl);
        } catch (e) {
          throw new Error("Invalid URL. Please enter a valid URL or upload the PDF file.");
        }
        
        // Use our server-side proxy to fetch the PDF
        // This avoids CORS issues that occur with direct fetch
        const proxyUrl = `/api/papermap/proxy?url=${encodeURIComponent(pdfUrl)}`;
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch PDF: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "Failed to process PDF");
        }

        // OPTIMIZATION: Check if the proxy returned a direct URL (for Vercel Blob URLs)
        if (data.isVercelBlob && data.directUrl) {
          // Clear interval and complete progress
          clearInterval(progressInterval);
          setUploadProgress(100);
          
          // Return the direct URL
          return data.directUrl;
        }
        
        // For regular URLs, continue with the normal process
        // Convert base64 data back to a Blob
        const binaryData = atob(data.base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        // Create a blob from the binary data
        const pdfBlob = new Blob([bytes.buffer], { type: 'application/pdf' });
        
        // Double-check size after downloading
        if (pdfBlob.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`File is too large (${(pdfBlob.size / (1024 * 1024)).toFixed(2)} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
        }
        
        // Extract filename from the proxy response
        const fileName = data.fileName || 'document.pdf';
        
        // Use direct client upload via our API
        const formData = new FormData();
        formData.append('file', pdfBlob, fileName);
        
        const uploadRes = await fetch('/api/papermap/upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();

        // Clear interval and complete progress
        clearInterval(progressInterval);
        setUploadProgress(100);

        return uploadData.url;
      } catch (error) {
        // Clear interval
        clearInterval(progressInterval);
        
        // Handle specific error types
        if (error instanceof Error) {
          // Check for common error patterns
          if (error.message.includes('too large') || error.message.includes('size exceeds')) {
            throw new Error(`File is too large. Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
          } else if (error.message.includes('valid PDF')) {
            throw new Error("The URL does not point to a valid PDF file. Please enter a valid URL or upload the PDF file.");
          } else if (error.message.includes('Failed to fetch PDF')) {
            throw new Error("Could not download the PDF. Please ensure the URL is accessible or upload the PDF file.");
          } else if (error.message.includes('Invalid URL format')) {
            throw new Error("Please enter a valid URL or upload the PDF file.");
          }
          throw error;
        }
        throw new Error('Failed to process URL. Try uploading the PDF file.');
      }
    } catch (error) {
      // Don't log common errors to avoid console clutter
      const isCommonError = error instanceof Error && (
        error.message.includes('too large') || 
        error.message.includes('size exceeds') ||
        error.message.includes('valid PDF') ||
        error.message.includes('Invalid URL format')
      );
      
      if (!isCommonError) {
        console.error('Error processing URL:', error);
      }
      
      // Set appropriate error message
      if (error instanceof Error) {
        setUrlError(error.message);
      } else {
        setUrlError(`Failed to process URL. Please try again or upload the PDF file.`);
      }
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (file) {
      // Upload file to Vercel Blob first
      const blobUrl = await uploadFileToBlob(file);
      
      if (blobUrl) {
        // Pass both the file and the blob URL to ensure it's properly stored
        onFileUpload(file, blobUrl);
        onClose();
      }
      return;
    }
    
    if (!url.trim()) {
      setUrlError("Please enter a URL or upload the PDF file.");
      return;
    }
    
    setUrlError(null);
    setUrlLoading(true);
    
    // Remove the strict PDF extension check
    // We now validate content type on the server
    
    try {
      // Upload URL to Vercel Blob
      const blobUrl = await uploadUrlToBlob(url);
      
      if (!blobUrl) {
        throw new Error(`Failed to process URL. Please check the URL and try again or upload the PDF file.`);
      }
      
      // Fetch from our blob URL to create a file object
      const response = await fetch(blobUrl);
      
      if (!response.ok) {
        throw new Error("Failed to retrieve file from storage");
      }
      
      const blob = await response.blob();
      
      // Create a File object from the blob
      const fileName = url.split('/').pop() || 'document.pdf';
      const fileFromUrl = new File([blob], fileName, { type: 'application/pdf' });
      
      // Pass both the file and blob URL to the handler 
      onFileUpload(fileFromUrl, blobUrl);
      onClose();
    } catch (err) {
      // Use the specific error message when available
      let errorMessage = "Failed to process the URL. Please try again or upload the PDF file.";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setUrlError(errorMessage);
      
      // Only log if it's not a common error
      const isCommonError = errorMessage.includes('too large') || 
                           errorMessage.includes('size exceeds') ||
                           errorMessage.includes('valid PDF') ||
                           errorMessage.includes('Invalid URL format');
      
      if (!isCommonError) {
        console.error('Error fetching PDF:', err);
      }
    } finally {
      setUrlLoading(false);
    }
  };

  const handleLoadExample = () => {
    if (loadExampleMindMap) {
      loadExampleMindMap();
      onClose();
    }
  };

  // Determine if the Create button should be disabled
  const isCreateButtonDisabled = loading || 
                               urlLoading || 
                               isUploading ||
                               (!file && !url.trim()) || 
                               !!fileSizeError;

  if (!isRendered) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex transition-opacity duration-300 ease-in-out"
      style={{ opacity: isAnimating ? 1 : 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`w-80 bg-card h-full shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 flex-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Waypoints className="h-5 w-5 mr-1" />
              New Mindmap
            </h3>
            <Button
              variant="secondary"
              size="icon"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="mb-6">
            <div 
              className={`border-2 bg-muted/50 rounded-base p-8 text-center mb-4 relative ${file ? 'border-primary bg-primary/10' : 'border-border'}`}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
            >
              {file ? (
                <div className="text-primary">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      setFileSizeError(null);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <p className="font-medium text-sm break-words max-w-full px-6" style={{ wordBreak: 'break-all' }}>{file.name.replace(/_/g, '_\u200B')}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground text-sm">Drop your file here</p>
                  <Button
                    variant="default"
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </Button>
                </div>
              )}
            </div>

            {fileSizeError && (
              <div className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-base flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{fileSizeError}</span>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Or Enter a URL</label>
              <Input
                type="text"
                value={url}
                onChange={handleUrlChange}
                disabled={!!file}
                placeholder="https://example.com/paper.pdf"
                className={file ? 'bg-muted text-muted-foreground' : ''}
              />
              {urlError && (
                <div className="text-destructive text-sm mt-1 p-3 bg-destructive/10 rounded-base flex items-start">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>

            {/* Upload progress bar */}
            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-4">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isCreateButtonDisabled}
              variant={isCreateButtonDisabled ? "secondary" : "default"}
              className="w-full"
            >
              {loading || urlLoading || isUploading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  {isUploading ? 'Reading...' : 'Mapping...'}
                </>
              ) : (
                "Create"
              )}
            </Button>

          </div>

          {error && (
            <div className="text-destructive text-sm mt-4 p-3 bg-destructive/10 rounded-base">
              {error.includes("[GoogleGenerativeAI Error]") 
                ? "AI service unavailable. Please try again later." 
                : error.includes("File is too large") || error.includes("too large") || error.includes("size exceeds")
                  ? `The AI cannot process this large file. Please upload a smaller PDF.`
                : error.length > 60 
                  ? `${error.substring(0, 60)}...` 
                  : error
              }
            </div>
          )}

        </div>

        <div className="mt-auto px-6 mb-6">
          <AppsGrid
            trigger={
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>More Apps</span>
              </Button>
            }
          />
        </div>

        <footer className="py-1 text-center text-sm text-muted-foreground pb-3">
          <p className="flex flex-wrap items-center justify-center relative">
            <span className="flex-grow flex items-center justify-center">
              &copy; {currentYear}&nbsp;
            </span>
            <Button
              variant="default"
              size="icon"
              className="absolute right-2 rounded-full -top-4"
              onClick={() => {
                const html = document.documentElement;
                html.classList.toggle('dark');
              }}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Sidebar; 