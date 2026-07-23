'use client';

import React, { useState, useEffect } from 'react';
import { List, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderItem {
    id: string;
    text: string;
    level: number;
    element: HTMLElement;
}

export function DocumentMap({ containerId }: { containerId: string }) {
    const [headers, setHeaders] = useState<HeaderItem[]>([]);
    const [isOpen, setIsOpen] = useState(true);

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

    if (headers.length === 0) return null;

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white dark:bg-zinc-900 border border-border shadow-sm rounded-full p-3 text-muted-foreground hover:text-foreground transition-all focus:outline-none mb-2 hover:shadow-md"
                title="Toggle Document Map"
            >
                {isOpen ? <ChevronRight size={20} /> : <List size={20} />}
            </button>
            
            <div 
                className={cn(
                    "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-border shadow-xl rounded-xl overflow-hidden transition-all duration-300 ease-in-out origin-right",
                    isOpen ? "opacity-100 scale-100 w-64 max-h-[60vh] border" : "opacity-0 scale-95 w-0 h-0 border-transparent"
                )}
            >
                <div className="p-4 overflow-y-auto max-h-[60vh] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Document Map</h3>
                    <ul className="space-y-1 pb-2">
                        {headers.map((header) => (
                            <li 
                                key={header.id}
                                style={{ paddingLeft: `${(header.level - 1) * 0.75}rem` }}
                            >
                                <button
                                    onClick={() => scrollToHeader(header.element)}
                                    className="text-left w-full text-sm text-foreground/80 hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors truncate"
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
