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
          "fixed top-0 left-0 h-full w-72 bg-background/95 backdrop-blur-xl border-r z-[55] shadow-2xl transition-transform duration-300 flex flex-col",
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
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
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
                        "flex flex-col gap-1 p-2 rounded-lg text-sm transition-colors group",
                        isQueryActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          <Search size={14} className="text-primary/70" />
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
                      <div className="space-y-1 border-l border-border/50 ml-[15px] pl-[6px]">
                        {query.drafts.map((draft: any) => {
                          const isDraftActive = pathname === draft.id;
                          return (
                            <Link 
                              key={draft.id}
                              href={draft.id}
                              className={cn(
                                "flex flex-col gap-1 p-2 rounded-lg text-xs transition-colors group",
                                isDraftActive 
                                  ? "bg-primary/10 text-primary font-medium" 
                                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => setIsOpen(false)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 shrink-0">
                                  <FileText size={12} className="text-blue-500" />
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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
