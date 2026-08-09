'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Download,
  Maximize2,
  Minimize2,
  Code2,
  LoaderCircle,
  Wrench,
  MousePointer2,
  Pencil,
  Undo,
  Redo,
  Sparkles,
  Save,
  Copy,
  Check,
} from 'lucide-react';
import panzoom from 'panzoom';
import { toPng } from 'html-to-image';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { sanitizeSvg } from '../lib/sanitize-svg';
import {
  type BoxRect,
  type SvgElementSelection,
  describeElement,
  findSelectableElementAtPoint,
  getRelativeBox,
  prepareSvgForSelection,
  selectionKey,
} from '../lib/svg-selection';

const formatXml = (xml: string) => {
  const PADDING = '  ';
  const reg = /(>)\s*(<)(\/*)/g;
  let pad = 0;
  let formatted = '';
  xml = xml.replace(reg, '$1\r\n$2$3');
  
  xml.split('\r\n').forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }
    formatted += PADDING.repeat(pad) + node + '\n';
    pad += indent;
  });
  return formatted.trim();
};

interface SvgArtifactProps {
  svg: string;
  loading?: boolean;
  fileName?: string;
  description?: string;
  /** Selected element attachments (parent owns list for chat badges). */
  attachments?: SvgElementSelection[];
  onAttachmentsChange?: (next: SvgElementSelection[]) => void;
  /** Shortcut to ask AI to repair broken SVG markup. */
  onAutoFix?: () => void;
  isStreaming?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPreviousVersion?: () => void;
  onNextVersion?: () => void;
  showAutoImprove?: boolean;
  onAutoImprove?: (dataUrl: string) => void;
  onLocalSave?: (newSvg: string) => Promise<void>;
  /** Show an "Edit" affordance in the toolbar (e.g. when the chat panel is hidden). */
  showEditButton?: boolean;
  onEdit?: () => void;
}

export function SvgArtifact({
  svg,
  loading = false,
  fileName,
  description,
  attachments = [],
  onAttachmentsChange,
  onAutoFix,
  isStreaming = false,
  hasPrevious,
  hasNext,
  onPreviousVersion,
  onNextVersion,
  showAutoImprove,
  onAutoImprove,
  onLocalSave,
  showEditButton,
  onEdit,
}: SvgArtifactProps) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRootRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** Live DOM nodes keyed by selectionKey for multi-select bounding boxes */
  const selectedElsRef = useRef<Map<string, SVGElement>>(new Map());
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);
  onAttachmentsChangeRef.current = onAttachmentsChange;

  const [isMounted, setIsMounted] = useState(false);
  const [svgMountCount, setSvgMountCount] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const panzoomRef = useRef<ReturnType<typeof panzoom> | null>(null);
  const initialTransformRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const pointerDownTransformRef = useRef<string | null>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const [renderError, setRenderError] = useState<string | null>(null);
  const [safeSvg, setSafeSvg] = useState('');
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const [hoverBox, setHoverBox] = useState<BoxRect | null>(null);
  const [selectedBoxes, setSelectedBoxes] = useState<BoxRect[]>([]);
  const [editingText, setEditingText] = useState<{ element: SVGElement; left: number; top: number; width: number; height: number; value: string } | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [editableCode, setEditableCode] = useState('');

  useEffect(() => {
    if (codeOpen && safeSvg && !hasLocalChanges) {
      setEditableCode(formatXml(safeSvg));
    }
  }, [codeOpen]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCodeEdit = (newCode: string) => {
    setEditableCode(newCode);
    setHasLocalChanges(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        setSafeSvg(sanitizeSvg(newCode, false));
        setRenderError(null);
      } catch (e: any) {
        setRenderError(e?.message || 'Invalid SVG in code editor');
      }
    }, 400);
  };

  const refreshBoxes = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const boxes: BoxRect[] = [];
    selectedElsRef.current.forEach((el) => {
      if (!el.isConnected) return;
      const box = getRelativeBox(el, container);
      if (box) boxes.push(box);
    });
    setSelectedBoxes(boxes);
  }, []);

  // Drop live refs for attachments removed in chat UI
  useEffect(() => {
    const keys = new Set(attachments.map(selectionKey));
    let changed = false;
    selectedElsRef.current.forEach((_, key) => {
      if (!keys.has(key)) {
        selectedElsRef.current.delete(key);
        changed = true;
      }
    });
    if (changed || attachments.length !== selectedElsRef.current.size) {
      refreshBoxes();
    } else {
      refreshBoxes();
    }
  }, [attachments, refreshBoxes]);

  useEffect(() => {
    try {
      setSafeSvg(sanitizeSvg(svg, isStreaming));
      setRenderError(null);
      if (!isStreaming) {
        selectedElsRef.current.clear();
        setSelectedBoxes([]);
        setHoverBox(null);
      }
      // Parent should also clear attachments when svg string changes
    } catch (e: any) {
      setSafeSvg('');
      setRenderError(isStreaming ? null : (e?.message || 'Failed to sanitize SVG'));
      selectedElsRef.current.clear();
      setSelectedBoxes([]);
    }
  }, [svg, isStreaming]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !safeSvg) return;

    let root: Element | null = null;
    if (isStreaming) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeSvg, 'text/html');
      root = doc.querySelector('svg');
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeSvg, 'image/svg+xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        const detail = parseError.textContent?.trim().slice(0, 160);
        setRenderError(detail ? `Invalid SVG markup: ${detail}` : 'Invalid SVG markup');
        svgRootRef.current = null;
        return;
      }
      root = doc.documentElement;
    }

    if (!root || root.tagName.toLowerCase() !== 'svg') {
      if (!isStreaming) setRenderError('Rendered SVG root not found');
      return;
    }

    root.querySelectorAll('script, foreignObject').forEach((node) => node.remove());

    try {
      const svgElem = document.importNode(root, true) as unknown as SVGSVGElement;
      svgElem.style.maxWidth = '100%';
      svgElem.style.height = 'auto';
      svgElem.style.display = 'block';
      svgElem.style.cursor = 'crosshair';
      
      const existingRoot = svgRootRef.current;
      if (existingRoot && wrapper.contains(existingRoot)) {
        // Fast path: update existing SVG to preserve DOM state
        Array.from(svgElem.attributes).forEach(attr => {
          if (attr.name !== 'style' && attr.name !== 'transform' && existingRoot.getAttribute(attr.name) !== attr.value) {
             existingRoot.setAttribute(attr.name, attr.value);
          }
        });
        existingRoot.innerHTML = svgElem.innerHTML;
        prepareSvgForSelection(existingRoot);
        setRenderError(null);
      } else {
        // First time or recovery
        wrapper.innerHTML = '';
        wrapper.appendChild(svgElem);
        prepareSvgForSelection(svgElem);
        svgRootRef.current = svgElem;
        setRenderError(null);
        setSvgMountCount(c => c + 1);
      }
    } catch (e: any) {
      setRenderError(e?.message || 'Failed to mount SVG');
      svgRootRef.current = null;
    }
  }, [safeSvg, isStreaming]);

  useEffect(() => {
    const container = containerRef.current;
    const svgElem = svgRootRef.current;
    if (!container || !svgElem || svgMountCount === 0) return;

    const instance = panzoom(svgElem as unknown as HTMLElement, {
      zoomDoubleClickSpeed: 1,
      maxZoom: 10,
      minZoom: 0.1,
      bounds: false,
      onDoubleClick: (e: Event) => {
        if (loadingRef.current) return false;
        const mouseEvent = e as MouseEvent;
        let hit = findSelectableElementAtPoint(mouseEvent.clientX, mouseEvent.clientY, svgElem);
        
        if (hit && hit.tagName.toLowerCase() === 'tspan' && hit.parentElement?.tagName.toLowerCase() === 'text') {
          hit = hit.parentElement as unknown as SVGElement;
        }

        if (hit && (hit.tagName.toLowerCase() === 'text' || hit.tagName.toLowerCase() === 'tspan')) {
          const box = getRelativeBox(hit, container);
          if (box) {
            let extractedValue = '';
            const tspans = Array.from(hit.querySelectorAll('tspan'));
            if (tspans.length > 0) {
              extractedValue = tspans.map(t => t.textContent || '').join('\n');
            } else {
              extractedValue = hit.textContent || '';
            }

            setEditingText({
              element: hit,
              left: box.left,
              top: box.top,
              width: Math.max(150, box.width + 20),
              height: Math.max(40, box.height + 10),
              value: extractedValue,
            });
          }
          return true; // prevent zoom and let us edit
        }
        return false;
      }
    });
    // @ts-ignore
    container.__panzoomInstance = instance;
    panzoomRef.current = instance;
    const transform = instance.getTransform();
    initialTransformRef.current = { x: transform.x, y: transform.y, scale: transform.scale };

    const onTransform = () => {
      refreshBoxes();
      setHoverBox(null);
    };
    instance.on('transform', onTransform);

    const onPointerDown = () => {
      pointerDownTransformRef.current = JSON.stringify(instance.getTransform());
    };

    const onPointerMove = (e: PointerEvent) => {
      if (loadingRef.current) return;
      if (e.buttons === 1) {
        setHoverBox(null);
        return;
      }
      const hit = findSelectableElementAtPoint(e.clientX, e.clientY, svgElem);
      if (!hit) {
        setHoverBox(null);
        return;
      }
      const key = selectionKey(describeElement(hit));
      if (selectedElsRef.current.has(key)) {
        setHoverBox(null);
        return;
      }
      setHoverBox(getRelativeBox(hit, container));
    };

    const onPointerLeave = () => {
      setHoverBox(null);
    };

    const onPointerUp = (e: PointerEvent) => {
      const onAttachmentsChange = onAttachmentsChangeRef.current;
      if (loadingRef.current || !onAttachmentsChange) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return; // Only left click for mouse

      const before = pointerDownTransformRef.current;
      const after = JSON.stringify(instance.getTransform());
      if (before && before !== after) return;

      const hit = findSelectableElementAtPoint(e.clientX, e.clientY, svgElem);
      if (!hit) {
        selectedElsRef.current.clear();
        setSelectedBoxes([]);
        setHoverBox(null);
        onAttachmentsChange([]);
        return;
      }

      e.stopPropagation();
      const desc = describeElement(hit);
      const key = selectionKey(desc);
      const current = attachmentsRef.current;
      const exists = current.some((a) => selectionKey(a) === key);

      if (exists) {
        selectedElsRef.current.delete(key);
        onAttachmentsChange(current.filter((a) => selectionKey(a) !== key));
      } else {
        selectedElsRef.current.set(key, hit);
        onAttachmentsChange([...current, desc]);
      }
      setHoverBox(null);
      requestAnimationFrame(() => refreshBoxes());
    };

    svgElem.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    svgElem.addEventListener('pointerup', onPointerUp);

    return () => {
      try {
        // @ts-ignore
        if (typeof instance.off === 'function') instance.off('transform', onTransform);
      } catch {
      }
      svgElem.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      svgElem.removeEventListener('pointerup', onPointerUp);
      instance.dispose();
      panzoomRef.current = null;
      initialTransformRef.current = null;
      svgRootRef.current = null;
      selectedElsRef.current.clear();
      // @ts-ignore
      if (container.__panzoomInstance) {
        // @ts-ignore
        container.__panzoomInstance = null;
      }
    };
  }, [refreshBoxes, svgMountCount]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setShowDownloadDropdown(false);
      }
    }
    if (showDownloadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadDropdown]);

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
      requestAnimationFrame(() => refreshBoxes());
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
    };
  }, [refreshBoxes]);

  const handleResetZoom = () => {
    if (panzoomRef.current && initialTransformRef.current) {
      const { x, y, scale } = initialTransformRef.current;
      panzoomRef.current.moveTo(x, y);
      panzoomRef.current.zoomAbs(0, 0, scale);
    }
    requestAnimationFrame(() => refreshBoxes());
  };

  const handleToggleFullscreen = async () => {
    const element = fullscreenRef.current;
    if (!element) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const isAnyFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    if (isAnyFullscreen) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      return;
    }
    const target = element as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    if (target.requestFullscreen) await target.requestFullscreen();
    else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
  };

  const trackDownload = (format: string) => {
    fetch('/api/inztagram/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'anonymous', downloadFormat: format, fileName, description }),
    }).catch(() => {});
  };

  const handleDownloadPng = () => {
    handleResetZoom();
    setTimeout(() => {
      if (!containerRef.current) return;
      const svgElem = containerRef.current.querySelector('svg');
      if (!svgElem) return;
      toPng(svgElem as unknown as HTMLElement, { backgroundColor: '#ffffff' }).then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'diagram-freeform.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        trackDownload('png');
      });
      setShowDownloadDropdown(false);
    }, 50);
  };

  const handleDownloadSvg = () => {
    if (!safeSvg) return;
    const blob = new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram-freeform.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadDropdown(false);
    trackDownload('svg');
  };

  const handleAutoImprove = () => {
    handleResetZoom();
    setTimeout(() => {
      if (!containerRef.current) return;
      const svgElem = containerRef.current.querySelector('svg');
      if (!svgElem) return;
      toPng(svgElem as unknown as HTMLElement, { backgroundColor: '#ffffff' }).then((dataUrl) => {
        onAutoImprove?.(dataUrl);
      });
    }, 50);
  };

  const handleTextEditComplete = (newValue: string) => {
    if (!editingText) return;
    const textEl = editingText.element;
    
    let currentValue = '';
    const tspans = Array.from(textEl.querySelectorAll('tspan'));
    if (tspans.length > 0) {
      currentValue = tspans.map(t => t.textContent || '').join('\n');
    } else {
      currentValue = textEl.textContent || '';
    }

    if (currentValue !== newValue) {
      const lines = newValue.split('\n');
      if (lines.length === 1 && tspans.length === 0) {
        textEl.textContent = lines[0];
      } else {
        let baseX = textEl.getAttribute('x') || '0';
        if (tspans.length > 0 && tspans[0].hasAttribute('x')) {
          baseX = tspans[0].getAttribute('x')!;
        }
        
        const firstDy = tspans.length > 0 ? tspans[0].getAttribute('dy') : null;
        const firstY = tspans.length > 0 ? tspans[0].getAttribute('y') : null;

        textEl.innerHTML = '';
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.textContent = line;
          tspan.setAttribute('x', baseX);
          if (i === 0) {
            if (firstDy) tspan.setAttribute('dy', firstDy);
            if (firstY) tspan.setAttribute('y', firstY);
          } else {
            tspan.setAttribute('dy', '1.2em');
          }
          textEl.appendChild(tspan);
        });
      }
      setHasLocalChanges(true);
    }
    setEditingText(null);
  };

  const handleLocalSaveSubmit = async () => {
    if (!onLocalSave) return;
    setIsSavingLocal(true);
    try {
      let newSvgStr = '';
      if (codeOpen && editableCode) {
        newSvgStr = editableCode;
      } else if (svgRootRef.current) {
        newSvgStr = svgRootRef.current.outerHTML;
      }
      if (newSvgStr) {
        await onLocalSave(newSvgStr);
        setHasLocalChanges(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingLocal(false);
    }
  };

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen ? 'w-screen h-screen bg-background p-2 md:p-4' : 'w-full h-full min-h-0'}
    >
      <Card className={isFullscreen ? 'w-full h-full shadow-lg flex flex-col max-w-none' : 'w-full h-full shadow-lg flex flex-col min-h-0'}>
        <div className="flex items-center justify-between p-2 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
            {!renderError && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground/80">
                <MousePointer2 className="size-3" />
                Click to Select
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {(hasLocalChanges || showAutoImprove) && (
              hasLocalChanges ? (
                <Button variant="default" size="sm" onClick={handleLocalSaveSubmit} disabled={isSavingLocal} className="mr-2 h-10 gap-1.5 px-3">
                  {isSavingLocal ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span className="hidden sm:inline">Save</span>
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleAutoImprove} disabled={loading} className="mr-2 h-10 gap-1.5 px-3">
                  <Sparkles className="size-3.5" /> <span className="hidden sm:inline">Improve</span>
                </Button>
              )
            )}
            {hasPrevious !== undefined && (
              <>
                <Button variant="secondary" size="icon" aria-label="Previous version" onClick={onPreviousVersion} disabled={!hasPrevious}>
                  <Undo className="size-5" />
                </Button>
                <Button variant="secondary" size="icon" aria-label="Next version" onClick={onNextVersion} disabled={!hasNext}>
                  <Redo className="size-5" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
              </>
            )}
            <Sheet open={codeOpen} onOpenChange={setCodeOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="View SVG code">
                  <Code2 className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] max-w-xl">
                <SheetHeader className="text-left">
                  <div className="flex items-start justify-between gap-4 pr-8">
                    <div className="text-left">
                      <SheetTitle className="text-left">SVG Source</SheetTitle>
                      <SheetDescription className="text-left">
                        Raw SVG markup for this freeform diagram.
                      </SheetDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleLocalSaveSubmit}
                        disabled={isSavingLocal || !hasLocalChanges}
                        className="shrink-0 gap-1.5"
                      >
                        {isSavingLocal ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                        <span>Save</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(editableCode);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="shrink-0 gap-1.5"
                      >
                        {isCopied ? (
                          <>
                            <Check className="size-4 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </SheetHeader>
                <div className="w-full h-[70vh] mt-4 relative rounded border bg-[#282c34]">
                  <SyntaxHighlighter
                    language="xml"
                    style={oneDark}
                    customStyle={{ 
                      margin: 0, 
                      padding: '1rem', 
                      background: 'transparent', 
                      pointerEvents: 'none', 
                      width: '100%', 
                      height: '100%', 
                      overflow: 'hidden', 
                      fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace', 
                      fontSize: '13px',
                      lineHeight: '1.5', 
                      tabSize: 2,
                      boxSizing: 'border-box'
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace', 
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }
                    }}
                    wrapLines={false}
                  >
                    {editableCode}
                  </SyntaxHighlighter>
                  <textarea
                    value={editableCode}
                    onChange={(e) => handleCodeEdit(e.target.value)}
                    onScroll={(e) => {
                      const pre = e.currentTarget.previousElementSibling as HTMLElement;
                      if (pre) {
                        pre.scrollTop = e.currentTarget.scrollTop;
                        pre.scrollLeft = e.currentTarget.scrollLeft;
                      }
                    }}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full p-[1rem] m-0 bg-transparent text-transparent caret-white resize-none outline-none overflow-auto whitespace-pre border-0 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                    style={{ 
                      fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace', 
                      fontSize: '13px',
                      lineHeight: '1.5', 
                      tabSize: 2, 
                      color: 'transparent',
                      boxSizing: 'border-box',
                      transform: 'translateY(1.5px)'
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="secondary" size="icon" aria-label="Reset zoom" onClick={handleResetZoom}>
              <RotateCcw className="size-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </Button>
            <div className="relative" ref={downloadDropdownRef}>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Download diagram"
                onClick={() => setShowDownloadDropdown((v) => !v)}
              >
                <Download className="size-5" />
              </Button>
              {showDownloadDropdown && (
                <div className="absolute right-0 mt-2 w-auto bg-card rounded-md shadow-lg z-10 border border-border">
                  <ul className="py-1">
                    <li>
                      <button
                        className="block w-full text-left px-3 py-2 text-card-foreground hover:bg-muted"
                        onClick={handleDownloadPng}
                      >
                        PNG
                      </button>
                    </li>
                    <li>
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <button
                              className="block w-full text-left px-3 py-2 text-card-foreground hover:bg-muted"
                              onClick={handleDownloadSvg}
                            >
                              SVG
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Figma Design compatible</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            {showEditButton && onEdit && (
              <Button variant="default" size="sm" onClick={onEdit} className="ml-1 h-10 gap-1.5 px-3 hidden sm:flex">
                <Pencil className="size-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
          </div>
        </div>
        <CardContent className="p-0 flex-1 relative min-h-[280px] md:min-h-0 flex flex-col">
          {loading && (
            <div className="absolute top-4 right-4 z-20 flex items-center bg-background/90 backdrop-blur-sm border rounded-full px-3 py-1.5 shadow-sm gap-2">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{isStreaming ? 'Drawing...' : 'Updating diagram...'}</span>
            </div>
          )}
          {renderError ? (
            <div className="text-center min-h-[300px] h-full flex flex-col items-center justify-center p-4 gap-3">
              <div className="text-base font-semibold text-red-500">Failed to display SVG</div>
              <div className="text-sm text-red-500/90 max-w-md">
                {renderError.length > 200 ? renderError.slice(0, 200) + '…' : renderError}
              </div>
              {onAutoFix && (
                <Button
                  type="button"
                  variant="default"
                  className="mt-1 rounded-full gap-2"
                  disabled={loading}
                  onClick={onAutoFix}
                  aria-label="Auto-fix SVG with AI"
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Fixing…
                    </>
                  ) : (
                    <>
                      <Wrench className="size-4" />
                      Auto-fix
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-muted-foreground max-w-sm">
                Asks the AI to repair invalid markup while keeping the diagram content.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative w-full flex-1 flex justify-center items-center overflow-hidden p-4 min-h-[200px]"
              style={{ position: 'relative' }}
              suppressHydrationWarning
            >
              {isMounted && <div ref={wrapperRef} className="w-full h-full flex items-center justify-center origin-top-left outline-none"></div>}
              {hoverBox && (
                <div
                  className="pointer-events-none absolute z-10 rounded-sm border-2 border-dashed border-sky-400/80 bg-sky-400/10"
                  style={{
                    left: hoverBox.left,
                    top: hoverBox.top,
                    width: hoverBox.width,
                    height: hoverBox.height,
                  }}
                />
              )}
              {selectedBoxes.map((box, i) => (
                <div
                  key={`sel-${i}-${box.left}-${box.top}`}
                  className="pointer-events-none absolute z-10 rounded-sm border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  }}
                />
              ))}
              {editingText && (
                <div
                  className="absolute z-50 flex"
                  style={{
                    left: editingText.left - 10,
                    top: editingText.top - 10,
                  }}
                >
                  <textarea
                    autoFocus
                    defaultValue={editingText.value}
                    onBlur={(e) => handleTextEditComplete(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleTextEditComplete(e.currentTarget.value);
                      }
                      if (e.key === 'Escape') setEditingText(null);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="border border-primary shadow-lg bg-background text-foreground text-sm px-2 py-1 outline-none min-w-[150px] min-h-[40px] rounded resize-both"
                    style={{ width: Math.max(150, editingText.width), height: Math.max(40, editingText.height) }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
