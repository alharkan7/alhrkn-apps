'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Paperclip, RotateCcw, Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { usePrimerChat, type ChatMessage } from './usePrimerChat';

import type { PrimerOptions } from '../../types';

interface Attachment {
  term: string;
  definition?: string;
}

interface PrimerChatProps {
  title: string;
  topic: string;
  excerpt?: string;
  options?: PrimerOptions;
}

// --- Floating action button (draggable, snaps to a corner) ---

const FAB_SIZE = 52;
const FAB_MARGIN = 20;
const FAB_MARGIN_TOP = 80;
const DRAG_THRESHOLD = 4;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function nearestCorner(x: number, y: number): Corner {
  const left = x < window.innerWidth / 2;
  const top = y < window.innerHeight / 2;
  if (top && left) return 'tl';
  if (top) return 'tr';
  if (left) return 'bl';
  return 'br';
}

function cornerPosition(corner: Corner): { left: number; top: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (corner) {
    case 'tl': return { left: FAB_MARGIN, top: FAB_MARGIN_TOP };
    case 'tr': return { left: w - FAB_SIZE - FAB_MARGIN, top: FAB_MARGIN_TOP };
    case 'bl': return { left: FAB_MARGIN, top: h - FAB_SIZE - FAB_MARGIN };
    default: return { left: w - FAB_SIZE - FAB_MARGIN, top: h - FAB_SIZE - FAB_MARGIN };
  }
}

function ChatFab({ onOpen }: { onOpen: () => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ol: number; ot: number } | null>(null);
  const movedRef = useRef(false);

  // Place at bottom-right before first paint so there is no flash.
  useLayoutEffect(() => {
    setPos(cornerPosition('br'));
  }, []);

  // Keep the button on its nearest corner when the viewport changes.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? cornerPosition(nearestCorner(p.left + FAB_SIZE / 2, p.top + FAB_SIZE / 2)) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ol: pos.left, ot: pos.top };
    movedRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
    setPos({
      left: clamp(d.ol + dx, FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN),
      top: clamp(d.ot + dy, FAB_MARGIN_TOP, window.innerHeight - FAB_SIZE - FAB_MARGIN),
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (!d) return;
    // Snap to the nearest corner only after an actual drag.
    if (movedRef.current) setPos(cornerPosition(nearestCorner(e.clientX, e.clientY)));
  };

  // Click (and keyboard activation) opens the chat unless this was a drag.
  const onClick = () => {
    if (!movedRef.current) onOpen();
  };

  return (
    <button
      type="button"
      aria-label="Open chat"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      onFocus={() => { movedRef.current = false; }}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      className={cn(
        'fixed z-50 flex h-[52px] w-[52px] touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95',
        dragging ? 'cursor-grabbing transition-none' : 'cursor-pointer transition-[left,top,transform] duration-200',
      )}
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}

// --- Message bubble ---

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] px-3 py-2 text-sm leading-relaxed',
          isUser ? 'rounded-2xl rounded-br-sm bg-primary text-primary-foreground' : 'rounded-2xl rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : content ? (
          <MarkdownRenderer compact>{content}</MarkdownRenderer>
        ) : (
          <span className="inline-flex items-center gap-1 py-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          </span>
        )}
      </div>
    </div>
  );
}

// --- Panel ---

interface ChatPanelProps {
  open: boolean;
  title: string;
  attachment: Attachment | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
  onClose: () => void;
}

function ChatPanel({ open, title, attachment, messages, isStreaming, input, setInput, onSend, onStop, onClear, onClose }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus the input shortly after the slide-in finishes.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  // Collapse the textarea back to one row whenever it is cleared (send / clear).
  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = 'auto';
  }, [input]);

  const autoSize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Chat about ${title}`}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'fixed z-[80] flex flex-col bg-background shadow-2xl',
        // Mobile: bottom sheet sliding up.
        'inset-x-0 bottom-0 top-auto h-[55dvh] rounded-t-2xl border-t',
        // Desktop: right sidebar sliding in.
        'md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[400px] md:rounded-none md:border-l md:border-t-0',
        'transition-transform duration-300 ease-out',
        open
          ? 'pointer-events-auto translate-y-0 md:translate-x-0'
          : 'pointer-events-none translate-y-full md:translate-y-0 md:translate-x-full',
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClear} title="Reset chat" disabled={isStreaming || messages.length === 0}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} title="Close chat">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {attachment && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{attachment.term}</span>
            </div>
            {attachment.definition && (
              <div className="[&_.primer-markdown_p:first-child]:mt-0 [&_.primer-markdown_p:last-child]:mb-0">
                <MarkdownRenderer compact>{attachment.definition}</MarkdownRenderer>
              </div>
            )}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            <p>
              Ask anything about this lesson{attachment ? <> or &ldquo;{attachment.term}&rdquo;</> : null}.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={autoSize}
            onKeyDown={onKeyDown}
            placeholder={attachment ? `Ask about “${attachment.term}”…` : 'Ask a question…'}
            rows={1}
            className="max-h-32 min-h-[40px] resize-none rounded-2xl px-4"
          />
          {isStreaming ? (
            <Button size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={onStop} title="Stop generating" aria-label="Stop generating">
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={onSend} disabled={!input.trim()} title="Send" aria-label="Send message">
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Root ---

export function PrimerChat({ title, topic, excerpt, options }: PrimerChatProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [input, setInput] = useState('');

  const { messages, isStreaming, send, stop, clear } = usePrimerChat({
    lessonTitle: title,
    topic,
    excerpt,
    attachment,
    options,
  });

  useEffect(() => setMounted(true), []);

  // Open from a tooltip (or anything dispatching the event) with optional context.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Attachment | undefined;
      setAttachment(detail && typeof detail.term === 'string' && detail.term ? { term: detail.term, definition: detail.definition } : null);
      setOpen(true);
    };
    window.addEventListener('openPrimerChat', handler as EventListener);
    return () => window.removeEventListener('openPrimerChat', handler as EventListener);
  }, []);

  const openFromFab = useCallback(() => {
    setAttachment(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    stop();
    clear();
  }, [stop, clear]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    send(input);
    setInput('');
  }, [input, isStreaming, send]);

  if (!mounted) return null;

  return createPortal(
    <>
      {!open && <ChatFab onOpen={openFromFab} />}
      <ChatPanel
        open={open}
        title={title}
        attachment={attachment}
        messages={messages}
        isStreaming={isStreaming}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onStop={stop}
        onClear={clear}
        onClose={close}
      />
    </>,
    document.body,
  );
}
