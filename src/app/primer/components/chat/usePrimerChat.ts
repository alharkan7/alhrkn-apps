'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  lessonTitle: string;
  topic: string;
  excerpt?: string;
  attachment?: { term: string; definition?: string } | null;
}

/**
 * Ephemeral chat state for the Primer lesson view. Owns the message list and the
 * streaming reader against /api/primer/chat. The full conversation is sent every
 * turn (the server is stateless) along with the reading context, so the system
 * prompt always reflects the current lesson + tooltip attachment.
 */
export function usePrimerChat(context: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs mirror state so the send/stop callbacks stay stable and always read the
  // latest values without re-creating on every render.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const contextRef = useRef(context);
  contextRef.current = context;
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const history = [...messagesRef.current, userMessage];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/primer/chat', {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: contextRef.current }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: acc }]);
      }
      acc += decoder.decode();
      if (!acc.trim()) throw new Error('The assistant returned an empty reply.');
      setMessages([...history, { role: 'assistant', content: acc }]);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Keep whatever streamed; just drop an empty placeholder assistant bubble.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
        return;
      }
      console.error('primer chat failed', error);
      setMessages([...history, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming]);

  // Abort any in-flight stream if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { messages, isStreaming, send, stop, clear };
}
