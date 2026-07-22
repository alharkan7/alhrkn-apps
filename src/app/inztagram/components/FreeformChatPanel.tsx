'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, LoaderCircle, Paperclip, Send, Sparkles, X } from 'lucide-react';
import type { InztagramMessage } from '../lib/types';
import type { SvgElementSelection } from '../lib/svg-selection';
import { selectionKey } from '../lib/svg-selection';
import { cn } from '@/lib/utils';

interface FreeformChatPanelProps {
  messages: InztagramMessage[];
  loading?: boolean;
  disabled?: boolean;
  onSend: (message: string) => void | Promise<void>;
  error?: string | null;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  /** Canvas element attachments shown above the composer */
  attachments?: SvgElementSelection[];
  onRemoveAttachment?: (key: string) => void;
  onClearAttachments?: () => void;
  onInteract?: (e?: React.SyntheticEvent) => boolean | void;
}

const SUGGESTIONS = [
  'Make the colors softer and more pastel',
  'Add more spacing between boxes',
  'Make the title larger and bolder',
  'Simplify: keep only the core 5 nodes',
];

export function FreeformChatPanel({
  messages,
  loading = false,
  disabled = false,
  onSend,
  error,
  minimized = false,
  onToggleMinimize,
  attachments = [],
  onRemoveAttachment,
  onClearAttachments,
  onInteract,
}: FreeformChatPanelProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (listRef.current && !minimized) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, minimized, attachments.length]);

  const submit = async () => {
    const value = input.trim();
    if (!value || loading || disabled) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSend(value);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (onInteract && onInteract(e) === false) {
      e.target.blur();
      return;
    }
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      setTimeout(() => {
        formRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }, 300);
    });
  };

  return (
    <div
      className={cn(
        'flex flex-col min-h-0 bg-card border rounded-xl shadow-lg overflow-hidden',
        minimized ? 'h-auto' : 'h-full'
      )}
    >
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-b shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm min-w-0">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span className="truncate">Ask for Edits</span>
          {loading && (
            <LoaderCircle className="size-3.5 animate-spin text-muted-foreground shrink-0" />
          )}
          {attachments.length > 0 && (
            <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
              {attachments.length} attached
            </span>
          )}
        </div>
        {onToggleMinimize && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            onClick={onToggleMinimize}
            aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
            aria-expanded={!minimized}
          >
            {minimized ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        )}
      </div>

      {!minimized && (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-3 sm:py-6">
                Click elements on the diagram to attach them, then describe your edit.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}-${msg.createdAt || ''}`}
                suppressHydrationWarning
                className={cn(
                  'w-fit max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto bg-muted text-foreground'
                )}
              >
                {(() => {
                  if (msg.role !== 'user') return msg.content;
                  
                  const match = msg.content.match(/(?:\r?\n){2}---(?:\r?\n)Selected SVG element context/);
                  if (!match) return msg.content;
                  
                  const userText = msg.content.substring(0, match.index);
                  const labelsMatch = [...msg.content.matchAll(/### Element \d+: (.*?)(?:[\r\n]+|- tag:)/g)];
                  
                  if (labelsMatch.length > 0) {
                    const labels = labelsMatch.map(m => m[1].trim()).join(', ');
                    return `${userText}\n\n[Attached: ${labels}]`;
                  }
                  
                  return userText;
                })()}
              </div>
            ))}
            {loading && (
              <div className="mr-auto w-fit max-w-[78%] flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Editing diagram…
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 pb-1 text-xs text-red-500 shrink-0">
              {error.length > 180 ? error.slice(0, 180) + '…' : error}
            </div>
          )}

          {/* Desktop-only prompt suggestions (hidden when attachments are set) */}
          {!loading && messages.length <= 2 && attachments.length === 0 && (
            <div className="hidden md:flex px-3 pb-2 flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading || disabled}
                  onClick={() => onSend(s)}
                  className="text-[11px] px-2 py-1 rounded-full border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Element attachments above composer */}
          {attachments.length > 0 && (
            <div className="px-2 sm:px-3 pt-2 pb-1 border-t shrink-0 space-y-1.5 bg-muted/30">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Paperclip className="size-3" />
                  Selected Elements
                </span>
                {onClearAttachments && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    onClick={onClearAttachments}
                    disabled={loading || disabled}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
                {attachments.map((att) => {
                  const key = selectionKey(att);
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 max-w-full rounded-full border border-primary/30 bg-background px-2 py-0.5 text-xs font-medium"
                      title={att.pathHint}
                    >
                      <span className="truncate max-w-[140px]">{att.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{att.tagName}</span>
                      {onRemoveAttachment && (
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-0.5 hover:bg-muted"
                          aria-label={`Remove ${att.label}`}
                          disabled={loading || disabled}
                          onClick={() => onRemoveAttachment(key)}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <form
            ref={formRef}
            className={cn(
              'p-2 sm:p-3 shrink-0 flex gap-2 items-end bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))]',
              attachments.length === 0 && 'border-t'
            )}
            onSubmit={(e) => {
              e.preventDefault();
              if (onInteract && onInteract(e) === false) return;
              void submit();
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleFocus}
              placeholder={
                attachments.length > 0
                  ? 'Describe changes for the attached elements…'
                  : 'Describe an edit…'
              }
              disabled={loading || disabled}
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm min-h-[44px] max-h-[100px] outline-none focus:ring-2 focus:ring-primary leading-5"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full shrink-0 size-11"
              disabled={loading || disabled || !input.trim()}
              aria-label="Send edit"
            >
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
