'use client';

import React, { useRef, useState, useEffect } from 'react';
import { List, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderItem {
    id: string;
    text: string;
    level: number;
    element: HTMLElement;
}

type MobileCorner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

const FAB_SIZE = 44;
const FAB_MARGIN = 16;
const FAB_MARGIN_TOP = 80;
const DRAG_THRESHOLD = 4;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function nearestCorner(x: number, y: number): MobileCorner {
  const left = x < window.innerWidth / 2;
  const top = y < window.innerHeight / 2;
  if (top && left) return 'top-left';
  if (top) return 'top-right';
  if (left) return 'bottom-left';
  return 'bottom-right';
}

function cornerPosition(corner: MobileCorner): { left: number; top: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (corner) {
    case 'top-left': return { left: FAB_MARGIN, top: FAB_MARGIN_TOP };
    case 'top-right': return { left: w - FAB_SIZE - FAB_MARGIN, top: FAB_MARGIN_TOP };
    case 'bottom-left': return { left: FAB_MARGIN, top: h - FAB_SIZE - FAB_MARGIN };
    default: return { left: w - FAB_SIZE - FAB_MARGIN, top: h - FAB_SIZE - FAB_MARGIN };
  }
}

export function DocumentMap({ containerId }: { containerId: string }) {
    const [headers, setHeaders] = useState<HeaderItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [mobileCorner, setMobileCorner] = useState<MobileCorner>('top-right');
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    const drag = useRef<{ sx: number; sy: number; ol: number; ot: number } | null>(null);
    const skipClickRef = useRef(false);
    const movedRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (window.innerWidth >= 1024) {
                setIsOpen(true);
            } else {
                setPos(cornerPosition('top-right'));
            }
        }
    }, []);

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth < 1024) {
                setPos((p) => (p ? cornerPosition(nearestCorner(p.left + FAB_SIZE / 2, p.top + FAB_SIZE / 2)) : cornerPosition('top-right')));
            } else {
                setPos(null);
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const updateHeaders = () => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const headerElements = Array.from(container.querySelectorAll('.ce-header, h1, h2, h3, h4, h5, h6, #references-header')) as HTMLElement[];
            
            const newHeaders = headerElements.map((el, index) => {
                let level = 2;
                if (el.id === 'references-header') {
                    level = 1;
                } else {
                    level = parseInt(el.tagName.replace('H', '')) || 2;
                }
                
                if (!el.id) {
                    el.id = `header-${index}-${Math.random().toString(36).substr(2, 9)}`;
                }
                
                return {
                    id: el.id,
                    text: el.textContent || '',
                    level,
                    element: el
                };
            }).filter(h => h.text.trim() !== '');
            
            setHeaders(newHeaders);
        };

        const debouncedUpdate = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateHeaders, 500);
        };

        // Initial update
        timeoutId = setTimeout(updateHeaders, 1000);

        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' || 
                    mutation.type === 'characterData' || 
                    (mutation.type === 'attributes' && ((mutation.target as HTMLElement).classList?.contains('ce-header') || /^H[1-6]$/.test((mutation.target as HTMLElement).tagName)))
                ) {
                    shouldUpdate = true;
                    break;
                }
            }
            if (shouldUpdate) {
                debouncedUpdate();
            }
        });

        // Ensure container is present before observing, wait a bit if needed
        const tryObserve = () => {
            const container = document.getElementById(containerId);
            if (container) {
                observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
                updateHeaders();
            } else {
                setTimeout(tryObserve, 500);
            }
        };
        
        tryObserve();

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [containerId]);

    const scrollToHeader = (element: HTMLElement) => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleTogglePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (window.innerWidth >= 1024 || !pos) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { sx: event.clientX, sy: event.clientY, ol: pos.left, ot: pos.top };
        movedRef.current = false;
        setIsDragging(true);
    };

    const handleTogglePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d || window.innerWidth >= 1024) return;

        const dx = event.clientX - d.sx;
        const dy = event.clientY - d.sy;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            movedRef.current = true;
        }
        setPos({
            left: clamp(d.ol + dx, FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN),
            top: clamp(d.ot + dy, FAB_MARGIN_TOP, window.innerHeight - FAB_SIZE - FAB_MARGIN),
        });
    };

    const handleTogglePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (window.innerWidth >= 1024) return;
        const d = drag.current;
        drag.current = null;
        setIsDragging(false);
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
        if (!d) return;

        if (movedRef.current) {
            const corner = nearestCorner(event.clientX, event.clientY);
            setMobileCorner(corner);
            setPos(cornerPosition(corner));
            skipClickRef.current = true;
        }
    };

    const handleToggleClick = () => {
        if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
        }
        setIsOpen((open) => !open);
    };

    const mobileCornerClass = {
        'top-right': 'right-4 top-20 items-end',
        'top-left': 'left-4 top-20 items-start',
        'bottom-right': 'right-4 bottom-4 items-end',
        'bottom-left': 'left-4 bottom-4 items-start',
    }[mobileCorner];

    if (headers.length === 0) return null;

    return (
        <div className={cn(
            'fixed z-40 flex flex-col lg:bottom-auto lg:left-auto lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:items-end pointer-events-none',
            mobileCornerClass
        )}>
            {!isOpen && (
                <button
                    onClick={handleToggleClick}
                    onPointerDown={handleTogglePointerDown}
                    onPointerMove={handleTogglePointerMove}
                    onPointerUp={handleTogglePointerUp}
                    onPointerCancel={handleTogglePointerUp}
                    style={pos ? { left: pos.left, top: pos.top, position: 'fixed', zIndex: 50, width: FAB_SIZE, height: FAB_SIZE } : undefined}
                    className={cn(
                        'pointer-events-auto flex items-center justify-center touch-none select-none rounded-full border border-black/[0.08] bg-white p-3 text-black/50 shadow-sm hover:bg-black/[0.04] hover:text-[#191918] hover:shadow-md focus:outline-none dark:border-white/[0.1] dark:bg-[#1b1b19] dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white',
                        isDragging ? 'cursor-grabbing shadow-lg transition-none' : 'cursor-grab transition-[left,top,transform,background-color] duration-200'
                    )}
                    title="Open Document Map"
                    aria-label="Open Document Map"
                >
                    <List size={18} />
                </button>
            )}

            <div
                className={cn(
                    "pointer-events-auto overflow-hidden rounded-xl border border-black/[0.08] bg-white/95 shadow-xl backdrop-blur-md transition-all duration-300 ease-in-out origin-right dark:border-white/[0.1] dark:bg-[#1b1b19]/95",
                    isOpen ? "max-h-[60vh] w-64 scale-100 opacity-100" : "h-0 w-0 scale-95 border-transparent opacity-0"
                )}
            >
                <div className="flex h-12 items-center justify-between border-b border-black/[0.06] px-3 dark:border-white/[0.08]">
                    <h3 className="!m-0 flex h-8 items-center px-1 text-xs font-semibold uppercase !leading-none tracking-wider text-black/50 dark:text-white/50">Document Map</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] bg-black/[0.025] text-black/50 transition-colors hover:bg-black/[0.06] hover:text-[#191918] focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white"
                        title="Hide Document Map"
                        aria-label="Hide Document Map"
                    >
                        <ChevronRight size={17} />
                    </button>
                </div>
                <div className="max-h-[calc(60vh-48px)] overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/15">
                    <ul className="m-0 list-none space-y-1 p-0 pb-2">
                        {headers.map((header) => (
                            <li 
                                key={header.id}
                                className="m-0 p-0"
                                style={{ marginLeft: `${(header.level - 1) * 0.75}rem` }}
                            >
                                <button
                                    onClick={() => scrollToHeader(header.element)}
                                    className="flex w-full items-center rounded-md py-1.5 pl-1.5 pr-2 text-left text-sm text-[#191918]/75 transition-colors hover:bg-black/[0.045] hover:text-[#191918] dark:text-[#f2f2ef]/75 dark:hover:bg-white/[0.06] dark:hover:text-[#f2f2ef]"
                                    title={header.text}
                                >
                                    <span className="flex w-3 flex-shrink-0 items-center justify-start">
                                        <span className="h-[3px] w-[3px] rounded-full bg-black/40 dark:bg-white/40" />
                                    </span>
                                    <span className="truncate flex-1">{header.text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
