'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BaseHistoryItem {
  id: string;
  createdAt: string;
  [key: string]: any;
}

interface HistorySidebarProps<T extends BaseHistoryItem> {
  apiEndpoint?: string;
  cacheKey?: string;
  fetchItems?: (offset: number) => Promise<T[]>;
  itemUrlPrefix: string;
  eventName: string;
  title?: string;
  variant?: 'default' | 'quiet';
  emptyMessage: string;
  onRenderIcon: (item: T) => React.ReactNode;
  onRenderTitle: (item: T) => string;
}

const globalCache: Record<string, { data: any[]; lastFetchTime: number; hasMore: boolean }> = {};
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
const PAGE_SIZE = 50;

export function HistorySidebar<T extends BaseHistoryItem>({
  apiEndpoint,
  cacheKey,
  fetchItems,
  itemUrlPrefix,
  eventName,
  title = 'History',
  variant = 'default',
  emptyMessage,
  onRenderIcon,
  onRenderTitle
}: HistorySidebarProps<T>) {
  const isQuiet = variant === 'quiet';
  const key = cacheKey || apiEndpoint || 'default';
  const [history, setHistory] = useState<T[]>(globalCache[key]?.data || []);
  const [loading, setLoading] = useState(!globalCache[key]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache[key]?.hasMore ?? true);
  const [isOpen, setIsOpen] = useState(false);
  
  const pathname = usePathname();
  const params = useParams();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchHistory = useCallback(async (isLoadMore = false) => {
    const now = Date.now();
    const currentId = params?.id as string | undefined;
    const cacheEntry = globalCache[key];
    const currentOffset = isLoadMore ? history.length : 0;
    
    // For initial load, check cache
    if (!isLoadMore) {
      const isMissingCurrentId = currentId && cacheEntry?.data && !cacheEntry.data.find((h: T) => h.id === currentId);
      if (cacheEntry && (now - cacheEntry.lastFetchTime) < CACHE_DURATION && !isMissingCurrentId) {
        setHistory(cacheEntry.data);
        setHasMore(cacheEntry.hasMore);
        setLoading(false);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let data: T[] = [];

      if (fetchItems) {
        data = await fetchItems(currentOffset);
      } else if (apiEndpoint) {
        const url = new URL(apiEndpoint, window.location.origin);
        url.searchParams.set('offset', currentOffset.toString());
        url.searchParams.set('limit', PAGE_SIZE.toString());
        const res = await fetch(url.toString());
        if (res.ok) {
          data = await res.json();
        }
      }

      const moreAvailable = data.length >= PAGE_SIZE;

      if (!isLoadMore) {
        globalCache[key] = { data, lastFetchTime: Date.now(), hasMore: moreAvailable };
        setHistory(data);
      } else {
        setHistory(prev => {
          const merged = [...prev, ...data];
          globalCache[key] = { data: merged, lastFetchTime: Date.now(), hasMore: moreAvailable };
          return merged;
        });
      }
      setHasMore(moreAvailable);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [key, apiEndpoint, fetchItems, history.length, params?.id]);

  // Initial load
  useEffect(() => {
    fetchHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params?.id, apiEndpoint, cacheKey]); // Intentionally omitting fetchItems and key to avoid loops

  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchHistory(true);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, fetchHistory]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener(eventName, handleToggle);
    return () => window.removeEventListener(eventName, handleToggle);
  }, [eventName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.sidebar-toggle')) return;
      
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <div 
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-[55] flex h-full flex-col border-r backdrop-blur-xl transition-transform duration-300",
          isQuiet
            ? "w-72 border-black/[0.065] bg-[#f7f7f5]/95 shadow-[16px_0_48px_rgba(25,25,24,0.08)] dark:border-white/[0.08] dark:bg-[#151513]/95 dark:shadow-[16px_0_54px_rgba(0,0,0,0.32)]"
            : "w-64 bg-background/95 shadow-2xl",
          !isOpen && "-translate-x-full"
        )}
      >
        <div className={cn(
          "flex shrink-0 items-center justify-between border-b px-4",
          isQuiet ? "h-16 border-black/[0.055] dark:border-white/[0.07]" : "h-14"
        )}>
          <h2 className={cn(
            "font-semibold",
            isQuiet ? "text-sm tracking-[-0.01em] text-black/75 dark:text-white/75" : "text-lg"
          )}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className={cn(
              "-mr-2 h-8 w-8",
              isQuiet && "rounded-xl text-black/40 hover:bg-black/[0.05] hover:text-black dark:text-white/40 dark:hover:bg-white/[0.07] dark:hover:text-white"
            )}
            title="Close"
          >
            <ChevronLeft size={16} />
          </Button>
        </div>
        
        <div className={cn(
          "flex-1 overflow-y-auto p-2 scrollbar-thin",
          isQuiet ? "space-y-0.5" : "space-y-1"
        )}>
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <>
              {history.map((item, index) => {
                const isActive = params?.id === item.id;
                const isLast = index === history.length - 1;
                
                return (
                  <div key={`${item.id}-${index}`} ref={isLast ? lastItemRef : null}>
                    <Link 
                      href={`${itemUrlPrefix}${item.id}`}
                      className={cn(
                        "group flex flex-col gap-1 transition-all",
                        isQuiet ? "rounded-xl p-2.5 text-[13px]" : "rounded-lg p-3 text-sm",
                        isActive && isQuiet
                          ? "bg-white font-medium text-black shadow-[0_1px_4px_rgba(25,25,24,0.08)] dark:bg-white/[0.09] dark:text-white dark:shadow-none"
                          : isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : isQuiet
                              ? "text-black/52 hover:bg-black/[0.045] hover:text-black/80 dark:text-white/48 dark:hover:bg-white/[0.055] dark:hover:text-white/80"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "shrink-0",
                          isQuiet
                            ? "flex size-7 items-center justify-center rounded-lg bg-black/[0.045] text-black/45 transition-colors group-hover:bg-black/[0.07] group-hover:text-black/70 dark:bg-white/[0.055] dark:text-white/45 dark:group-hover:bg-white/[0.09] dark:group-hover:text-white/70"
                            : "mt-0.5"
                        )}>
                          {onRenderIcon(item)}
                        </div>
                        <span className={cn(
                          "line-clamp-2 leading-tight",
                          isQuiet && "pt-1"
                        )}>
                          {onRenderTitle(item)}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] opacity-70",
                        isQuiet ? "ml-9 text-black/38 dark:text-white/35" : "ml-6"
                      )}>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </Link>
                  </div>
                );
              })}
              {loadingMore && (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                  <Loader2 className="animate-spin w-4 h-4" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className={cn(
            "fixed inset-0 z-[50] md:hidden",
            isQuiet ? "bg-black/15 backdrop-blur-[2px]" : "bg-black/20 backdrop-blur-sm"
          )}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
