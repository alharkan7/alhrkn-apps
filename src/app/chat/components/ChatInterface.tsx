'use client'

import { useState, useRef, useEffect } from 'react'
import { RefreshCcw, Menu, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden relative font-sans">
            {/* --- Ambient Background --- */}
            <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
                {/* Animated Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
                
                {/* Subtle Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            </div>

            {/* --- Top Navigation --- */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
                <AppsHeader 
                    title={hasUserSentMessage ? <><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x font-bold">Ask</span> <span className="font-bold">Al</span></> : undefined}
                    leftButton={
                        <div className="flex items-center gap-2 pl-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.dispatchEvent(new CustomEvent('toggleChatHistorySidebar'))}
                                className="sidebar-toggle"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                            {hasUserSentMessage && (
                                <Button
                                    onClick={handleClearChat}
                                    className="p-2 rounded-lg"
                                    title="Clear chat history"
                                    variant="secondary"
                                >
                                    <Plus size={14} />
                                </Button>
                            )}
                        </div>
                    }
                />
            </div>
            <div className={`relative z-10 flex-1 overflow-hidden flex flex-col justify-start max-w-4xl mx-auto w-full px-1 md:px-4 pt-16 ${!hasUserSentMessage ? 'pb-12' : 'pb-0'}`}>
                {!hasUserSentMessage && (
                    <div className="flex-none mt-[20vh] text-center py-4">
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-2">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x whitespace-nowrap">Ask</span>{' '}
                            <span className="whitespace-nowrap">Al</span>
                        </h1>
                    </div>
                )}
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
                <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
                    <div className="flex-none">
                        <AppsFooter />
                    </div>
                </div>
            )}
        </div>
    );
}
