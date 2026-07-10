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
} from 'lucide-react';
import panzoom from 'panzoom';
import { toPng } from 'html-to-image';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
}

export function SvgArtifact({
  svg,
  loading = false,
  fileName,
  description,
  attachments = [],
  onAttachmentsChange,
  onAutoFix,
}: SvgArtifactProps) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRootRef = useRef<SVGSVGElement | null>(null);
  /** Live DOM nodes keyed by selectionKey for multi-select bounding boxes */
  const selectedElsRef = useRef<Map<string, SVGElement>>(new Map());
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

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
      setSafeSvg(sanitizeSvg(svg));
      setRenderError(null);
      selectedElsRef.current.clear();
      setSelectedBoxes([]);
      setHoverBox(null);
      // Parent should also clear attachments when svg string changes
    } catch (e: any) {
      setSafeSvg('');
      setRenderError(e?.message || 'Failed to sanitize SVG');
      selectedElsRef.current.clear();
      setSelectedBoxes([]);
    }
  }, [svg]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !safeSvg) return;

    // @ts-ignore
    if (container.__panzoomInstance) {
      // @ts-ignore
      container.__panzoomInstance.dispose();
      // @ts-ignore
      container.__panzoomInstance = null;
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(safeSvg, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      const detail = parseError.textContent?.trim().slice(0, 160);
      setRenderError(detail ? `Invalid SVG markup: ${detail}` : 'Invalid SVG markup');
      svgRootRef.current = null;
      return;
    }

    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') {
      setRenderError('Rendered SVG root not found');
      svgRootRef.current = null;
      return;
    }

    root.querySelectorAll('script, foreignObject').forEach((node) => node.remove());

    try {
      const svgElem = document.importNode(root, true) as unknown as SVGSVGElement;
      svgElem.style.maxWidth = '100%';
      svgElem.style.height = 'auto';
      svgElem.style.display = 'block';
      svgElem.style.cursor = 'crosshair';
      container.appendChild(svgElem);
      prepareSvgForSelection(svgElem);
      svgRootRef.current = svgElem;
      setRenderError(null);

      const instance = panzoom(svgElem as unknown as HTMLElement, {
        zoomDoubleClickSpeed: 1,
        maxZoom: 10,
        minZoom: 0.1,
        bounds: false,
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
        if (loadingRef.current || !onAttachmentsChange) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return; // Only left click for mouse

        const before = pointerDownTransformRef.current;
        const after = JSON.stringify(instance.getTransform());
        if (before && before !== after) return;

        const hit = findSelectableElementAtPoint(e.clientX, e.clientY, svgElem);
        if (!hit) {
          // Empty canvas: clear all attachments
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
          // ignore
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
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      };
    } catch (e: any) {
      setRenderError(e?.message || 'Failed to mount SVG');
      svgRootRef.current = null;
    }
  }, [safeSvg, refreshBoxes, onAttachmentsChange]);

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

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen ? 'w-screen h-screen bg-background p-2 md:p-4' : 'w-full h-full min-h-0'}
    >
      <Card className={isFullscreen ? 'w-full h-full shadow-lg flex flex-col max-w-none' : 'w-full h-full shadow-lg flex flex-col min-h-0'}>
        <div className="flex items-center justify-between p-2 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
            <span>Freeform SVG</span>
            {!renderError && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground/80">
                <MousePointer2 className="size-3" />
                Click to attach elements
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Sheet open={codeOpen} onOpenChange={setCodeOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="View SVG code">
                  <Code2 className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] max-w-xl">
                <SheetHeader>
                  <SheetTitle>SVG Source</SheetTitle>
                  <SheetDescription>
                    Read-only SVG markup for this freeform diagram.
                  </SheetDescription>
                </SheetHeader>
                <textarea
                  readOnly
                  value={safeSvg}
                  className="w-full h-[70vh] mt-4 p-2 border rounded bg-background text-foreground font-mono text-xs resize-vertical"
                />
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
                      <button
                        className="block w-full text-left px-3 py-2 text-card-foreground hover:bg-muted"
                        onClick={handleDownloadSvg}
                      >
                        SVG
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <CardContent className="p-0 flex-1 relative min-h-[280px] md:min-h-0 flex flex-col">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm gap-2">
              <LoaderCircle className="size-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Updating diagram…</span>
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
                      Auto-fix with AI
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
            >
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
