'use client';

import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, User, Trash2, Paperclip, X, File, Image, Copy, Check, FileText} from 'lucide-react';
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
      <SheetContent side="right" className="w-[400px] sm:w-[500px] !p-6 border-l border-border/50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.1)] flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-xl font-bold">
              Chat Assistant
            </SheetTitle>
            <Button
              variant="icon"
              size="sm"
              onClick={clearChat}
              className="text-xs h-8 px-2 mr-6"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex flex-col h-full mt-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-accent-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-3xl px-5 py-3 shadow-sm ${message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-muted/60 backdrop-blur-sm text-foreground rounded-bl-sm border border-border/50'
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
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
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
                <div key={index} className="flex items-center gap-2 bg-secondary rounded px-2 py-1">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-secondary-foreground flex-1 truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected text attachment cue */}
          {attachedSelectedText && (
            <div className="mb-2 p-2 bg-accent border border-border rounded">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-4 h-4 mt-0.5">
                  <FileText className="h-3 w-3 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-accent-foreground bg-background rounded px-2 py-1 border">
                    <div className="line-clamp-3 italic">
                      "{attachedSelectedText.length > 80 ? attachedSelectedText.substring(0, 80) + '...' : attachedSelectedText}"
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAttachedSelectedText('')}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  title="Remove attached text"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 mb-12">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 rounded-full bg-muted/50 border-border/50 focus-visible:ring-blue-500/50 px-5"
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
              className="rounded-full h-10 w-10 shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              onClick={sendMessage}
              disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isLoading}
              size="icon"
              className="rounded-full h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>


        </div>
      </SheetContent>
    </Sheet>
  );
}
