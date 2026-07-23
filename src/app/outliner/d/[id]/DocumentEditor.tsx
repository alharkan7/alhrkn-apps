import { useEffect } from 'react';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Marker from '@editorjs/marker';
import InlineCode from '@editorjs/inline-code';
import Underline from '@editorjs/underline';
import { ExpandInlineTool } from '../../tools/ExpandInlineTool';
import { CitationTool } from '../../tools/CitationTool';
import { ParaphraseTool } from '../../tools/ParaphraseTool';
import { ChatTool } from '../../tools/ChatTool';
import { ResearchIdea, convertToMarkdown, convertToPlainText, convertToHTML, buildBibliographyHTML, buildBibliographyMarkdown, buildBibliographyPlain, renderPdfFromEditorData, getBibliographyEntries } from './utils';
import { Toolbar } from '../../components/Toolbar';
import { ChatInterface } from '../../components/ChatInterface';
import { DocumentMap } from '../../components/DocumentMap';
import { useDocumentEditor } from './hooks';
import { toast } from 'sonner';

export function FullDocumentEditor({ id, idea, language, initialContent, isOwner = true }: { id: string; idea: ResearchIdea; language: 'en' | 'id'; initialContent?: any; isOwner?: boolean; }) {
    const {
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
        suppressUntilNextPointerRef,
        warmedToolsRef,
        lastScrollTsRef,
        streamingInitiatedRef,
        eventSourceRef,
        lastAppliedBlocksRef,

        // State
        isReady,
        setIsReady,
        setIsStreaming,
        showEmailForm,
        setShowEmailForm,
        setPendingDownloadAction,
        pendingDownloadFormat,
        setPendingDownloadFormat,
        emailLoading,
        emailError,
        showChat,
        documentContext,
        selectedText,

        // Functions
        initiateDownload,
        handleEmailSubmit,
        handleOpenChat,
        handleCloseChat,
        debouncedSave,
        saveToDB,
        isSavingToDB,
        isSavedToDB,
        createSkeletonBlocks,
        startStreaming,
        positionMiniToolbar,
        scheduleMiniToolbarShow,
        cancelScheduledMiniShow,
        hideMiniToolbar,
        warmInlineToolsOnce,
        ensureMiniAIToolbar,
    } = useDocumentEditor(id, idea, language, initialContent, isOwner);

    const handleDownload = async (format: 'pdf' | 'markdown' | 'txt' | 'docx') => {
        if (!editorRef.current) return;

        // Instead of downloading immediately, initiate the email form process
        const downloadAction = async () => {
            try {
                const data = await editorRef.current!.save();
                console.log(`Downloading as ${format}...`, data);

                // Debug: Log list blocks to understand their structure
                if (data.blocks) {
                    console.log('All blocks:', data.blocks.map((b: any) => ({ type: b.type, hasData: !!b.data, dataKeys: b.data ? Object.keys(b.data) : [] })));
                    data.blocks.forEach((block: any, index: number) => {
                        if (block.type === 'list') {
                            console.log(`List block ${index}:`, block);
                            console.log(`List items:`, block.data.items);
                            if (block.data && Array.isArray(block.data.items)) {
                                block.data.items.forEach((item: any, itemIndex: number) => {
                                    console.log(`  Item ${itemIndex}:`, item, 'Type:', typeof item);
                                    if (typeof item === 'object') {
                                        console.log(`    Keys:`, Object.keys(item));
                                        console.log(`    Values:`, Object.values(item));
                                    }
                                });
                            }
                        }
                    });
                }

                let content: string;
                let filename: string;
                let mimeType: string;

                // Debug: Show what the conversion functions produce
                console.log('HTML conversion result:', convertToHTML(data));
                console.log('Markdown conversion result:', convertToMarkdown(data));
                console.log('Plain text conversion result:', convertToPlainText(data));

                switch (format) {
                    case 'pdf':
                        // High-quality, multi-page PDF using html2canvas + jsPDF with explicit per-page slicing
                        { renderPdfFromEditorData(idea.title, data) }
                        return;

                    case 'markdown':
                        {
                            const main = convertToMarkdown(data);
                            const bib = buildBibliographyMarkdown(getBibliographyEntries());
                            content = `${main}${bib}`;
                        }
                        filename = `${idea.title || 'document'}.md`;
                        mimeType = 'text/markdown';
                        break;

                    case 'txt':
                        {
                            const main = convertToPlainText(data);
                            const bib = buildBibliographyPlain(getBibliographyEntries());
                            content = `${main}${bib}`;
                        }
                        filename = `${idea.title || 'document'}.txt`;
                        mimeType = 'text/plain';
                        break;

                    case 'docx':
                        // Save as Word-compatible HTML with .doc extension, including references
                        {
                            const htmlMain = convertToHTML(data);
                            const htmlBib = buildBibliographyHTML(getBibliographyEntries());
                            content = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${idea.title || 'Document'}</title></head><body>${htmlMain}${htmlBib}</body></html>`;
                        }
                        filename = `${idea.title || 'document'}.doc`;
                        mimeType = 'application/msword';
                        break;
                }

                // Create and download the file
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

            } catch (error) {
                console.error('Error preparing download:', error);
            }
        };

        // Initiate email form process
        initiateDownload(format, downloadAction);
    };

    useEffect(() => {
        let isMounted = true;

        const initializeEditor = async () => {
            // Destroy any existing editor first
            if (editorRef.current) {
                try {
                    await editorRef.current.destroy();
                } catch (error) {
                    console.error('Error destroying editor:', error);
                }
                editorRef.current = null;
            }

            // Clear the container
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }

            if (!isMounted) return;

            // Get initial data
            let initialData;
            let shouldStartStreaming = false;

            if (initialContent && Array.isArray(initialContent.blocks) && initialContent.blocks.length > 0) {
                initialData = initialContent;
                console.log('Loaded existing document from DB with', initialContent.blocks.length, 'blocks');
            } else {
                // Fallback to check if we had it in localStorage for offline editing reasons
                const existing = localStorage.getItem(`outliner:${id}:doc`);
                if (existing) {
                    try {
                        const parsedData = JSON.parse(existing);
                        if (parsedData && Array.isArray(parsedData.blocks) && parsedData.blocks.length > 0) {
                            initialData = parsedData;
                        }
                    } catch {}
                }
                
                if (!initialData) {
                    // Start streaming
                    initialData = { blocks: [] };
                    shouldStartStreaming = true;
                    console.log('New document or empty DB content, starting streaming');
                }
            }

            // Create the editor
            try {
                const editor = new EditorJS({
                    holder: holderId,
                    placeholder: "Start writing… Use '/' for blocks",
                    readOnly: !isOwner,
                    inlineToolbar: true,
                    autofocus: true,
                    tools: {
                        // Ensure paragraph inline toolbar shows our custom tool
                        paragraph: {
                            inlineToolbar: ['link', 'bold', 'italic', 'underline', 'inlineCode', 'marker', 'expand', 'paraphrase', 'cite', 'chat']
                        } as any,
                        // Enable inline AI tools for headers as well
                        header: {
                            class: Header as any,
                            inlineToolbar: ['link', 'bold', 'italic', 'underline', 'inlineCode', 'marker', 'expand', 'paraphrase', 'cite', 'chat']
                        } as any,
                        // Enable inline AI tools for list items
                        list: {
                            class: List as any,
                            inlineToolbar: ['bold', 'italic', 'underline', 'inlineCode', 'marker', 'expand', 'paraphrase', 'cite', 'chat']
                        } as any,
                        marker: { class: Marker } as const,
                        inlineCode: { class: InlineCode } as const,
                        underline: { class: Underline } as const,
                        expand: {
                            class: ExpandInlineTool as any,
                            config: {
                                endpoint: '/api/outliner/expand-passage',
                                language: language,
                                getDocument: async () => {
                                    try {
                                        if (editorRef.current) {
                                            return await editorRef.current.save();
                                        }
                                    } catch { }
                                    return { blocks: [] };
                                },
                                notify: (msg: string) => {
                                    try { console.log(msg); } catch { }
                                }
                            }
                        } as any,
                        paraphrase: {
                            class: ParaphraseTool as any,
                            config: {
                                endpoint: '/api/outliner/paraphrase',
                                language: language,
                                getDocument: async () => {
                                    try {
                                        if (editorRef.current) {
                                            return await editorRef.current.save();
                                        }
                                    } catch { }
                                    return { blocks: [] };
                                },
                                notify: (msg: string) => {
                                    try { console.log(msg); } catch { }
                                }
                            }
                        } as any,
                        cite: {
                            class: CitationTool as any,
                            config: {
                                endpoint: '/api/outliner/cite',
                                language: language,
                                getDocument: async () => {
                                    try {
                                        if (editorRef.current) {
                                            return await editorRef.current.save();
                                        }
                                    } catch { }
                                    return { blocks: [] };
                                },
                                notify: (msg: string) => {
                                    try { console.log(msg); } catch { }
                                }
                            }
                        } as any,
                        chat: {
                            class: ChatTool as any,
                            config: {
                                endpoint: '/api/outliner/chat',
                                language: language,
                                getDocument: async () => {
                                    try {
                                        if (editorRef.current) {
                                            return await editorRef.current.save();
                                        }
                                    } catch { }
                                    return { blocks: [] };
                                },
                                notify: (msg: string) => {
                                    try { console.log(msg); } catch { }
                                },
                                onOpenChat: handleOpenChat
                            }
                        } as any,
                    },
                    data: initialData,
                    onChange: () => {
                        debouncedSave();
                        // Update bibliography display when document changes
                        setTimeout(() => {
                            const container = document.getElementById('bibliography-container');
                            if (container) {
                                // Trigger a custom event that the citation tool can listen to
                                window.dispatchEvent(new CustomEvent('outliner-document-changed'));
                            }
                        }, 100);
                    },
                    onReady: () => {
                        if (isMounted) {
                            console.log('EditorJS is ready');
                            setIsReady(true);
                            try { lastAppliedBlocksRef.current = Array.isArray(initialData?.blocks) ? initialData.blocks : []; } catch { }

                            // Restore bibliography if present
                            if (initialData?.bibliography && Array.isArray(initialData.bibliography)) {
                                const container = document.getElementById('bibliography-container');
                                if (container && initialData.bibliography.length > 0) {
                                    container.innerHTML = '';
                                    initialData.bibliography.forEach((ref: any) => {
                                        const div = document.createElement('div');
                                        div.className = 'reference-entry mb-4';
                                        div.innerHTML = `<p class="m-0 text-foreground">${ref.html || ref.text}</p>`;
                                        container.appendChild(div);
                                    });
                                }
                            }

                            // Start streaming if needed
                            if (shouldStartStreaming) {
                                console.log('Starting streaming after editor ready');
                                setTimeout(() => {
                                    startStreaming();
                                }, 100);
                            }

                            // Install caret listener to toggle mini AI toolbar
                            try {
                                const editorRoot = document.getElementById(holderId) as HTMLElement | null;
                                if (editorRoot) {
                                    const mt = ensureMiniAIToolbar(editorRoot);
                                    miniToolbarRef.current = mt;
                                    // Warm once to ensure inline tool constructors (incl. Cite and Paraphrase) are instantiated
                                    if (!warmedToolsRef.current) {
                                        setTimeout(() => { try { warmInlineToolsOnce(editorRoot); warmedToolsRef.current = true; } catch { } }, 80);
                                    }
                                }
                                const onSelectionChange = () => {
                                    try {
                                        const mt = miniToolbarRef.current || (editorRoot ? ensureMiniAIToolbar(editorRoot) : null);
                                        if (!mt) return;
                                        const sel = window.getSelection();
                                        const hasSel = !!(sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed);
                                        if (hasSel) {
                                            hideMiniToolbar();
                                        } else if (mt.style.display !== 'none') {
                                            // Reposition if already visible
                                            positionMiniToolbar(editorRoot!, mt);
                                        }
                                    } catch { }
                                };
                                document.addEventListener('selectionchange', onSelectionChange);
                                selectionHandlerRef.current = onSelectionChange;
                                // Hide on scroll to avoid drifting
                                const onScroll = () => { lastScrollTsRef.current = Date.now(); if (miniToolbarRef.current) miniToolbarRef.current.style.display = 'none'; };
                                window.addEventListener('scroll', onScroll, { passive: true });
                                scrollHandlerRef.current = onScroll;

                                // Pointer-up inside editor schedules delayed show
                                const onPointerUp = () => {
                                    try {
                                        suppressUntilNextPointerRef.current = false; // allow
                                        scheduleMiniToolbarShow(editorRoot!);
                                    } catch { }
                                };
                                if (editorRoot) {
                                    editorRoot.addEventListener('pointerup', onPointerUp as any);
                                    pointerUpHandlerRef.current = onPointerUp as any;
                                }

                                // Any typing hides and suppresses until next pointer interaction
                                const onKeyOrInput = () => {
                                    suppressUntilNextPointerRef.current = true;
                                    cancelScheduledMiniShow();
                                    hideMiniToolbar();
                                };
                                document.addEventListener('keydown', onKeyOrInput);
                                document.addEventListener('beforeinput', onKeyOrInput as any);
                                keyHandlerRef.current = onKeyOrInput;
                                inputHandlerRef.current = onKeyOrInput as any;
                            } catch { }
                        }
                    }
                });

                if (isMounted) {
                    editorRef.current = editor;
                }
            } catch (error) {
                console.error('Error initializing EditorJS:', error);
            }
        };

        // Initialize after a small delay to ensure DOM is ready
        const timeoutId = setTimeout(initializeEditor, 50);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (editorRef.current) {
                try {
                    editorRef.current.destroy();
                } catch (error) {
                    console.error('Error destroying editor:', error);
                }
                editorRef.current = null;
            }
            // Remove global listeners and cleanup streaming
            try {
                if (selectionHandlerRef.current) document.removeEventListener('selectionchange', selectionHandlerRef.current);
                if (scrollHandlerRef.current) window.removeEventListener('scroll', scrollHandlerRef.current as any);
                const editorRoot = document.getElementById(holderId) as HTMLElement | null;
                if (editorRoot && pointerUpHandlerRef.current) editorRoot.removeEventListener('pointerup', pointerUpHandlerRef.current as any);
                if (keyHandlerRef.current) document.removeEventListener('keydown', keyHandlerRef.current);
                if (inputHandlerRef.current) document.removeEventListener('beforeinput', inputHandlerRef.current as any);
                cancelScheduledMiniShow();

                // Cleanup streaming
                if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
                setIsStreaming(false);
                streamingInitiatedRef.current = false;
            } catch { }
            setIsReady(false);
        };
    }, [id, idea, holderId, debouncedSave, language, startStreaming, createSkeletonBlocks, ensureMiniAIToolbar, warmInlineToolsOnce, hideMiniToolbar, positionMiniToolbar, scheduleMiniToolbarShow, cancelScheduledMiniShow]);

    // Global listener for double-clicking citations and bibliography items
    useEffect(() => {
        const handleDblClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Handle inline citation double click
            if (target.classList.contains('inline-citation')) {
                target.contentEditable = "true";
                target.focus();
                
                let isExiting = false;
                const exitEditMode = () => {
                    if (isExiting) return;
                    isExiting = true;
                    target.contentEditable = "false";
                    target.removeEventListener('blur', exitEditMode);
                    target.removeEventListener('keydown', onKeyDown);
                    document.removeEventListener('mousedown', onOutsideClick);
                    
                    // Notify EditorJS of changes
                    const editableAncestor = target.closest('.ce-block__content [contenteditable="true"]');
                    if (editableAncestor) {
                        editableAncestor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
                    }
                };

                const onOutsideClick = (ce: MouseEvent) => {
                    if (!target.contains(ce.target as Node)) {
                        exitEditMode();
                    }
                };
                
                const onKeyDown = (ke: KeyboardEvent) => {
                    if (ke.key === 'Enter' || ke.key === 'Escape') {
                        ke.preventDefault();
                        exitEditMode();
                    }
                };
                
                target.addEventListener('blur', exitEditMode);
                target.addEventListener('keydown', onKeyDown);
                document.addEventListener('mousedown', onOutsideClick);
                return;
            }
            
            // Handle bibliography entry double click
            const refEntry = target.closest('.reference-entry');
            if (refEntry) {
                const p = refEntry.querySelector('p');
                if (p && e.target === p) {
                    p.contentEditable = "true";
                    p.focus();
                    
                    let isExiting = false;
                    const exitEditMode = () => {
                        if (isExiting) return;
                        isExiting = true;
                        p.contentEditable = "false";
                        p.removeEventListener('blur', exitEditMode);
                        p.removeEventListener('keydown', onKeyDown);
                        document.removeEventListener('mousedown', onOutsideClick);
                        debouncedSave(); // Force save to persist manual edits
                    };

                    const onOutsideClick = (ce: MouseEvent) => {
                        if (!p.contains(ce.target as Node)) {
                            exitEditMode();
                        }
                    };
                    
                    const onKeyDown = (ke: KeyboardEvent) => {
                        if (ke.key === 'Enter' || ke.key === 'Escape') {
                            ke.preventDefault();
                            exitEditMode();
                        }
                    };
                    
                    p.addEventListener('blur', exitEditMode);
                    p.addEventListener('keydown', onKeyDown);
                    document.addEventListener('mousedown', onOutsideClick);
                }
            }
        };

        document.addEventListener('dblclick', handleDblClick);
        return () => document.removeEventListener('dblclick', handleDblClick);
    }, [debouncedSave]);

    // Global keyboard shortcuts (Cmd/Ctrl + S to save)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveToDB();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [saveToDB]);

    const handleMakeCopy = async () => {
        try {
            const res = await fetch(`/api/outliner/drafts/${id}/duplicate`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to duplicate');
            const data = await res.json();
            window.location.href = `/outliner/d/${data.draftId}`;
        } catch (error) {
            console.error('Failed to duplicate draft', error);
            toast.error('Failed to copy document. Please try again.');
        }
    };

    const handleEditorClick = () => {
        if (!isOwner) {
            toast('View Only', {
                description: "You're not the owner of this document.",
                action: {
                    label: 'Make Copy',
                    onClick: handleMakeCopy
                }
            });
        }
    };

    return (
        <div className="prose prose-neutral dark:prose-invert max-w-none w-full pb-32">
            <Toolbar onDownload={handleDownload} onOpenChat={handleOpenChat} onSave={saveToDB} isSaving={isSavingToDB} isSaved={isSavedToDB} />

            <div id="document-wrapper" className="bg-white dark:bg-[#1a1a1a] shadow-2xl rounded-sm border border-black/10 dark:border-white/5 px-6 py-12 md:px-16 md:py-20 mt-24 mb-16 mx-auto w-full max-w-[850px] min-h-[1100px] font-serif transition-colors duration-200 relative">
                {!isOwner && (
                    <div 
                        className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-sans font-medium px-3 py-1.5 rounded-full shadow-sm hover:shadow-md cursor-pointer select-none transition-all flex items-center gap-1 z-10" 
                        onClick={handleMakeCopy}
                    >
                        <span>View Only</span>
                    </div>
                )}
                <div
                    id={holderId}
                    ref={containerRef}
                    onClickCapture={handleEditorClick}
                    style={{
                        minHeight: '200px',
                        position: 'relative'
                    }}
                    className="editor-container text-foreground font-serif leading-relaxed prose-headings:font-serif prose-h1:text-center prose-h1:font-normal prose-h2:font-normal prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-p:text-justify"
                />

                {/* Bibliography Section */}
                <div className="mt-16 pt-8 border-t border-black/10 dark:border-white/10">
                    <h2 id="references-header" className="text-2xl font-serif font-normal mb-6 text-foreground text-center">References</h2>
                    <div id="bibliography-container" className="space-y-4 break-words font-serif text-[15px] leading-relaxed pl-6 -indent-6">
                        <p data-bibliography-placeholder="true" className="text-muted-foreground italic text-center indent-0">
                            Citations will appear here as you add them to your document using the citation tool.
                        </p>
                    </div>
                </div>
            </div>

            <DocumentMap containerId="document-wrapper" />

            {/* Chat Interface */}
            <ChatInterface
                isOpen={showChat}
                onClose={handleCloseChat}
                documentContext={documentContext}
                selectedText={selectedText}
            />
        </div>
    );
}