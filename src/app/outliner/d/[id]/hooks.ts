import { useRef, useState, useCallback, useEffect } from 'react';
import EditorJS from '@editorjs/editorjs';
import { ResearchIdea } from './utils';

// Custom hook for debounced callbacks
export function useDebouncedCallback<T extends any[]>(fn: (...args: T) => void, delayMs = 500) {
    const timeoutRef = useRef<number | null>(null);
    return useCallback((...args: T) => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => fn(...args), delayMs);
    }, [fn, delayMs]);
}

// Main document editor hook
export function useDocumentEditor(id: string, idea: ResearchIdea, language: 'en' | 'id', initialContent?: any) {
    // Editor refs
    const editorRef = useRef<EditorJS | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const holderId = `outliner-editor-${id}`;
    
    // Mini toolbar refs
    const miniToolbarRef = useRef<HTMLDivElement | null>(null);
    const selectionHandlerRef = useRef<((this: Document, ev: Event) => any) | null>(null);
    const scrollHandlerRef = useRef<((this: Window, ev: Event) => any) | null>(null);
    const pointerUpHandlerRef = useRef<((this: HTMLElement, ev: Event) => any) | null>(null);
    const keyHandlerRef = useRef<((this: Document, ev: Event) => any) | null>(null);
    const inputHandlerRef = useRef<((this: Document, ev: Event) => any) | null>(null);
    const showDelayTimerRef = useRef<number | null>(null);
    const suppressUntilNextPointerRef = useRef<boolean>(false);
    const warmedToolsRef = useRef<boolean>(false);
    const lastScrollTsRef = useRef<number>(0);
    const rescheduleCountRef = useRef<number>(0);

    // Editor state
    const [isReady, setIsReady] = useState(false);

    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingBlocks, setStreamingBlocks] = useState<any[]>([]);
    const streamingInitiatedRef = useRef(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const markdownBufferRef = useRef<string>('');
    const streamingRenderTimerRef = useRef<number | null>(null);
    const lastAppliedBlocksRef = useRef<any[]>([]);

    // Save to DB state
    const [isSavingToDB, setIsSavingToDB] = useState(false);
    const [isSavedToDB, setIsSavedToDB] = useState(false);

    // Email form state
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [pendingDownloadAction, setPendingDownloadAction] = useState<(() => void) | null>(null);
    const [pendingDownloadFormat, setPendingDownloadFormat] = useState<string>('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    // Chat state
    const [showChat, setShowChat] = useState(false);
    const [documentContext, setDocumentContext] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string>('');

    // Email handlers
    const initiateDownload = useCallback((format: string, downloadAction: () => void) => {
        setPendingDownloadFormat(format);
        setPendingDownloadAction(() => downloadAction);
        setShowEmailForm(true);
    }, []);

    const handleEmailSubmit = useCallback(async (email: string) => {
        setEmailLoading(true);
        setEmailError(null);
        try {
            // Send email and download format to backend
            fetch('/api/outliner/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    downloadFormat: pendingDownloadFormat,
                    fileName: idea.title || 'document'
                }),
            }).catch(() => { });

            // Trigger the download immediately
            if (pendingDownloadAction) pendingDownloadAction();
            setShowEmailForm(false);
            setPendingDownloadAction(null);
            setPendingDownloadFormat('');
        } catch (err) {
            setEmailError('Failed to process your request. Please try again.');
        } finally {
            setEmailLoading(false);
        }
    }, [pendingDownloadAction, pendingDownloadFormat, idea.title]);

    // Chat handlers
    const handleOpenChat = useCallback(async (selectedText?: string) => {
        // Get document context before opening chat
        const context = await getDocumentContext();

        // Store the selected text separately for the UI cue
        if (selectedText) {
            setSelectedText(selectedText);
        }

        setDocumentContext(context);
        setShowChat(true);
    }, []);

    const handleCloseChat = useCallback(() => {
        setShowChat(false);
        setSelectedText(''); // Clear selected text when closing
    }, []);

    // Get document context for chat
    const getDocumentContext = useCallback(async (): Promise<string> => {
        if (!editorRef.current) return '';
        try {
            const data = await editorRef.current.save();
            // Import the conversion function here to avoid circular dependency
            const { convertToPlainText } = await import('./utils');
            const plainText = convertToPlainText(data);
            return `Document Title: ${idea.title}\n\nContent:\n${plainText}`;
        } catch (error) {
            console.error('Error getting document context:', error);
            return `Document Title: ${idea.title}`;
        }
    }, [idea.title]);

    // Document save functionality
    const saveDocLocal = useCallback(async () => {
        if (!editorRef.current) return;
        try {
            const data = await editorRef.current.save();
            localStorage.setItem(`outliner:${id}:doc`, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving document locally:', error);
        }
    }, [id]);

    const debouncedSave = useDebouncedCallback(saveDocLocal, 600);

    const saveToDB = useCallback(async () => {
        if (!editorRef.current) return;
        setIsSavingToDB(true);
        setIsSavedToDB(false);
        try {
            const data = await editorRef.current.save();
            const res = await fetch(`/api/outliner/drafts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: data }),
            });
            if (!res.ok) throw new Error('Failed to save to DB');
            // Toast or visual feedback could go here
            console.log('Saved to DB successfully');
            setIsSavedToDB(true);
            setTimeout(() => setIsSavedToDB(false), 2000);
        } catch (error) {
            console.error('Error saving to DB:', error);
        } finally {
            setIsSavingToDB(false);
        }
    }, [id]);

    // Function to create skeleton blocks for streaming
    const createSkeletonBlocks = useCallback(() => {
        const isIndonesian = language === 'id';
        return [
            {
                type: 'header',
                data: {
                    text: idea.title || (isIndonesian ? 'Judul Penelitian' : 'Research Title'),
                    level: 1
                }
            },
            {
                type: 'header',
                data: {
                    text: isIndonesian ? '1. Pendahuluan' : '1. Introduction',
                    level: 2
                }
            },
            {
                type: 'paragraph',
                data: {
                    text: '<div class="loading-skeleton" style="height: 20px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;"></div>'
                }
            },
            {
                type: 'header',
                data: {
                    text: isIndonesian ? '2. Metodologi' : '2. Methodology',
                    level: 2
                }
            },
            {
                type: 'paragraph',
                data: {
                    text: '<div class="loading-skeleton" style="height: 20px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;"></div>'
                }
            },
            {
                type: 'header',
                data: {
                    text: isIndonesian ? '3. Dampak yang Diharapkan' : '3. Expected Impact',
                    level: 2
                }
            },
            {
                type: 'paragraph',
                data: {
                    text: '<div class="loading-skeleton" style="height: 20px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;"></div>'
                }
            }
        ];
    }, [idea.title, language]);

    // Function to start streaming the expanded outline
    const startStreaming = useCallback(async () => {
        if (streamingInitiatedRef.current || !idea) return;

        console.log('Starting outline expansion stream...');
        streamingInitiatedRef.current = true;
        setIsStreaming(true);

        // Initialize with empty blocks
        const emptyBlocks: any[] = [];
        setStreamingBlocks(emptyBlocks);

        try {
            // Use fetch with POST and stream the body
            const response = await fetch('/api/outliner/expand-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, language }),
            });

            if (!response.ok) {
                throw new Error('Failed to start streaming');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No reader available');
            }

            let buffer = '';
            const newBlocks: any[] = [];

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('Streaming completed');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('Received streaming data:', data);

                            if (data.type === 'chunk' && typeof data.text === 'string') {
                                // Accumulate markdown and convert to blocks with throttled rendering
                                markdownBufferRef.current += data.text;
                                const { convertMarkdownToEditorJS } = await import('./utils');
                                const blocks = convertMarkdownToEditorJS(markdownBufferRef.current);
                                setStreamingBlocks(blocks);
                                if (editorRef.current) {
                                    if (streamingRenderTimerRef.current) {
                                        try { window.clearTimeout(streamingRenderTimerRef.current); } catch { }
                                    }
                                    streamingRenderTimerRef.current = window.setTimeout(async () => {
                                        try {
                                            await applyBlocksTailDiff(blocks);
                                            localStorage.setItem(`outliner:${id}:doc`, JSON.stringify({ blocks }));
                                        } catch (e) {
                                            console.error('Error applying streaming diff:', e);
                                        }
                                    }, 250);
                                }
                            } else if (data.type === 'completed') {
                                console.log('Streaming completed successfully');
                                setIsStreaming(false);

                                // Save the completed expanded outline
                                const { convertMarkdownToEditorJS } = await import('./utils');
                                const finalData = { blocks: convertMarkdownToEditorJS(markdownBufferRef.current) };
                                localStorage.setItem(`outliner:${id}:expanded`, JSON.stringify(finalData));
                                localStorage.setItem(`outliner:${id}:doc`, JSON.stringify(finalData));
                                lastAppliedBlocksRef.current = finalData.blocks;
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
            console.error('Streaming error:', error);
            setIsStreaming(false);

            // Fallback to basic outline
            const { buildInitialDocumentData } = await import('./utils');
            const fallbackData = buildInitialDocumentData(idea);
            setStreamingBlocks(fallbackData.blocks);
            localStorage.setItem(`outliner:${id}:doc`, JSON.stringify(fallbackData));

            if (editorRef.current) {
                try {
                    await editorRef.current.clear();
                    await editorRef.current.render(fallbackData);
                } catch (error) {
                    console.error('Error rendering fallback data:', error);
                }
            }
        }
    }, [idea, language, id, createSkeletonBlocks]);

    // Apply minimal tail diff to reduce flicker: replace all blocks from first divergence index
    const applyBlocksTailDiff = useCallback(async (nextBlocks: any[]) => {
        if (!editorRef.current) return;
        const prevBlocks = lastAppliedBlocksRef.current || [];

        const blocksEqual = (a: any, b: any) => {
            if (!a || !b) return false;
            if (a.type !== b.type) return false;
            try { return JSON.stringify(a.data) === JSON.stringify(b.data); } catch { return false; }
        };

        let divergeAt = 0;
        const minLen = Math.min(prevBlocks.length, nextBlocks.length);
        while (divergeAt < minLen && blocksEqual(prevBlocks[divergeAt], nextBlocks[divergeAt])) {
            divergeAt++;
        }

        // If identical, skip
        if (divergeAt === prevBlocks.length && divergeAt === nextBlocks.length) return;

        const api = (editorRef.current as any).blocks;
        const currentCount = api.getBlocksCount();

        // Safety: if editor count mismatches our prev snapshot a lot, fallback to full render once
        if (Math.abs(currentCount - prevBlocks.length) > 5 && nextBlocks.length < 300) {
            await editorRef.current.clear();
            await editorRef.current.render({ blocks: nextBlocks });
            lastAppliedBlocksRef.current = nextBlocks;
            return;
        }

        // Delete from end down to divergence
        for (let idx = currentCount - 1; idx >= divergeAt; idx--) {
            try { api.delete(idx); } catch { }
        }

        // Insert new/changed tail starting at divergence index
        for (let idx = divergeAt; idx < nextBlocks.length; idx++) {
            const b = nextBlocks[idx];
            try { await api.insert(b.type, b.data, undefined, idx); } catch { }
        }

        lastAppliedBlocksRef.current = nextBlocks;
    }, []);

    // Mini toolbar helpers
    const isCaretInsideEditor = useCallback((holder: string): boolean => {
        try {
            const root = document.getElementById(holder);
            const sel = window.getSelection();
            if (!root || !sel || sel.rangeCount === 0) return false;
            const node = sel.getRangeAt(0).startContainer;
            const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node.parentElement as Element | null);
            return !!(el && root.contains(el));
        } catch {
            return false;
        }
    }, []);

    const positionMiniToolbar = useCallback((editorRoot: HTMLElement, toolbar: HTMLDivElement) => {
        try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            let rect = rects.length > 0 ? rects[0] : null as DOMRect | null;
            // Fallback for cases (e.g., list items) where a collapsed range has no rects
            if (!rect || (rect.width === 0 && rect.height === 0)) {
                try {
                    const anchorNode = range.startContainer;
                    const anchorEl = anchorNode.nodeType === Node.ELEMENT_NODE
                        ? (anchorNode as Element)
                        : (anchorNode.parentElement as Element | null);
                    let editable: HTMLElement | null = anchorEl ? (anchorEl.closest('[contenteditable="true"]') as HTMLElement | null) : null;
                    if (!editable) {
                        const block = anchorEl?.closest('.ce-block__content') as HTMLElement | null;
                        editable = block ? (block.querySelector('[contenteditable="true"]') as HTMLElement | null) : null;
                    }
                    const altRect = (editable ? editable.getBoundingClientRect() : (anchorEl ? anchorEl.getBoundingClientRect() : null));
                    if (altRect) rect = altRect as DOMRect;
                } catch { }
            }
            if (!rect) return;
            const containerRect = editorRoot.getBoundingClientRect();

            // Calculate toolbar dimensions (ensure it's rendered to get accurate measurements)
            toolbar.style.visibility = 'hidden';
            toolbar.style.display = 'flex';
            const toolbarRect = toolbar.getBoundingClientRect();
            const toolbarWidth = toolbarRect.width;
            const toolbarHeight = toolbarRect.height;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate available space
            const cursorX = rect.left;
            const cursorY = rect.top;

            // Check if there's enough space to the right of the cursor
            const spaceToRight = viewportWidth - cursorX;
            const spaceToLeft = cursorX;

            let leftPosition: number;

            // Default: position to the right of cursor
            if (spaceToRight >= toolbarWidth + 10) {
                // Enough space to the right
                leftPosition = cursorX - containerRect.left;
            } else if (spaceToLeft >= toolbarWidth + 10) {
                // Enough space to the left
                leftPosition = cursorX - containerRect.left - toolbarWidth;
            } else {
                // Not enough space on either side, position as close as possible
                if (spaceToRight > spaceToLeft) {
                    // More space to the right
                    leftPosition = cursorX - containerRect.left;
                } else {
                    // More space to the left
                    leftPosition = cursorX - containerRect.left - toolbarWidth;
                }
            }

            // Ensure toolbar doesn't go off the editor horizontally
            const maxLeft = Math.max(0, editorRoot.clientWidth - toolbarWidth - 10);
            const minLeft = 10;

            leftPosition = Math.max(minLeft, Math.min(maxLeft, leftPosition));

            // Position vertically - prefer above the cursor, but below if not enough space
            let topPosition: number;
            const spaceAbove = cursorY;
            const spaceBelow = viewportHeight - cursorY;

            if (spaceAbove >= toolbarHeight + 10) {
                // Enough space above
                topPosition = cursorY - containerRect.top - toolbarHeight - 8;
            } else if (spaceBelow >= toolbarHeight + 10) {
                // Enough space below
                topPosition = cursorY - containerRect.top + 24;
            } else {
                // Not enough space above or below, position as close as possible
                if (spaceAbove > spaceBelow) {
                    // More space above
                    topPosition = Math.max(10, cursorY - containerRect.top - toolbarHeight - 8);
                } else {
                    // More space below
                    topPosition = cursorY - containerRect.top + 24;
                }
            }

            // Ensure toolbar doesn't go off the editor vertically
            const maxTop = Math.max(0, editorRoot.clientHeight - toolbarHeight - 10);
            const minTop = 10;

            topPosition = Math.max(minTop, Math.min(maxTop, topPosition));

            toolbar.style.top = `${topPosition}px`;
            toolbar.style.left = `${leftPosition}px`;
            toolbar.style.visibility = 'visible';

        } catch { }
    }, []);

    const scheduleMiniToolbarShow = useCallback((editorRoot: HTMLElement) => {
        try {
            if (suppressUntilNextPointerRef.current) return;
            cancelScheduledMiniShow();
            showDelayTimerRef.current = window.setTimeout(() => {
                try {
                    const mt = miniToolbarRef.current || ensureMiniAIToolbar(editorRoot);
                    const sel = window.getSelection();
                    const hasSel = !!(sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed);
                    const shouldShow = isCaretInsideEditor(holderId) && !hasSel && !suppressUntilNextPointerRef.current;
                    const sinceScroll = Date.now() - lastScrollTsRef.current;
                    if (shouldShow && sinceScroll < 180 && rescheduleCountRef.current < 4) {
                        // Wait for scrolling to settle, then reschedule quickly
                        rescheduleCountRef.current += 1;
                        scheduleMiniToolbarShow(editorRoot);
                        return;
                    }
                    rescheduleCountRef.current = 0;
                    if (shouldShow) {
                        mt.style.display = 'flex';
                        positionMiniToolbar(editorRoot, mt);
                    }
                } catch { }
            }, 600); // delay to avoid immediate popup
        } catch { }
    }, [holderId, isCaretInsideEditor, positionMiniToolbar]);

    const cancelScheduledMiniShow = useCallback(() => {
        if (showDelayTimerRef.current) {
            try { window.clearTimeout(showDelayTimerRef.current); } catch { }
            showDelayTimerRef.current = null;
        }
    }, []);

    const hideMiniToolbar = useCallback(() => {
        try { if (miniToolbarRef.current) miniToolbarRef.current.style.display = 'none'; } catch { }
    }, []);

    // Warm-up to make sure inline tools register any global listeners (once)
    const warmInlineToolsOnce = useCallback((editorRoot: HTMLElement) => {
        try {
            const editable = editorRoot.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (!editable || !editable.firstChild) return;
            const targetNode = editable.firstChild as Node;
            const sel = window.getSelection();
            if (!sel) return;
            const prevRanges: Range[] = [];
            for (let i = 0; i < sel.rangeCount; i++) prevRanges.push(sel.getRangeAt(i).cloneRange());
            const tempRange = document.createRange();
            try {
                tempRange.setStart(targetNode, 0);
                tempRange.setEnd(targetNode, Math.min(1, (targetNode.textContent || '').length));
            } catch {
                tempRange.selectNodeContents(editable);
            }
            sel.removeAllRanges();
            sel.addRange(tempRange);
            setTimeout(() => {
                try {
                    sel.removeAllRanges();
                    prevRanges.forEach(r => sel.addRange(r));
                } catch { }
            }, 10);
        } catch { }
    }, []);

    // Function to ensure mini AI toolbar exists
    const ensureMiniAIToolbar = useCallback((editorRoot: HTMLElement): HTMLDivElement => {
        const existing = editorRoot.querySelector('[data-mini-ai-toolbar="true"]') as HTMLDivElement | null;
        if (existing) return existing;

        const toolbar = document.createElement('div');
        toolbar.setAttribute('data-mini-ai-toolbar', 'true');
        toolbar.style.position = 'absolute';
        toolbar.style.zIndex = '50';
        toolbar.style.display = 'none';
        toolbar.style.gap = '6px';
        toolbar.style.padding = '6px';
        toolbar.style.borderRadius = '8px';
        toolbar.style.border = '1px solid rgba(0,0,0,0.12)';
        toolbar.style.background = 'var(--bw, #fff)';
        toolbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';

        // Sparkles AI badge/icon on the left
        const badge = document.createElement('div');
        badge.setAttribute('data-mini-ai-badge', 'true');
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.width = '22px';
        badge.style.height = '22px';
        badge.style.color = 'var(--main, #111)';
        badge.style.background = 'var(--bw, #fff)';
        badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
        badge.style.marginRight = '2px';
        
        // Import SPARKLES_ICON_SVG dynamically to avoid circular dependency
        import('../../components/svg-icons').then(({ SPARKLES_ICON_SVG }) => {
            badge.innerHTML = SPARKLES_ICON_SVG;
        });

        const makeBtn = (label: string, dataset: string, eventName: string) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.className = 'px-2 py-1 text-xs rounded-md border';
            btn.style.background = 'var(--bw, #fff)';
            btn.style.color = 'var(--text, #111)';
            btn.style.borderColor = 'rgba(0,0,0,0.12)';
            btn.style.cursor = 'pointer';
            btn.setAttribute('data-mini-ai-btn', dataset);
            btn.addEventListener('click', () => {
                try {
                    // Synthesize selection over current paragraph if none
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        if (range.collapsed) {
                            const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
                                ? (range.startContainer as Element)
                                : (range.startContainer.parentElement as Element | null);
                            let editable: HTMLElement | null = startEl ? (startEl.closest('[contenteditable="true"]') as HTMLElement | null) : null;
                            if (!editable) {
                                const block = startEl?.closest('.ce-block__content') as HTMLElement | null;
                                editable = block ? (block.querySelector('[contenteditable="true"]') as HTMLElement | null) : null;
                            }
                            if (editable) {
                                const newRange = document.createRange();
                                newRange.selectNodeContents(editable);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            }
                        }
                    }
                } catch { }
                // Dispatch on next tick to ensure selection state is applied
                setTimeout(() => { try { window.dispatchEvent(new CustomEvent(eventName)); } catch { } }, 0);
            });
            return btn;
        };

        const expandBtn = makeBtn('Expand', 'expand', 'outliner-ai-expand-current');
        const paraphraseBtn = makeBtn('Paraphrase', 'paraphrase', 'outliner-ai-paraphrase-current');
        const citeBtn = makeBtn('Cite', 'cite', 'outliner-ai-cite-current');
        const chatBtn = makeBtn('Chat', 'chat', 'outliner-ai-chat-current');
        toolbar.appendChild(badge);
        toolbar.appendChild(expandBtn);
        toolbar.appendChild(paraphraseBtn);
        toolbar.appendChild(citeBtn);
        toolbar.appendChild(chatBtn);

        editorRoot.style.position = 'relative';
        editorRoot.appendChild(toolbar);
        return toolbar;
    }, []);

    return {
        // Refs
        editorRef,
        containerRef,
        holderId,
        miniToolbarRef,
        selectionHandlerRef,
        scrollHandlerRef,
        pointerUpHandlerRef,
        keyHandlerRef,
        inputHandlerRef,
        showDelayTimerRef,
        suppressUntilNextPointerRef,
        warmedToolsRef,
        lastScrollTsRef,
        rescheduleCountRef,
        streamingInitiatedRef,
        eventSourceRef,
        markdownBufferRef,
        streamingRenderTimerRef,
        lastAppliedBlocksRef,

        // State
        isReady,
        setIsReady,
        isStreaming,
        setIsStreaming,
        streamingBlocks,
        setStreamingBlocks,
        showEmailForm,
        setShowEmailForm,
        pendingDownloadAction,
        setPendingDownloadAction,
        pendingDownloadFormat,
        setPendingDownloadFormat,
        emailLoading,
        setEmailLoading,
        emailError,
        setEmailError,
        showChat,
        setShowChat,
        documentContext,
        setDocumentContext,
        selectedText,
        setSelectedText,

        // Functions
        initiateDownload,
        handleEmailSubmit,
        handleOpenChat,
        handleCloseChat,
        getDocumentContext,
        saveToDB,
        isSavingToDB,
        isSavedToDB,
        debouncedSave,
        createSkeletonBlocks,
        startStreaming,
        applyBlocksTailDiff,
        isCaretInsideEditor,
        positionMiniToolbar,
        scheduleMiniToolbarShow,
        cancelScheduledMiniShow,
        hideMiniToolbar,
        warmInlineToolsOnce,
        ensureMiniAIToolbar,
    };
}
