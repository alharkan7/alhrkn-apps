'use client'

import { useState, useRef, useEffect } from 'react'
import { Menu } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useChatMessages } from '../hooks/useChatMessages'
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useFileUpload } from '../hooks/useFileUpload';
import { usePathname } from 'next/navigation'
import { Message } from '../types/types'
import { motion, useReducedMotion } from 'framer-motion'
import { PrimerFontButton } from '@/app/primer/components/PrimerFontButton'

import { toast } from 'sonner'

interface ChatInterfaceProps {
    initialMessages?: Message[];
    initialSessionId?: string;
    isOwner?: boolean;
}

export function ChatInterface({ initialMessages = [], initialSessionId, isOwner = true }: ChatInterfaceProps) {
    const prefersReducedMotion = useReducedMotion();
    const { messages, isLoading, isStreaming, sendMessage, sessionId } = useChatMessages(initialMessages, initialSessionId);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [input, setInput] = useState('');
    const [hasUserSentMessage, setHasUserSentMessage] = useState(initialMessages.length > 0);
    const { file, handleFileSelect, clearFile } = useFileUpload();
    const pathname = usePathname();

    const handleMakeCopy = async () => {
        if (!initialSessionId) return;
        try {
            const res = await fetch(`/api/chat/${initialSessionId}/duplicate`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to duplicate');
            const data = await res.json();
            window.location.href = `/chat/${data.newId}`;
        } catch (error) {
            console.error('Failed to duplicate document', error);
            toast.error('Failed to copy document. Please try again.');
        }
    };

    const handleInteract = (e?: React.SyntheticEvent | Event) => {
        if (!isOwner) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            toast('View Only', {
                description: "You're not the owner of this chat.",
                action: {
                    label: 'Make Copy',
                    onClick: handleMakeCopy
                }
            });
            return false;
        }
        return true;
    };

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

    return (
        <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
                <div className="absolute inset-0 opacity-[0.24] [background-image:radial-gradient(rgba(25,25,24,0.16)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_76%)] dark:opacity-[0.1] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
                <motion.div
                    className="absolute left-1/2 top-[38%] size-72 -translate-x-1/2 rounded-full bg-blue-400/[0.045] blur-3xl dark:bg-blue-500/[0.055]"
                    animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={prefersReducedMotion ? undefined : { duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
                <AppsHeader 
                    title={
                        <Link
                            href="/chat"
                            title="Back to Chat"
                            className="inline-flex items-center text-sm font-semibold tracking-[-0.01em] text-[#191918] no-underline transition-opacity hover:opacity-65 dark:text-[#f2f2ef]"
                        >
                            Chat
                        </Link>
                    }
                    leftButton={
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.dispatchEvent(new CustomEvent('toggleChatHistorySidebar'))}
                            className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
                            title="History"
                            aria-label="Open chat history"
                        >
                            <Menu size={18} />
                        </Button>
                    }
                    rightContent={<PrimerFontButton />}
                />
                {!isOwner && (
                    <div 
                        className="absolute left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none items-center gap-1 whitespace-nowrap rounded-full border border-black/[0.08] bg-white px-3 py-1 font-sans text-xs font-medium text-black/60 shadow-sm transition-colors hover:text-black dark:border-white/[0.1] dark:bg-[#252523] dark:text-white/60 dark:hover:text-white"
                        onClick={handleMakeCopy}
                    >
                        <span>View Only</span>
                    </div>
                )}
            </div>
            <div className={`relative z-10 mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-1 pt-14 md:px-4 ${!hasUserSentMessage ? 'justify-center pb-14' : 'pb-0'}`}>
                {!hasUserSentMessage && (
                    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }} className="flex-none px-4 pb-6 text-center sm:pb-7">
                        <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">
                            What can I help with?
                        </h1>
                    </motion.div>
                )}
                {hasUserSentMessage && (
                    <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-black/15 hover:scrollbar-thumb-black/25 dark:scrollbar-thumb-white/15 dark:hover:scrollbar-thumb-white/25">
                        <MessageList
                            messages={messages}
                            messagesEndRef={messagesEndRef}
                            onUpdate={scrollToBottom}
                            isLoading={isLoading}
                            isStreaming={isStreaming}
                        />
                    </div>
                )}
                <motion.div initial={prefersReducedMotion || hasUserSentMessage ? false : { opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }} className="flex-none px-2 py-4">
                    <ChatInput
                        input={input}
                        setInput={setInput}
                        isLoading={isLoading || isStreaming}
                        fileInputRef={fileInputRef}
                        onFileSelect={handleFileChange}
                        file={file}
                        clearFile={clearFile}
                        sendMessage={handleSendMessage}
                        onInteract={handleInteract}
                    />
                </motion.div>

            </div>
            {!hasUserSentMessage && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
                    <div className="flex-none">
                        <AppsFooter />
                    </div>
                </div>
            )}
        </div>
    );
}
