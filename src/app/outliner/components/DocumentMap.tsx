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

export function DocumentMap({ containerId }: { containerId: string }) {
    const [headers, setHeaders] = useState<HeaderItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [mobileCorner, setMobileCorner] = useState<MobileCorner>('top-right');
    const [isDragging, setIsDragging] = useState(false);
    const pointerRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
    const skipClickRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setIsOpen(true);
        }
    }, []);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const updateHeaders = () => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const headerElements = Array.from(container.querySelectorAll('.ce-header, #references-header')) as HTMLElement[];
            
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
                    (mutation.type === 'attributes' && (mutation.target as HTMLElement).classList?.contains('ce-header'))
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
        if (window.innerWidth >= 1024) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerRef.current = { x: event.clientX, y: event.clientY, moved: false };
        setIsDragging(true);
    };

    const handleTogglePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        const pointer = pointerRef.current;
        if (!pointer) return;

        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) {
            pointer.moved = true;
        }
    };

    const handleTogglePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        const pointer = pointerRef.current;
        if (!pointer) return;

        if (pointer.moved) {
            const isLeft = event.clientX < window.innerWidth / 2;
            const isTop = event.clientY < window.innerHeight / 2;
            setMobileCorner(`${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}` as MobileCorner);
            skipClickRef.current = true;
        }

        pointerRef.current = null;
        setIsDragging(false);
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
            'fixed z-40 flex flex-col lg:bottom-auto lg:left-auto lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:items-end',
            mobileCornerClass
        )}>
            {!isOpen && (
                <button
                    onClick={handleToggleClick}
                    onPointerDown={handleTogglePointerDown}
                    onPointerMove={handleTogglePointerMove}
                    onPointerUp={handleTogglePointerUp}
                    onPointerCancel={handleTogglePointerUp}
                    className={cn(
                        'touch-none select-none rounded-full border border-black/[0.08] bg-white p-3 text-black/50 shadow-sm transition-all hover:bg-black/[0.04] hover:text-[#191918] hover:shadow-md focus:outline-none dark:border-white/[0.1] dark:bg-[#1b1b19] dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white',
                        isDragging ? 'cursor-grabbing shadow-lg' : 'cursor-grab'
                    )}
                    title="Open Document Map"
                    aria-label="Open Document Map"
                >
                    <List size={18} />
                </button>
            )}

            <div
                className={cn(
                    "overflow-hidden rounded-xl border border-black/[0.08] bg-white/95 shadow-xl backdrop-blur-md transition-all duration-300 ease-in-out origin-right dark:border-white/[0.1] dark:bg-[#1b1b19]/95",
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
                    <ul className="space-y-1 pb-2">
                        {headers.map((header) => (
                            <li 
                                key={header.id}
                                style={{ paddingLeft: `${(header.level - 1) * 0.75}rem` }}
                            >
                                <button
                                    onClick={() => scrollToHeader(header.element)}
                                    className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-[#191918]/75 transition-colors hover:bg-black/[0.045] hover:text-[#191918] dark:text-[#f2f2ef]/75 dark:hover:bg-white/[0.06] dark:hover:text-[#f2f2ef]"
                                    title={header.text}
                                >
                                    {header.text}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
