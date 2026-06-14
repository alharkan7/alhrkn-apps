'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatTitle } from './ChatTitle'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useChatMessages } from '../hooks/useChatMessages'
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useFileUpload } from '../hooks/useFileUpload';
import { usePathname } from 'next/navigation'
import { Message } from '../types/types'

interface ChatInterfaceProps {
    initialMessages?: Message[];
    initialSessionId?: string;
}

export function ChatInterface({ initialMessages = [], initialSessionId }: ChatInterfaceProps) {
    const { messages, isLoading, isStreaming, sendMessage, clearMessages, sessionId } = useChatMessages(initialMessages, initialSessionId);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [input, setInput] = useState('');
    const [hasUserSentMessage, setHasUserSentMessage] = useState(initialMessages.length > 0);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const { file, handleFileSelect, clearFile } = useFileUpload();
    const pathname = usePathname();

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                requestAnimationFrame(() => {
                    messagesEndRef.current?.scrollIntoView({ block: 'end' });
                });
            } else {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // Watch for new messages and content changes
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant' || lastMessage.role === 'user') {
                scrollToBottom();
            }
        }
    }, [messages]);

    // Initial scroll
    useEffect(() => {
        scrollToBottom();
    }, []);

    // Update file selection handler
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            await handleFileSelect(selectedFile);
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!hasUserSentMessage) {
            setHasUserSentMessage(true);
            if (pathname === '/chat') {
                window.history.replaceState(null, '', `/chat/${sessionId}`);
            }
        }
        setInput(''); // Clear input immediately after sending

        // Only send if file is uploaded or there's text
        if (text.trim() || (file && file.uploaded)) {
            await sendMessage(text, file);
            clearFile();
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleClearChat = () => {
        clearMessages();
        setHasUserSentMessage(false);
        setInput('');
        clearFile();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (pathname !== '/chat') {
            window.history.replaceState(null, '', '/chat');
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-background">
            {!hasUserSentMessage && (
                <div className="fixed top-0 left-0 right-0 z-50">
                    <AppsHeader />
                </div>
            )}
            <div className={`flex-1 overflow-hidden flex flex-col justify-start max-w-4xl mx-auto w-full px-1 md:px-4 ${!hasUserSentMessage ? 'mt-[20vh]' : ''}`}>
                <div className="flex-none">
                    <ChatTitle
                        clearMessages={handleClearChat}
                        hasUserSentMessage={hasUserSentMessage}
                    />
                </div>
                {hasUserSentMessage && (
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600/50 hover:scrollbar-thumb-zinc-600/70 overflow-x-hidden">
                        <MessageList
                            messages={messages}
                            messagesEndRef={messagesEndRef}
                            onUpdate={scrollToBottom}
                            isLoading={isLoading}
                            isStreaming={isStreaming}
                        />
                    </div>
                )}
                <div className="flex-none py-4 px-2">
                    <ChatInput
                        input={input}
                        setInput={setInput}
                        isLoading={isLoading || isStreaming}
                        fileInputRef={fileInputRef}
                        onFileSelect={handleFileChange}
                        file={file}
                        clearFile={clearFile}
                        sendMessage={handleSendMessage}
                        onFocusChange={setIsInputFocused}
                    />
                </div>

            </div>
            {!hasUserSentMessage && (
                <div className="flex-none mb-1">
                    <AppsFooter />
                </div>
            )}
        </div>
    );
}
