import { useEffect, useRef } from 'react';
import { Message } from '@/app/chat/types/types';
import { FilePreview } from '@/components/ui/FilePreview';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { TypingIndicator } from './TypingIndicator';
import { Copy } from 'lucide-react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onUpdate: () => void;
    isLoading: boolean;
    isStreaming: boolean;
}

export function MessageList({ messages, messagesEndRef, isLoading, isStreaming }: MessageListProps) {
    const messageListRef = useRef<HTMLDivElement>(null);
    const prevMessagesLengthRef = useRef(messages.length);

    const handleCopy = async (content: Message['content']) => {
        const text = typeof content === 'string'
            ? content
            : content.map(item => item.type === 'text' ? item.text : '').join('\n');

        await navigator.clipboard.writeText(text);
        toast.success("Content copied to clipboard", {
            className: "max-w-[256px]",
            position: "top-center",
            duration: 1500,
            style: {
                left: '50%',
                transform: 'translateX(-50%)'
            }
        });
    };

    const scrollToBottom = () => {
        if (messageListRef.current && messagesEndRef.current) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            requestAnimationFrame(() => {
                if (isMobile) {
                    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
                } else {
                    messageListRef.current!.scrollTop = messageListRef.current!.scrollHeight;
                }
            });
        }
    };

    useEffect(() => {
        if (messages.length !== prevMessagesLengthRef.current) {
            scrollToBottom();
            prevMessagesLengthRef.current = messages.length;
        }
    }, [messages.length]);

    const renderMessageContent = (content: Message['content']) => {
        try {
            if (typeof content === 'string') {
                const textWithBreaks = content.replace(/\n/g, '  \n');
                return <ReactMarkdown>{textWithBreaks}</ReactMarkdown>;
            }
        
            return content.map((item, idx) => {
                try {
                    switch (item.type) {
                        case 'text':
                            const textWithBreaks = item.text.replace(/\n/g, '  \n');
                            return <ReactMarkdown key={idx}>{textWithBreaks}</ReactMarkdown>;
                        case 'image_url':
                            if (!item.image_url?.url) {
                                console.error('Invalid image URL data');
                                return <div key={idx} className="text-red-500">Error: Invalid image data</div>;
                            }
                            // console.log('Image URL data:', {
                            //     url: item.image_url.url,
                            //     originalUrl: item.image_url.originalUrl,
                            //     blobUrl: item.image_url.blobUrl
                            // });
                            return (
                                <FilePreview
                                    key={idx}
                                    file={{
                                        name: 'image.jpg',
                                        type: 'image/jpeg',
                                        url: item.image_url.url // Let's use the direct URL first for debugging
                                    }}
                                    isUploading={false}
                                    onRemove={() => { }}
                                    isSent={true}
                                    inMessage={true}
                                />
                            );
                        case 'file_url':
                            // console.log('File URL data:', {
                            //     url: item.file_url.url,
                            //     originalUrl: item.file_url.originalUrl,
                            //     blobUrl: item.file_url.blobUrl,
                            //     name: item.file_url.name,
                            //     type: item.file_url.type
                            // });
                            return (
                                <FilePreview
                                    key={idx}
                                    file={{
                                        name: item.file_url.name,
                                        type: item.file_url.type,
                                        url: item.file_url.url // Let's use the direct URL first for debugging
                                    }}
                                    isUploading={false}
                                    onRemove={() => { }}
                                    isSent={true}
                                    inMessage={true}
                                />
                            );
                        default:
                            return null;
                    }
                } catch (error) {
                    console.error('Error rendering message item:', error);
                    return <div key={idx} className="text-red-500">Error rendering content</div>;
                }
            });
        } catch (error) {
            console.error('Error rendering message:', error);
            return <div className="text-red-500">Error rendering message</div>;
        }
    };

    return (
        <div ref={messageListRef} className="h-full overflow-y-auto px-3 pb-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-black/15 hover:scrollbar-thumb-black/25 dark:scrollbar-thumb-white/15 dark:hover:scrollbar-thumb-white/25 sm:px-5">
            <div className="mx-auto mt-5 max-w-3xl space-y-7">
                {messages.map((message, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.2,
                            ease: "easeOut"
                        }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex w-full flex-col gap-1.5 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <motion.div
                                className={`max-w-[88%] px-4 py-3 text-[15px] leading-7 sm:max-w-[82%]
                                ${message.role === 'user'
                                        ? 'ml-auto rounded-[22px] rounded-br-lg bg-black/[0.07] text-[#191918] dark:bg-white/[0.1] dark:text-[#f2f2ef]'
                                        : 'max-w-full px-1 text-[#191918] dark:text-[#f2f2ef]'
                                    }`}
                                style={{ pointerEvents: 'auto' }}
                            >
                                <div className={`chat-message-content prose prose-sm max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mt-2 [&_ol]:mt-2 [&_li]:my-1 [&_ol]:pl-6 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words [&_pre_code]:whitespace-pre-wrap [&_h1]:font-bold [&_h1]:text-lg [&_h1]:mt-4 [&_h1]:mb-2 [&_pre]:mb-4 [&_pre+p]:mt-4 ${
                                    message.role === 'user' 
                                    ? 'text-left dark:prose-invert'
                                    : 'dark:prose-invert'
                                }`}
                                     style={{ pointerEvents: 'auto' }}
                                >
                                    {renderMessageContent(message.content)}
                                </div>
                            </motion.div>
                            {message.role === 'assistant' && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="ml-0 size-8 self-start rounded-lg border-0 bg-transparent text-black/35 shadow-none transition-colors hover:bg-black/[0.045] hover:text-black dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white"
                                    onClick={() => handleCopy(message.content)}
                                    title="Copy message"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </motion.div>
                ))}
                <AnimatePresence>
                    {(isLoading || isStreaming) && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex justify-start"
                        >
                            <TypingIndicator />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div ref={messagesEndRef} />
        </div>
    );
}
