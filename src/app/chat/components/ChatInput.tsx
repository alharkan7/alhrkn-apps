import { Send, Paperclip, Image } from 'lucide-react'
import { useRef, useState } from 'react'
import { FilePreview } from '@/components/ui/FilePreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form } from '@/components/ui/form'
import { useForm } from 'react-hook-form'

interface ChatInputProps {
    input: string;
    setInput: (input: string) => void;
    isLoading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    clearFile: () => void;
    sendMessage: (text: string, file: { name: string; type: string; url: string } | null) => Promise<void>;
    onFocusChange?: (focused: boolean) => void;
    file: { name: string; type: string; url: string; uploaded?: boolean } | null;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onInteract?: (e?: React.SyntheticEvent) => boolean | void;
}

export function ChatInput({
    input,
    setInput,
    isLoading,
    fileInputRef,
    onFileSelect,
    file,
    clearFile,
    sendMessage,
    onFocusChange,
    onInteract
}: ChatInputProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const form = useForm();
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (onInteract && onInteract(e) === false) return;
        inputRef.current?.blur();

        if ((file && file.uploaded) || input.trim()) {
            const fileToSend = file;  // Store file reference before clearing
            setInput('');
            clearFile();  // Clear file immediately
            await sendMessage(input, fileToSend);  // Use stored file reference
        }
    };

    const handleFileClick = (type: 'file' | 'image', e: React.MouseEvent) => {
        if (onInteract && onInteract(e) === false) return;
        if (fileInputRef.current) {
            fileInputRef.current.accept = type === 'image' ? 'image/*' : '*/*';
            fileInputRef.current.click();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (onInteract && onInteract(e) === false) {
            e.target.blur();
            return;
        }
        console.log('Focus event triggered');
        setIsFocused(true);
        onFocusChange?.(true);
    };

    const handleBlur = () => {
        console.log('Blur event triggered');
        setIsFocused(false);
        onFocusChange?.(false);
    };

    return (
        <>
            <div className="relative flex flex-col gap-2">
                {file && (
                    <div className="w-full flex justify-center">
                        <FilePreview
                            file={file}
                            isUploading={!file.uploaded}
                            onRemove={clearFile}
                        />
                    </div>
                )}
                <div className="relative group w-full max-w-2xl mx-auto">
                    {/* Glowing aura behind the input box */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200 pointer-events-none"></div>
                    <Form {...form}>
                        <form 
                            onSubmit={handleSubmit} 
                            data-focused={isFocused}
                            className={`relative z-10 flex flex-col gap-2 bg-background/80 backdrop-blur-2xl transition-all duration-200 rounded-[2rem] border shadow-xl w-full p-4 ${
                                isFocused ? 'ring-2 ring-primary/20 border-primary/50' : ''
                            }`}
                        >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={file ? "Add a message..." : "Send a message..."}
                            className="w-full bg-transparent border-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none disabled:opacity-50 p-0 resize-none min-h-[40px] max-h-[120px] overflow-y-auto px-1 pb-1"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            rows={1}
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                            }}
                        />
                        <Input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={onFileSelect}
                        />
                        <div className="flex justify-between items-center w-full">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => handleFileClick('file', e)}
                                    className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50 h-10 w-10"
                                    disabled={isLoading || !!file}
                                    aria-label="Attach file"
                                >
                                    <Paperclip className="size-5 text-muted-foreground hover:text-foreground" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => handleFileClick('image', e)}
                                    className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50 h-10 w-10"
                                    disabled={isLoading || !!file}
                                    aria-label="Attach image"
                                >
                                    <Image className="size-5 text-muted-foreground hover:text-foreground" />
                                </Button>
                            </div>
                            <Button
                                type="submit"
                                className="shrink-0 p-2 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] transition-all duration-300 disabled:opacity-50 disabled:shadow-none h-11 w-11"
                                disabled={isLoading || (!input.trim() && (!file || !file.uploaded))}
                                aria-label="Send message"
                            >
                                <Send className="size-5" />
                            </Button>
                        </div>
                    </form>
                </Form>
                </div>
            </div>
        </>
    );
}