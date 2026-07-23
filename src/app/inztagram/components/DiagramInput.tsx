import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, LoaderCircle, Paperclip, Dices, ChevronDown } from 'lucide-react';
import { DIAGRAM_TYPES, DIAGRAM_THEMES } from './diagram-types';
import { FREEFORM_LAYOUTS } from './freeform-layouts';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import styles from './DiagramInput.module.css';
import type { InztagramMode } from '../lib/types';

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

  const handleFileButtonClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
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
      className={`relative flex flex-col bg-background/80 backdrop-blur-2xl transition-all duration-200 max-w-2xl mx-auto w-full rounded-[2rem] border shadow-xl p-4 sm:p-6 pb-4 focus:outline-none 
        ${isFocused ? 'ring-2 ring-primary border-primary' : ''}`}
    >
      <div className="flex flex-col gap-2 w-full">
        {/* Mode toggle */}
        <div className="flex justify-center sm:justify-start">
          <div className="inline-flex rounded-full border bg-muted/60 p-1 gap-0.5">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => onModeChange?.('freeform')}
              className={cn(
                'px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors',
                mode === 'freeform'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Freeform
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => onModeChange?.('mermaid')}
              className={cn(
                'px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors',
                mode === 'mermaid'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Mermaid
            </button>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full mt-2 mb-2 bg-transparent border-none text-xl placeholder:text-muted-foreground/50 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 px-2 shadow-none min-h-[80px] max-h-[150px] overflow-y-auto py-2 outline-none resize-none break-words whitespace-pre-wrap"
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={1}
          style={{ height: 'auto', maxHeight: '150px', overflowY: 'auto' }}
          disabled={disabled || loading}
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
        <div className="flex flex-row md:flex-row gap-2 mb-2 items-center md:justify-between w-full">
          <div className="flex flex-row flex-wrap gap-2 flex-1 min-w-0">
            {/* Freeform layout picker (replaces randomize in freeform mode) */}
            {mode === 'freeform' && (
              <Popover open={layoutOpen} onOpenChange={setLayoutOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    className="w-auto max-w-[200px] md:max-w-[120px] sm:max-w-[100px] flex items-center gap-2 justify-between px-3 min-w-0 rounded-full"
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
                    variant="default"
                    className="w-auto max-w-[200px] md:max-w-[100px] sm:max-w-[80px] flex items-center gap-2 justify-between px-3 min-w-0 rounded-full"
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
                className="shrink-0 p-2 transition-colors disabled:opacity-50 rounded-full"
                disabled={disabled || loading || !!pdfFile}
                aria-label="Randomize Diagram"
                type="button"
                onClick={onRandomize}
              >
                <Dices className="size-5" />
              </Button>
            )}
          </div>
          {/* <Button
            type="button"
            variant="outline"
            onClick={handleFileButtonClick}
            className="shrink-0 p-2 transition-colors disabled:opacity-50 rounded-full"
            disabled={disabled || loading || !!pdfFile}
            aria-label="Attach PDF"
          >
            <Paperclip className="size-5" />
          </Button> */}
          <Button
            type="submit"
            className="shrink-0 grow-0 transition-colors disabled:opacity-50 w-auto rounded-full font-semibold px-6 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            disabled={disabled || loading || uploading || (!value.trim() && !pdfFile)}
            aria-label="Send diagram"
          >
            {loading ? (
              <>
                <LoaderCircle className="size-5 animate-spin" /> Creating
              </>
            ) : (
              <>
                <Sparkles className="size-5" /> Create
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
