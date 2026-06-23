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
  emptyMessage,
  onRenderIcon,
  onRenderTitle
}: HistorySidebarProps<T>) {
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
          "fixed top-0 left-0 h-full w-64 bg-background/95 backdrop-blur-xl border-r z-[55] shadow-2xl transition-transform duration-300 flex flex-col",
          !isOpen && "-translate-x-full"
        )}
      >
        <div className="h-14 px-4 border-b flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-lg">
            History
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 -mr-2" title="Close">
            <ChevronLeft size={16} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
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
                        "flex flex-col gap-1 p-3 rounded-lg text-sm transition-colors group",
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          {onRenderIcon(item)}
                        </div>
                        <span className="line-clamp-2 leading-tight">
                          {onRenderTitle(item)}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-70 ml-6">
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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
