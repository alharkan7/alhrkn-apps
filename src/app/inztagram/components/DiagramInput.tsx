import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Dices, ChevronDown, LoaderCircle, Sparkles } from 'lucide-react';
import { DIAGRAM_TYPES, DIAGRAM_THEMES } from './diagram-types';
import { FREEFORM_LAYOUTS } from './freeform-layouts';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import styles from './DiagramInput.module.css';
import type { InztagramMode } from '../lib/types';
import { motion } from 'framer-motion';

interface DiagramInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onFocusChange?: (focused: boolean) => void;
  /** type = mermaid diagram type; freeformLayout = freeform layout id */
  onSend?: (
    value: string,
    type: string,
    theme: string,
    pdfUrl?: string,
    pdfName?: string,
    freeformLayout?: string
  ) => void;
  pdfFile?: { name: string; type: string; url: string; uploaded?: boolean } | null;
  uploading?: boolean;
  onFileSelect?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile?: () => void;
  onRandomize?: () => void;
  mode?: InztagramMode;
  onModeChange?: (mode: InztagramMode) => void;
}

export function DiagramInput({
  value,
  onChange,
  placeholder = 'Type a message...',
  disabled = false,
  loading = false,
  onFocusChange,
  onSend,
  pdfFile,
  uploading,
  onFileSelect,
  onClearFile,
  onRandomize,
  mode = 'freeform',
  onModeChange,
}: DiagramInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [diagramType, setDiagramType] = useState<string | undefined>(undefined);
  const [freeformLayout, setFreeformLayout] = useState<string | undefined>(undefined);
  const [diagramTheme, setDiagramTheme] = useState(DIAGRAM_THEMES[0].value);
  const [open, setOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  // Preload mermaid type + freeform layout preview images
  useEffect(() => {
    if (typeof window !== 'undefined') {
      DIAGRAM_TYPES.forEach((type) => {
        const img = new window.Image();
        img.src = type.image;
      });
      FREEFORM_LAYOUTS.forEach((layout) => {
        const img = new window.Image();
        img.src = layout.image;
      });
    }
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange?.(false);
  };

  const freeformLayoutLabel = freeformLayout
    ? FREEFORM_LAYOUTS.find((l) => l.id === freeformLayout)?.label
    : undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (onSend) {
          onSend(
            value,
            mode === 'mermaid' ? (diagramType ?? '') : '',
            diagramTheme,
            pdfFile?.url,
            pdfFile?.name,
            mode === 'freeform' ? freeformLayout : undefined
          );
        }
      }}
      className={cn(
        'relative mx-auto flex w-full max-w-2xl flex-col rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] outline-none transition-[box-shadow,transform] duration-300 dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-4',
        isFocused && 'shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(59,130,246,0.11)] dark:shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_0_3px_rgba(96,165,250,0.12)]'
      )}
    >
      <div className="flex w-full flex-col gap-2">
        {/* Mode toggle */}
        <div className="flex items-center px-1">
          <div className="inline-flex gap-0.5 rounded-xl border border-black/[0.065] bg-black/[0.035] p-1 dark:border-white/[0.08] dark:bg-white/[0.045]">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => onModeChange?.('freeform')}
              className={cn(
                'relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-3.5',
                mode === 'freeform'
                  ? 'text-white dark:text-[#191918]'
                  : 'text-black/42 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70'
              )}
            >
              {mode === 'freeform' && (
                <motion.span
                  layoutId="inztagram-mode-selection"
                  className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]"
                  transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                />
              )}
              <span className="relative z-10">Freeform</span>
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => onModeChange?.('mermaid')}
              className={cn(
                'relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-3.5',
                mode === 'mermaid'
                  ? 'text-white dark:text-[#191918]'
                  : 'text-black/42 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70'
              )}
            >
              {mode === 'mermaid' && (
                <motion.span
                  layoutId="inztagram-mode-selection"
                  className="absolute inset-0 rounded-lg bg-[#191918] shadow-[0_2px_7px_rgba(25,25,24,0.18)] dark:bg-[#f2f2ef] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)]"
                  transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                />
              )}
              <span className="relative z-10">Mermaid</span>
            </button>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="my-1 min-h-[88px] max-h-[180px] w-full resize-none overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none outline-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:min-h-[92px] sm:px-3 sm:text-lg"
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={1}
          style={{ height: 'auto', maxHeight: '150px', overflowY: 'auto' }}
          disabled={disabled || loading}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
          {...{
            ...(typeof window !== 'undefined' && {
              ref: (el: HTMLTextAreaElement | null) => {
                inputRef.current = el;
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              },
            }),
          }}
        />
        <Input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf"
          onChange={onFileSelect}
        />
        <div className="flex w-full flex-row items-center justify-between gap-2 border-t border-black/[0.055] pt-3 dark:border-white/[0.07]">
          <div className="flex min-w-0 flex-1 flex-row flex-wrap gap-2">
            {/* Freeform layout picker (replaces randomize in freeform mode) */}
            {mode === 'freeform' && (
              <Popover open={layoutOpen} onOpenChange={setLayoutOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-auto min-w-0 max-w-[180px] justify-between gap-2 rounded-xl border border-black/[0.07] bg-black/[0.025] px-3 text-xs font-medium text-black/60 shadow-none hover:bg-black/[0.05] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/60 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    disabled={disabled || loading}
                    aria-label="Select freeform layout"
                  >
                    <span className="truncate block max-w-[90px] sm:max-w-[70px]">
                      {freeformLayoutLabel || 'Auto'}
                    </span>
                    <ChevronDown className="size-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="py-2 !pl-2 pr-2 md:pr-1 w-[350px] max-w-[95vw] !mx-2">
                  <div
                    className={cn(
                      styles['diagram-scrollbar'],
                      'grid grid-cols-2 gap-2 max-h-[300px] overflow-auto'
                    )}
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex flex-col items-center justify-between h-[110px] rounded-md border bg-background p-2 transition-colors hover:bg-accent focus:outline-none',
                        !freeformLayout && 'ring-2 ring-primary border-primary'
                      )}
                      onClick={() => {
                        setFreeformLayout(undefined);
                        setLayoutOpen(false);
                      }}
                    >
                      <div className="flex-1 w-full flex items-center justify-center">
                        <div className="w-full h-[60px] flex items-center justify-center rounded text-xs text-muted-foreground/80">
                          <Sparkles className="size-6" />
                        </div>
                      </div>
                      <span className="text-xs font-medium mt-1 mb-0">Auto</span>
                    </button>
                    {FREEFORM_LAYOUTS.map((layout) => (
                      <button
                        type="button"
                        key={layout.id}
                        className={cn(
                          'flex flex-col items-center justify-between h-[110px] rounded-md border bg-background p-2 transition-colors hover:bg-accent focus:outline-none',
                          freeformLayout === layout.id && 'ring-2 ring-primary border-primary'
                        )}
                        onClick={() => {
                          setFreeformLayout(layout.id);
                          setLayoutOpen(false);
                        }}
                      >
                        <div className="flex-1 w-full flex items-center justify-center">
                          <Image
                            src={layout.image}
                            alt={layout.label}
                            width={80}
                            height={60}
                            className="w-full h-[60px] bg-white object-contain rounded border border-border"
                          />
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-1 mt-1 mb-0 w-full">
                          {layout.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Mermaid diagram type picker */}
            {mode === 'mermaid' && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-auto min-w-0 max-w-[180px] justify-between gap-2 rounded-xl border border-black/[0.07] bg-black/[0.025] px-3 text-xs font-medium text-black/60 shadow-none hover:bg-black/[0.05] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/60 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    disabled={disabled || loading}
                    aria-label="Select diagram type"
                  >
                    {diagramType ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate block max-w-[80px] sm:max-w-[60px]">
                          {DIAGRAM_TYPES.find((t) => t.value === diagramType)?.label}
                        </span>
                      </span>
                    ) : (
                      <span className="truncate block max-w-[80px] sm:max-w-[60px]">Auto</span>
                    )}
                    <ChevronDown className="size-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="py-2 !pl-2 pr-2 md:pr-1 w-[350px] max-w-[95vw] !mx-2">
                  <div
                    className={cn(
                      styles['diagram-scrollbar'],
                      'grid grid-cols-2 gap-2 max-h-[300px] overflow-auto'
                    )}
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex flex-col items-center justify-between h-[110px] rounded-md border bg-background p-2 transition-colors hover:bg-accent focus:outline-none',
                        !diagramType && 'ring-2 ring-primary border-primary'
                      )}
                      onClick={() => {
                        setDiagramType(undefined);
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 w-full flex items-center justify-center">
                        <div className="w-full h-[60px] flex items-center justify-center rounded text-xs text-muted-foreground/80">
                          <Sparkles className="size-6" />
                        </div>
                      </div>
                      <span className="text-xs font-medium mt-1 mb-0">Auto</span>
                    </button>
                    {DIAGRAM_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type.value}
                        className={cn(
                          'flex flex-col items-center justify-between h-[110px] rounded-md border bg-background p-2 transition-colors hover:bg-accent focus:outline-none',
                          diagramType === type.value && 'ring-2 ring-primary border-primary'
                        )}
                        onClick={() => {
                          setDiagramType(type.value);
                          setOpen(false);
                        }}
                      >
                        <div className="flex-1 w-full flex items-center justify-center">
                          <Image
                            src={type.image}
                            alt={type.label}
                            width={80}
                            height={60}
                            className="w-full h-[60px] bg-white object-contain rounded border border-border"
                          />
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-2 mt-1 mb-0 w-full">
                          {type.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Randomize only for Mermaid mode */}
            {mode === 'mermaid' && (
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-xl border-black/[0.07] bg-transparent p-2 text-black/55 shadow-none transition-colors hover:bg-black/[0.05] dark:border-white/[0.08] dark:text-white/55 dark:hover:bg-white/[0.07]"
                disabled={disabled || loading || !!pdfFile}
                aria-label="Randomize Diagram"
                type="button"
                onClick={onRandomize}
              >
                <Dices className="size-5" />
              </Button>
            )}
          </div>
          <Button
            type="submit"
            className="group h-10 shrink-0 grow-0 rounded-xl bg-[#191918] px-3.5 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white sm:px-4"
            disabled={disabled || loading || uploading || (!value.trim() && !pdfFile)}
            aria-label="Send diagram"
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Creating
              </>
            ) : (
              <>
                <span>Create</span>
                <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} />
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
