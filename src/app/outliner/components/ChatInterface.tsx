'use client';

import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Lightbulb, User, RotateCcw, Paperclip, X, File, Image, Copy, Check, FileText} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileAttachment[];
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  documentContext?: string;
  selectedText?: string;
}

export function ChatInterface({ isOpen, onClose, documentContext, selectedText }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I can help you with your paper draft, answer questions, or assist with writing.',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [attachedSelectedText, setAttachedSelectedText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Update selected text when prop changes
  useEffect(() => {
    if (selectedText) {
      setAttachedSelectedText(selectedText);
    }
  }, [selectedText]);

  const sendMessage = async () => {
    if ((!inputMessage.trim() && attachedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? attachedFiles : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    const currentFiles = [...attachedFiles];
    const currentSelectedText = attachedSelectedText;
    setInputMessage('');
    setAttachedFiles([]);
    setAttachedSelectedText(''); // Clear selected text after sending
    setIsLoading(true);

    // Create streaming assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    // Combine selected text with user input if both exist
    const finalMessage = currentSelectedText && currentInput
      ? `Selected text: "${currentSelectedText}"\n\nUser question: ${currentInput}`
      : currentSelectedText
        ? `Selected text: "${currentSelectedText}"`
        : currentInput;

    try {
      const response = await fetch('/api/outliner/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: finalMessage,
          context: documentContext,
          history: messages.slice(-10),
          files: currentFiles
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Mark streaming as complete
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          ));
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk' && data.content) {
                accumulatedContent += data.content;

                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Streaming error');
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);

      // Replace streaming message with error message
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
            ...msg,
            content: 'Sorry, I encountered an error. Please try again.',
            isStreaming: false
          }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant. I can help you with your research paper, answer questions, or assist with writing. What would you like to know?',
        timestamp: new Date()
      }
    ]);
  };

  // File handling functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const geminiSupportedTypes = [
      // Images
      'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
      // Documents
      'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Audio
      'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/mpga', 'audio/m4a', 'audio/wav',
      'audio/webm', 'audio/ogg', 'audio/flac',
      // Video
      'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg',
      'video/webm', 'video/wmv', 'video/3gpp'
    ];

    Array.from(files).forEach(file => {
      if (geminiSupportedTypes.includes(file.type) || file.name.match(/\.(py|js|ts|html|css|java|c|cpp|php|rb|go|rs|swift|kt)$/i)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Data = e.target?.result as string;
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data.split(',')[1] // Remove data:image/jpeg;base64, prefix
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        alert(`File type ${file.type} is not supported by Gemini. Please upload images, documents, audio, or video files.`);
      }
    });

    // Reset file input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" closeClassName="top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-black/45 opacity-100 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white sm:top-6" className="flex w-[min(100vw,460px)] flex-col border-l border-black/[0.08] bg-[#f7f7f5] !p-4 text-[#191918] shadow-[-16px_0_48px_rgba(25,25,24,0.08)] dark:border-white/[0.1] dark:bg-[#10100f] dark:text-[#f2f2ef] sm:w-[480px] sm:!p-6">
        <SheetHeader className="border-b border-black/[0.07] bg-[#f7f7f5] pb-4 pr-14 dark:border-white/[0.08] dark:bg-[#10100f]">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <SheetTitle className="text-base font-semibold tracking-[-0.01em] text-[#191918] dark:text-[#f2f2ef]">
              Chat Assistant
            </SheetTitle>
            <Button
              variant="icon"
              size="icon"
              onClick={clearChat}
              className="h-8 w-8 rounded-lg text-black/45 hover:bg-black/[0.06] hover:text-[#191918] dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          {/* Messages */}
          <div className="mb-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-black/[0.07] bg-white text-[#191918] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-[#f2f2ef]">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user'
                      ? 'rounded-br-md bg-[#191918] text-white dark:bg-[#f2f2ef] dark:text-[#191918]'
                      : 'rounded-bl-md border border-black/[0.07] bg-white/80 text-[#191918] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-[#f2f2ef]'
                    }`}
                >
                  {/* File attachments display */}
                  {message.files && message.files.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {message.files.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted rounded px-2 py-1">
                          {file.type.startsWith('image/') ? (
                            <Image className="h-3 w-3" />
                          ) : (
                            <File className="h-3 w-3" />
                          )}
                          <span className="text-xs truncate">{file.name}</span>
                          <span className="text-xs opacity-70">
                            ({(file.size / 1024).toFixed(1)}KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message content with markdown rendering */}
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-[15px] leading-relaxed">
                      {message.isStreaming && !message.content ? (
                        // Show typing indicator inside bubble when no content yet
                        <div className="flex items-center gap-1 py-2">
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40"></div>
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40" style={{ animationDelay: '0.1s' }}></div>
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-md text-sm"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={`${className} bg-muted px-1 py-0.5 rounded text-xs`} {...props}>
                                  {children}
                                </code>
                              );
                            },
                            // Custom styling for other elements
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Copy button for assistant messages */}
                  {message.role === 'assistant' && message.content && !message.isStreaming && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => copyToClipboard(message.content, message.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                        title="Copy to clipboard"
                      >
                        {copiedMessageId === message.id ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}

                </div>
                {message.role === 'user' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-black/[0.07] bg-black/[0.05] text-[#191918] dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-[#f2f2ef]">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* File attachments display */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 space-y-1">
              {attachedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-black/[0.07] bg-black/[0.025] px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <Paperclip className="h-3 w-3 text-black/45 dark:text-white/45" />
                  <span className="flex-1 truncate text-xs text-black/65 dark:text-white/65">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="rounded-md p-0.5 text-black/40 hover:bg-black/[0.06] hover:text-red-600 dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-red-400"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected text attachment cue */}
          {attachedSelectedText && (
            <div className="mb-2 rounded-xl border border-black/[0.07] bg-black/[0.025] p-2.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-4 w-4 flex-shrink-0">
                  <FileText className="h-3 w-3 text-black/45 dark:text-white/45" />
                </div>
                <div className="flex-1">
                  <div className="rounded-lg border border-black/[0.07] bg-white/80 px-2 py-1.5 text-xs text-black/65 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/65">
                    <div className="line-clamp-3 italic leading-5">
                      "{attachedSelectedText.length > 80 ? attachedSelectedText.substring(0, 80) + '...' : attachedSelectedText}"
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAttachedSelectedText('')}
                  className="flex-shrink-0 rounded-md p-0.5 text-black/40 hover:bg-black/[0.06] hover:text-red-600 dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-red-400"
                  title="Remove attached text"
                  aria-label="Remove selected text"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="mb-2 flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-[0_4px_16px_rgba(25,25,24,0.05)] transition-shadow focus-within:border-black/[0.16] focus-within:shadow-[0_6px_22px_rgba(25,25,24,0.08)] dark:border-white/[0.1] dark:bg-white/[0.05] dark:shadow-none dark:focus-within:border-white/[0.18]">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.txt,.docx,.pptx,.xlsx,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,.flac,.mov,.avi,.flv,.mpg,.wmv,.3gp,.py,.js,.ts,.html,.css,.java,.c,.cpp,.php,.rb,.go,.rs,.swift,.kt"
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-10 w-10 shrink-0 rounded-xl border-0 bg-black/[0.04] p-0 text-black/55 shadow-none hover:bg-black/[0.08] hover:text-[#191918] dark:bg-white/[0.07] dark:text-white/55 dark:hover:bg-white/[0.12] dark:hover:text-white"
              aria-label="Attach a file"
              title="Attach a file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              onClick={sendMessage}
              disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isLoading}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl bg-[#191918] text-white shadow-[0_3px_10px_rgba(25,25,24,0.16)] hover:bg-black dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
              aria-label="Send message"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>


        </div>
      </SheetContent>
    </Sheet>
  );
}
