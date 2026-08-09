'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, Loader2, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OutlinerHistorySidebar() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  const pathname = usePathname();
  const params = useParams();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchHistory = useCallback(async (isLoadMore = false) => {
    const currentOffset = isLoadMore ? history.length : 0;
    
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const url = new URL('/api/outliner/history', window.location.origin);
      url.searchParams.set('offset', currentOffset.toString());
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString());
      
      let data = [];
      if (res.ok) {
        data = await res.json();
      }

      const moreAvailable = data.length >= 50;

      if (!isLoadMore) {
        setHistory(data);
      } else {
        setHistory(prev => [...prev, ...data]);
      }
      setHasMore(moreAvailable);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [history.length]);

  useEffect(() => {
    fetchHistory(false);
  }, [pathname, params?.id]);

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
    window.addEventListener('toggleOutlinerHistorySidebar', handleToggle);
    return () => window.removeEventListener('toggleOutlinerHistorySidebar', handleToggle);
  }, []);

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
          "fixed left-0 top-0 z-[55] flex h-full w-72 flex-col border-r border-black/[0.07] bg-[#f7f7f5]/95 shadow-[8px_0_32px_rgba(25,25,24,0.08)] backdrop-blur-xl transition-transform duration-300 dark:border-white/[0.08] dark:bg-[#141413]/95 dark:shadow-[8px_0_36px_rgba(0,0,0,0.32)]",
          !isOpen && "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.06] px-4 dark:border-white/[0.07]">
          <h2 className="text-sm font-semibold tracking-[-0.01em]">
            Recent Outlines
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="-mr-2 size-8 rounded-lg text-black/45 hover:bg-black/[0.06] dark:text-white/45 dark:hover:bg-white/[0.07]" title="Close">
            <ChevronLeft size={16} />
          </Button>
        </div>
        
        <div className="flex-1 space-y-3 overflow-y-auto p-2 scrollbar-thin">
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">
              No previous research sessions found.
            </div>
          ) : (
            <>
              {history.map((query, index) => {
                const isLast = index === history.length - 1;
                const isQueryActive = pathname === query.id;
                
                return (
                  <div key={`${query.id}-${index}`} ref={isLast ? lastItemRef : null} className="space-y-1">
                    <Link 
                      href={query.id}
                      className={cn(
                        "group flex flex-col gap-1 rounded-xl p-2.5 text-sm transition-colors",
                        isQueryActive 
                          ? "bg-black/[0.075] font-medium text-black dark:bg-white/[0.1] dark:text-white"
                          : "text-black/52 hover:bg-black/[0.045] hover:text-black dark:text-white/52 dark:hover:bg-white/[0.06] dark:hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          <Search size={14} className="text-black/35 dark:text-white/35" />
                        </div>
                        <span className="line-clamp-2 leading-tight font-medium">
                          {query.title}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-70 ml-6">
                        {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}
                      </span>
                    </Link>

                    {/* Render Drafts */}
                    {query.drafts && query.drafts.length > 0 && (
                      <div className="ml-[15px] space-y-1 border-l border-black/[0.09] pl-[6px] dark:border-white/[0.1]">
                        {query.drafts.map((draft: any) => {
                          const isDraftActive = pathname === draft.id;
                          return (
                            <Link 
                              key={draft.id}
                              href={draft.id}
                              className={cn(
                                "group flex flex-col gap-1 rounded-lg p-2 text-xs transition-colors",
                                isDraftActive 
                                  ? "bg-black/[0.075] font-medium text-black dark:bg-white/[0.1] dark:text-white"
                                  : "text-black/48 hover:bg-black/[0.045] hover:text-black dark:text-white/48 dark:hover:bg-white/[0.06] dark:hover:text-white"
                              )}
                              onClick={() => setIsOpen(false)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 shrink-0">
                                  <FileText size={12} className="text-black/32 dark:text-white/32" />
                                </div>
                                <span className="line-clamp-2 leading-tight">
                                  {draft.title}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
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
          className="fixed inset-0 z-[50] bg-black/18 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
