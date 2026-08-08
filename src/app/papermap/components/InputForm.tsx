import React, { useState, useRef } from 'react';
import { ArrowUp, LoaderCircle, AlertTriangle, Waypoints, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { motion } from 'framer-motion';

// Define file size limit constant - increased with Vercel Blob
const MAX_FILE_SIZE_MB = 25; // Maximum file size for PDF uploads
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type InputMode = 'file' | 'url' | 'text';

interface InputFormProps {
    onFileUpload: (input: File | { text: string, isTextInput?: boolean, isWebContent?: boolean, sourceUrl?: string } | { file: File, blobUrl: string, originalFileName: string }, blobUrl?: string) => void;
    loading: boolean;
    error: string | null;
    onExampleClick?: () => void;
    loadingStage?: string;
}

const InputForm: React.FC<InputFormProps> = ({
    onFileUpload,
    loading,
    error,
    onExampleClick,
    loadingStage: loadingStageProp
}) => {
    const [url, setUrl] = useState<string>('');
    const [text, setText] = useState<string>('');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [urlLoading, setUrlLoading] = useState<boolean>(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileSizeError, setFileSizeError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isFocused, setIsFocused] = useState(false);
    const [inputMode, setInputMode] = useState<InputMode>('text');
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const urlTextareaRef = useRef<HTMLTextAreaElement>(null);
    const form = useForm();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();
    const [loadingStage, setLoadingStage] = useState<string | null>(null);

    const handleInputModeChange = (value: string) => {
        setInputMode(value as InputMode);
        setUrlError(null);
        setFileSizeError(null);
        // Clear other inputs when switching modes
        if (value === 'file') {
            setUrl('');
            setText('');
        } else if (value === 'url') {
            setFile(null);
            setText('');
        } else if (value === 'text') {
            setFile(null);
            setUrl('');
        }
    };

    // Add auto-resize function
    const autoResize = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
        const textarea = ref.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    };

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setUrlError(null);
        setFileSizeError(null);
        autoResize(textareaRef);
    };

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
        // Clear both error states when file selection dialog is opened
        setUrlError(null);
        if (selectedFile) {
            if (checkFileSize(selectedFile)) {
                setFile(selectedFile);
                setUrl('');
                setFileSizeError(null);
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
        setIsDragging(false);

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
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleUrlChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUrl(event.target.value);
        setUrlError(null);
        setFileSizeError(null);
        if (event.target.value) {
            setFile(null);
        }
        autoResize(urlTextareaRef);
    };

    const handleFileClick = (e: React.MouseEvent) => {
        // Only prevent default to stop form submission
        e.preventDefault();
        if (fileInputRef.current) {
            fileInputRef.current.accept = 'application/pdf';
            fileInputRef.current.click();
            // Clear any URL errors when opening the file dialog
            setUrlError(null);
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    // Upload file to Vercel Blob storage using direct client upload
    const uploadFileToBlob = async (fileToUpload: File): Promise<string | null> => {
        try {
            setLoadingStage('Uploading');
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
            setLoadingStage(null);
        }
    };

    // Upload URL content to Vercel Blob storage
    const uploadUrlToBlob = async (pdfUrl: string): Promise<string | null> => {
        try {
            setLoadingStage('Uploading');
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
                let processedUrl = pdfUrl;
                if (!/^https?:\/\//i.test(processedUrl)) {
                    processedUrl = 'https://' + processedUrl;
                }

                try {
                    new URL(processedUrl); // Validate the potentially modified URL
                } catch (e) {
                    throw new Error("Invalid URL. Please enter a valid URL or upload the PDF file.");
                }

                // Use our server-side proxy to fetch the PDF
                // This avoids CORS issues that occur with direct fetch
                const proxyUrl = `/api/papermap/proxy?url=${encodeURIComponent(processedUrl)}`;

                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch content: ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to process content");
                }

                // OPTIMIZATION: Check if the proxy returned a direct URL (for Vercel Blob URLs)
                if (data.isVercelBlob && data.directUrl) {
                    // Clear interval and complete progress
                    clearInterval(progressInterval);
                    setUploadProgress(100);
                    setLoadingStage('Parsing');
                    // Return the direct URL
                    return data.directUrl;
                }

                // Check if the content is from a web page (not a PDF)
                if (data.isWebContent && data.extractedText) {
                    // Clear interval and complete progress
                    clearInterval(progressInterval);
                    setUploadProgress(100);
                    setLoadingStage('Parsing');
                    // Return special object for web content
                    return JSON.stringify({
                        isWebContent: true,
                        extractedText: data.extractedText,
                        sourceUrl: processedUrl,
                        fileName: data.fileName || `Content from ${new URL(processedUrl).hostname}`
                    });
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
                setLoadingStage('Uploading');
                
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
                setLoadingStage('Parsing');

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
                        throw new Error("The URL does not point to a valid PDF file. The system will try to extract web content instead.");
                    } else if (error.message.includes('Failed to fetch')) {
                        throw new Error("Could not download the content. Please ensure the URL is accessible or upload the PDF file.");
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
            setLoadingStage(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (inputMode === 'file' && file) {
            setLoadingStage('Uploading');
            // Upload file to Vercel Blob first
            const blobUrl = await uploadFileToBlob(file);

            if (blobUrl) {
                setLoadingStage('Parsing');
                // Pass both the file and the blob URL to ensure it's properly stored
                // Also pass the original file name
                onFileUpload({ file, blobUrl, originalFileName: file.name });
                setLoadingStage(null);
            }
            return;
        }

        if (inputMode === 'url') {
            if (!url.trim()) {
                setUrlError("Please enter a URL or upload the PDF file.");
                return;
            }

            setUrlError(null);
            setUrlLoading(true);
            setLoadingStage('Uploading');

            try {
                // Upload URL to Vercel Blob
                const result = await uploadUrlToBlob(url);

                if (!result) {
                    throw new Error(`Failed to process URL. Please check the URL and try again or upload the PDF file.`);
                }

                setLoadingStage('Parsing');
                // Check if the result is web content
                try {
                    const parsedResult = JSON.parse(result);
                    if (parsedResult.isWebContent) {
                        // Handle web content result
                        onFileUpload({
                            text: parsedResult.extractedText,
                            isTextInput: true,
                            isWebContent: true,
                            sourceUrl: parsedResult.sourceUrl
                        });
                        setLoadingStage(null);
                        return;
                    }
                } catch (e) {
                    // Not JSON, proceed with blob URL handling
                }

                // If we're here, treat as a blob URL for PDF
                const response = await fetch(result);

                if (!response.ok) {
                    throw new Error("Failed to retrieve file from storage");
                }

                const blob = await response.blob();

                // Create a File object from the blob
                const fileName = url.split('/').pop() || 'document.pdf';
                const fileFromUrl = new File([blob], fileName, { type: 'application/pdf' });

                // Pass both the file and blob URL to the handler, and always include sourceUrl
                onFileUpload({ file: fileFromUrl, blobUrl: result, originalFileName: fileFromUrl.name, sourceUrl: url.trim() });
                setLoadingStage(null);
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
                    console.error('Error fetching content:', err);
                }
            } finally {
                setUrlLoading(false);
            }
            return;
        }

        if (inputMode === 'text') {
            if (!text.trim()) {
                setUrlError("Please enter some text.");
                return;
            }

            try {
                setLoadingStage('Parsing');
                // Add a special flag to identify this as a text input request
                onFileUpload({ text: text.trim(), isTextInput: true });
                setLoadingStage(null);
            } catch (err) {
                let errorMessage = "Failed to process the text. Please try again.";

                if (err instanceof Error) {
                    errorMessage = err.message;
                }

                setUrlError(errorMessage);
                console.error('Error processing text:', err);
            }
            return;
        }

        setUrlError("Please provide input in the selected format.");
    };

    // Replace the Example button handler to navigate to /papermap/example
    const handleExampleClick = () => {
        router.push('/papermap/example');
    };

    // Determine if the Create button should be disabled
    const isCreateButtonDisabled = loading ||
        urlLoading ||
        isUploading ||
        (inputMode === 'file' && !file) ||
        (inputMode === 'url' && !url.trim()) ||
        (inputMode === 'text' && !text.trim()) ||
        !!fileSizeError;

    // Disable the whole form when loading or uploading
    const isFormDisabled = loading || urlLoading || isUploading;

    // Convert File to the format expected by FilePreview
    const filePreviewData = file ? {
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
        uploaded: !isUploading
    } : null;

    // Convert loading stage code to user-friendly message
    const getLoadingStageMessage = (stage: string | null | undefined): string => {
        switch (stage) {
            case 'uploading':
                return 'Uploading...';
            case 'analyzing':
                return 'AI is reading...';
            case 'generating':
                return 'Creating mindmap...';
            case 'saving':
                return 'Saving...';
            case 'building':
                return 'Almost done...';
            default:
                return 'Processing...';
        }
    };

    // Compute the current loading stage to display
    let displayLoadingStage = loadingStageProp || loadingStage;
    const loadingMessage = getLoadingStageMessage(displayLoadingStage);

    return (
        <div className="w-full">
            <div>

                {fileSizeError && (
                    <div className="text-destructive text-sm mb-0 p-3 bg-destructive/10 rounded-base flex items-start  max-w-2xl mx-auto w-full">
                        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{fileSizeError}</span>
                    </div>
                )}

                <Form {...form}>
                    <form
                        onSubmit={handleSubmit}
                        onClick={() => setIsFocused(true)}
                        onBlur={(e) => {
                            // Only blur if clicking outside the form
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setIsFocused(false);
                            }
                        }}
                        tabIndex={0} // Make the form focusable
                        data-focused={isFocused}
                        className={`relative mx-auto flex w-full max-w-2xl flex-col rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] outline-none transition-[box-shadow,transform] duration-300 dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-4 ${isFocused ? 'shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(59,130,246,0.11)] dark:shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_0_3px_rgba(96,165,250,0.12)]' : ''} ${isDragging ? 'ring-2 ring-blue-500/40' : ''}`}
                    >
                        {/* {inputMode === 'file' && (
                            <div
                                className={`bg-muted/50 rounded-3xl p-8 text-center mb-4 relative transition-all duration-200 ${file
                                    ? 'border-primary bg-primary/10'
                                    : isDragging
                                        ? 'border-2 border-primary bg-primary/5 border-dashed'
                                        : 'border border-border'
                                    }`}
                                onDrop={isFormDisabled ? undefined : handleFileDrop}
                                onDragOver={isFormDisabled ? undefined : handleDragOver}
                                onDragLeave={isFormDisabled ? undefined : handleDragLeave}
                                aria-disabled={isFormDisabled}
                            >
                                {file ? (
                                    <div className="text-primary">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            onClick={isFormDisabled ? undefined : (e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setFile(null);
                                                setFileSizeError(null);
                                            })}
                                            disabled={isFormDisabled}
                                            aria-disabled={isFormDisabled}
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
                                        <p className="text-muted-foreground text-sm hidden md:block">
                                            {isDragging ? "Drop PDF here" : "Drop PDF here"}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="default"
                                            className="mt-2"
                                            onClick={isFormDisabled ? undefined : (() => fileInputRef.current?.click())}
                                            disabled={isFormDisabled}
                                            aria-disabled={isFormDisabled}
                                        >
                                            Browse Files
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                disabled={isFormDisabled}
                                            />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )} */}

                        {inputMode === 'url' && (
                            <textarea
                                ref={urlTextareaRef}
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="https://example.com/paper.pdf"
                                className="my-1 min-h-[92px] max-h-[180px] w-full resize-none overflow-y-auto border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none outline-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                rows={1}
                                disabled={isFormDisabled}
                                aria-disabled={isFormDisabled}
                            />
                        )}

                        {inputMode === 'text' && (
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={handleTextChange}
                                placeholder="Enter a topic, question, or idea…"
                                className="my-1 min-h-[92px] max-h-[240px] w-full resize-none overflow-y-auto border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none outline-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                rows={1}
                                disabled={isFormDisabled}
                                aria-disabled={isFormDisabled}
                            />
                        )}

                        {urlError && (
                            <div className="text-destructive text-sm mt-1 p-3 bg-destructive/10 rounded-base flex items-start  max-w-2xl mx-auto w-full">
                                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                                <span>{urlError}</span>
                            </div>
                        )}

                        {/* Upload progress bar */}
                        {isUploading && (
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-2">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                        )}

                        <div className="flex w-full items-center justify-between gap-2 border-t border-black/[0.055] pt-3 dark:border-white/[0.07]">
                            <div className="flex items-center gap-0 md:gap-1 shrink-0">
                                <Tabs defaultValue="text" onValueChange={isFormDisabled ? undefined : handleInputModeChange} className="w-fit">
                                    <TabsList className="flex h-auto gap-0.5 rounded-xl border border-black/[0.065] bg-black/[0.035] p-1 dark:border-white/[0.08] dark:bg-white/[0.045]">
                                        {/* <TabsTrigger
                                            value="file"
                                            className="px-3 md:px-4 py-1.5 text-xs font-medium rounded-full border border-transparent transition-all duration-300 data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground relative z-10"
                                            disabled={isFormDisabled}
                                            aria-disabled={isFormDisabled}
                                        >
                                            PDF
                                        </TabsTrigger> */}
                                        <TabsTrigger
                                            value="text"
                                            className="relative rounded-lg border-0 bg-transparent px-3 py-1.5 text-xs font-medium text-black/42 shadow-none transition-colors hover:text-black/70 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:text-white/40 dark:hover:text-white/70 dark:data-[state=active]:text-[#191918] md:px-3.5"
                                            disabled={isFormDisabled}
                                            aria-disabled={isFormDisabled}
                                        >
                                            {inputMode === 'text' && (
                                                <motion.span
                                                    layoutId="papermap-input-mode"
                                                    className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]"
                                                    transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                                                />
                                            )}
                                            <span className="relative z-10">Text</span>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="url"
                                            className="relative rounded-lg border-0 bg-transparent px-3 py-1.5 text-xs font-medium text-black/42 shadow-none transition-colors hover:text-black/70 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:text-white/40 dark:hover:text-white/70 dark:data-[state=active]:text-[#191918] md:px-3.5"
                                            disabled={isFormDisabled}
                                            aria-disabled={isFormDisabled}
                                        >
                                            {inputMode === 'url' && (
                                                <motion.span
                                                    layoutId="papermap-input-mode"
                                                    className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]"
                                                    transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                                                />
                                            )}
                                            <span className="relative z-10">URL</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant={isHovered ? "default" : "neutral"}
                                            className={`ml-2 h-8 cursor-pointer rounded-xl border-black/[0.065] bg-black/[0.025] text-black/45 shadow-none hover:bg-black/[0.055] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/45 dark:hover:bg-white/[0.07] dark:hover:text-white${isActive ? " mb-1 mr-1 md:mr-2" : ""}`}
                                            onClick={isFormDisabled ? undefined : (() => { handleExampleClick(); setIsActive(true); })}
                                            onMouseEnter={isFormDisabled ? undefined : (() => { setIsHovered(true); setIsActive(true); })}
                                            onMouseLeave={isFormDisabled ? undefined : (() => { setIsHovered(false); setIsActive(false); })}
                                            aria-disabled={isFormDisabled}
                                            tabIndex={isFormDisabled ? -1 : 0}
                                        >
                                            <Lightbulb className="h-4 w-4 md:h-5 md:w-5" />
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="center">
                                        Show Example
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            <Button
                                type="submit"
                                className="group h-10 shrink-0 rounded-xl bg-[#191918] px-3.5 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white sm:px-4"
                                disabled={isCreateButtonDisabled}
                                aria-label="Create mindmap"
                            >
                                {(loading || urlLoading || isUploading) ? (
                                    <span className="flex items-center gap-2">
                                        <LoaderCircle className="size-4 animate-spin text-amber-300" />
                                        <span className="hidden md:inline">{loadingMessage}</span>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <span>Create</span>
                                        <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>

            {/* Move error message inside the form container for width alignment */}
            {error && (
                <div className="text-destructive text-sm mt-4 p-3 bg-destructive/10 rounded-base max-w-2xl mx-auto w-full">
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
    );
};

export default InputForm;
