import { ArrowUp, Image } from 'lucide-react'
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
        setIsFocused(true);
        onFocusChange?.(true);
    };

    const handleBlur = () => {
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
                <div className="relative mx-auto w-full max-w-2xl">
                    <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
                    <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.07] blur-2xl dark:bg-black/35" />
                    <Form {...form}>
                        <form 
                            onSubmit={handleSubmit} 
                            data-focused={isFocused}
                            className="relative z-10 flex w-full flex-col gap-2 rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] transition-shadow duration-300 focus-within:shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(59,130,246,0.08)] dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] dark:focus-within:shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_0_3px_rgba(96,165,250,0.1)] sm:p-4"
                        >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={file ? "Add a message..." : "Send a message..."}
                            className="max-h-[160px] min-h-[52px] w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-[16px] leading-6 text-[#191918] outline-none placeholder:text-black/27 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3"
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
                        <div className="flex w-full items-center justify-between border-t border-black/[0.055] px-1 pt-3 dark:border-white/[0.07]">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => handleFileClick('image', e)}
                                    className="size-9 shrink-0 rounded-xl border border-black/[0.065] bg-black/[0.025] p-2 text-black/45 shadow-none hover:bg-black/[0.055] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/45 dark:hover:bg-white/[0.07] dark:hover:text-white"
                                    disabled={isLoading || !!file}
                                    aria-label="Attach image"
                                >
                                    <Image className="size-4" />
                                </Button>
                            </div>
                            <Button
                                type="submit"
                                className="group size-10 shrink-0 rounded-xl bg-[#191918] p-2 text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 disabled:shadow-none dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
                                disabled={isLoading || (!input.trim() && (!file || !file.uploaded))}
                                aria-label="Send message"
                            >
                                <ArrowUp className="size-5 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} />
                            </Button>
                        </div>
                    </form>
                </Form>
                </div>
            </div>
        </>
    );
}
