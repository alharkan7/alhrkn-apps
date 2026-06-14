import { useState } from 'react';

interface FileData {
    name: string;
    type: string;
    url: string;          // Local URL for preview
    blobUrl?: string;     // Blob URL for API
    filePath?: string;    // Bucket file path
    uploaded?: boolean;
}

export function useFileUpload() {
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<FileData | null>(null);

    const handleFileSelect = async (selectedFile: File) => {
        setIsUploading(true);
        
        // Show preview immediately with loading state
        const previewUrl = URL.createObjectURL(selectedFile);
        setFile({
            name: selectedFile.name,
            type: selectedFile.type,
            url: previewUrl,
            uploaded: false
        });
        
        try {
            if (selectedFile.type.startsWith('image/')) {
                // Create FormData
                const formData = new FormData();
                formData.append('file', selectedFile);

                // Upload to our secure API endpoint
                const response = await fetch('/api/chat/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const blob = await response.json();

                // Keep the local preview URL, just store the blob URL for API
                setFile(prev => prev ? {
                    ...prev,
                    blobUrl: blob.url,
                    filePath: blob.path,
                    uploaded: true
                } : null);
            } else {
                // For non-image files, continue using base64
                const base64String = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        resolve(result);
                    };
                    reader.readAsDataURL(selectedFile);
                });

                setFile(prev => prev ? {
                    ...prev,
                    blobUrl: base64String,
                    uploaded: true
                } : null);
            }
        } catch (error) {
            console.error('Error processing file:', error);
            URL.revokeObjectURL(previewUrl);
            setFile(null);
        } finally {
            setIsUploading(false);
        }
    };

    const clearFile = () => {
        // Don't revoke the URL if it's already been used in a message
        // The browser will clean it up when the page is unloaded
        setFile(null);
        setIsUploading(false);
    };

    return {
        file,
        isUploading,
        handleFileSelect,
        clearFile
    };
}