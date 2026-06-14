import { useState } from 'react';
import { Message } from '../types/types';

export function useChatMessages(initialMessages: Message[] = [], initialSessionId?: string) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [sessionId, setSessionId] = useState(() => initialSessionId || crypto.randomUUID());
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    
    const clearMessages = () => {
        setMessages([]);
        setSessionId(crypto.randomUUID());
        setIsLoading(false);
        setIsStreaming(false);
    };

    const sendMessage = async (input: string, file: { name: string; type: string; url: string; blobUrl?: string; filePath?: string } | null) => {
        if ((!input.trim() && !file) || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: file ? [
                file.type.startsWith('image/') 
                    ? {
                        type: 'image_url' as const,
                        image_url: { 
                            url: file.url,           // Local URL for preview
                            originalUrl: file.url,   // Keep local URL for display
                            blobUrl: file.blobUrl,   // Store blob URL for API
                            filePath: file.filePath  // Store bucket path
                        }
                    }
                    : {
                        type: 'file_url' as const,
                        file_url: { 
                            url: file.url,           // Local URL for preview
                            originalUrl: file.url,   // Keep local URL for display
                            blobUrl: file.blobUrl,   // Store blob URL for API
                            filePath: file.filePath, // Store bucket path
                            name: file.name, 
                            type: file.type 
                        }
                    },
                { type: 'text' as const, text: input.trim() || `Analyze ${file.name}...` }
            ] : [{ type: 'text' as const, text: input.trim() }]
        };

        // console.log('Creating user message with file:', {
        //     fileData: file,
        //     messageContent: userMessage.content
        // });

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setIsStreaming(false);

        try {
            const apiMessages = [...messages, userMessage].map(msg => ({
                role: msg.role,
                content: Array.isArray(msg.content) 
                    ? msg.content.map(part => {
                        if (part.type === 'text') return part;
                        if (msg === userMessage) {
                            // Use blob URL for API calls
                            if (part.type === 'image_url') {
                                return {
                                    type: 'image_url',
                                    image_url: { 
                                        url: part.image_url.blobUrl || part.image_url.url,  // Send blob URL to API
                                        filePath: part.image_url.filePath
                                    }
                                };
                            }
                            if (part.type === 'file_url') {
                                return {
                                    type: 'file_url',
                                    file_url: { 
                                        url: part.file_url.blobUrl || part.file_url.url,  // Send blob URL to API
                                        filePath: part.file_url.filePath,
                                        name: part.file_url.name,
                                        type: part.file_url.type
                                    }
                                };
                            }
                        }
                        return { type: 'text', text: '[Attachment]' };
                    })
                    : msg.content
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    file,
                    sessionId
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader available');

            let assistantMessage = '';
            const userMessages = [...messages, userMessage];
            let firstChunkReceived = false;
            let timeoutId: NodeJS.Timeout | null = null;

            // Set a timeout to create an empty assistant message if no response is received
            if (file?.type.startsWith('image/')) {
                timeoutId = setTimeout(() => {
                    if (!firstChunkReceived) {
                        setIsLoading(false);
                        setIsStreaming(true);
                        setMessages([
                            ...userMessages,
                            {
                                role: 'assistant',
                                content: [{ type: 'text', text: '' }]
                            }
                        ]);
                        firstChunkReceived = true;
                    }
                }, 1000); // 1 second timeout
            }

            const textDecoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Clear timeout if we receive a chunk
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (!firstChunkReceived) {
                    setIsLoading(false);
                    setIsStreaming(true);
                    firstChunkReceived = true;
                }

                const chunk = textDecoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const { content } = JSON.parse(line.slice(6));
                            if (content) {
                                assistantMessage += content;
                                setMessages([
                                    ...userMessages,
                                    {
                                        role: 'assistant',
                                        content: [{ type: 'text', text: assistantMessage }]
                                    }
                                ]);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }

            // Clear timeout if it's still active
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            console.error('Error:', error);
            setIsLoading(false);
        } finally {
            setIsStreaming(false);
        }
    };

    return { messages, isLoading, isStreaming, sendMessage, clearMessages, sessionId };
}