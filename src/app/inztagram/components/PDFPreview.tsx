import { FileText, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { ImageModal } from '@/components/ui/image-modal';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface FilePreviewProps {
    file: {
        name: string;
        type: string;
        url: string;
    };
    isUploading: boolean;
    onRemove: () => void;
    isSent?: boolean;
    inMessage?: boolean;  // Add this prop
}

export function FilePreview({ file, isUploading, onRemove, isSent = false, inMessage = false }: FilePreviewProps) {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const handleFileClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling
        if (isImage) {
            setIsImageModalOpen(true);
        } else if (isPdf) {
            // Create a Blob from the base64 data and create an object URL
            const base64Data = file.url.split(',')[1];
            const binaryData = atob(base64Data);
            const byteArray = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                byteArray[i] = binaryData.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(blob);

            // Open in new tab and clean up the object URL
            const newWindow = window.open(objectUrl, '_blank');
            if (newWindow) {
                newWindow.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                };
            }
        } else {
            // For other file types, download the file
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getFileIcon = () => {
        const fileType = file.name.split('.').pop()?.toLowerCase() || '';
        switch (fileType) {
            case 'pdf':
                return <FileText className="size-8 !text-secondary-foreground" />;
            case 'doc':
                return <FileText className="size-8 !text-secondary-foreground" />;
            case 'docx':
                return <FileText className="size-8 !text-secondary-foreground" />;
            case 'txt':
                return <FileText className="size-8 !text-secondary-foreground" />;
            case 'md':
                return <FileText className="size-8 !text-secondary-foreground" />;
            default:
                return <FileText className="size-8 !text-secondary-foreground" />;
        }
    };

    const getTruncatedName = (name: string) => {
        const extension = name.split('.').pop() || '';
        const nameWithoutExt = name.slice(0, -(extension.length + 1)); // +1 for the dot
        if (nameWithoutExt.length > 20) {
            return `${nameWithoutExt.slice(0, 20)}...${extension}`;
        }
        return name;
    };

    if (isImage) {
        return (
            <>
                <div className="relative flex justify-center" style={{ pointerEvents: 'auto' }}>
                    <div
                        className="relative cursor-pointer"
                        onClick={handleFileClick}
                        style={{ pointerEvents: 'auto' }}
                    >
                        <div className="relative">
                            <img
                                src={file.url}
                                alt="Preview"
                                className={`rounded-lg object-contain ${inMessage ? 'max-h-[300px]' : 'max-h-[100px]'} ${isUploading ? 'opacity-50' : ''} transition-opacity duration-200`}
                            />
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/5 rounded-lg">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        {!isSent && (
                            <Button
                                variant="secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove();
                                }}
                                className="absolute -top-4 -right-4 transition-colors rounded-full"
                                aria-label="Remove file"
                                disabled={isUploading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </Button>
                        )}
                    </div>
                </div>
                {typeof window !== 'undefined' && isImageModalOpen && createPortal(
                    <ImageModal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        imageUrl={file.url}
                        altText={file.name}
                    />,
                    document.body
                )}
            </>
        );
    }

    return (
        <div className="relative w-full flex justify-center">
            <Card
                className={`relative flex mb-2 !items-center gap-3 p-3 ${inMessage ? 'w-full' : 'w-fit min-w-[200px]'} ${isUploading ? 'opacity-50' : ''} transition-opacity duration-200`}
                onClick={handleFileClick}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            >
                {isUploading ? (
                    <Loader2 className="size-8 animate-spin text-primary" />
                ) : (
                    getFileIcon()
                )}
                <div className="flex-1 min-w-0 flex items-center h-full">
                    <p className={`text-sm font-medium truncate !text-secondary-foreground my-auto`} title={file.name}>
                        {getTruncatedName(file.name)}
                    </p>
                </div>
                {!isSent && (
                    <Button
                        variant="secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute -top-5 -right-4 rounded-full"
                        aria-label="Remove file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </Button>
                )}
            </Card>
        </div>
    );
}
