"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import IdeasGrid from '../../components/IdeasGrid';
import { Menu } from 'lucide-react';

export default function OutlinerQueryPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryId = (params?.id as string) || '';
    const initialQuery = searchParams.get('q') || '';
    
    const [queryData, setQueryData] = useState<any>(null);
    const displayQuery = queryData?.keywords || initialQuery;
    const [ideas, setIdeas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
        if (!queryId) return;

        let ignore = false;

        const fetchQuery = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/outliner/queries/${queryId}`);
                
                if (res.status === 401) {
                    router.push(`/login?next=/outliner/q/${queryId}`);
                    return;
                }

                if (!res.ok) throw new Error('Failed to load query');
                const data = await res.json();
                
                if (ignore) return;
                
                setQueryData(data);
                
                if (data.ideas && data.ideas.length > 0) {
                    setIdeas(data.ideas);
                    setIsLoading(false);
                } else {
                    // Trigger stream if no ideas yet
                    streamIdeas(data.keywords, data.language);
                }
            } catch (err: any) {
                if (ignore) return;
                console.error(err);
                setError('Failed to load research session.');
                setIsLoading(false);
            }
        };

        fetchQuery();
        
        return () => {
            ignore = true;
        };
    }, [queryId]);

    const streamIdeas = async (keywords: string, language: string, existingTitles: string[] = []) => {
        if (existingTitles.length === 0) setIsLoading(true);
        else setIsLoadingMore(true);

        if (controllerRef.current) controllerRef.current.abort();
        const abortController = new AbortController();
        controllerRef.current = abortController;

        try {
            const res = await fetch('/api/outliner/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queryId, keywords, language, existingTitles }),
                signal: abortController.signal,
            });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({} as any));
                throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                let idx: number;
                
                while ((idx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 1);
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    
                    try {
                        const idea = JSON.parse(trimmed);
                        setIdeas((prev) => {
                            const seen = new Set(prev.map((i) => i.title.toLowerCase().trim()));
                            const key = String(idea?.title || '').toLowerCase().trim();
                            if (!key || seen.has(key)) return prev;
                            return [...prev, idea];
                        });
                    } catch { }
                }
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                setError('Failed to fetch ideas.');
            }
        } finally {
            if (controllerRef.current === abortController) {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        }
    };

    const appendIdeas = () => {
        if (!queryData) return;
        const existingTitles = ideas.map(i => i.title);
        streamIdeas(queryData.keywords, queryData.language, existingTitles);
    };

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
                <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
                <motion.div
                    className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/[0.065] blur-3xl dark:bg-blue-500/[0.075]"
                    animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.4, 0.65, 0.4] }}
                    transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
                <AppsHeader
                  leftButton={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
                      onClick={() => window.dispatchEvent(new Event('toggleOutlinerHistorySidebar'))}
                      aria-label="Open outline history"
                    >
                      <Menu size={18} />
                    </Button>
                  }
                  title={
                    <Link
                      href="/outliner"
                      title="Back to Outliner"
                      className="inline-flex items-center text-sm font-semibold tracking-[-0.01em] text-[#191918] transition-opacity hover:opacity-65 dark:text-[#f2f2ef]"
                    >
                      Outliner
                    </Link>
                  }
                />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-20 pb-24">
                {displayQuery && (
                    <h1 className="mb-2 text-balance text-2xl font-semibold tracking-tight text-[#191918] dark:text-[#f2f2ef]">
                        <span className="text-black/45 dark:text-white/45">Research ideas for </span>{displayQuery}
                    </h1>
                )}
                
                {error && (
                    <div className="mt-6 text-center text-red-500 text-sm">
                        {error}
                    </div>
                )}

                {(ideas.length > 0 || isLoading) && (
                    <IdeasGrid
                        ideas={ideas}
                        isLoading={isLoading}
                        isLoadingMore={isLoadingMore}
                        language={queryData?.language || 'en'}
                        queryId={queryId}
                    />
                )}
                
                {ideas.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <Button
                            onClick={appendIdeas}
                            className="h-10 rounded-full px-6"
                            disabled={isLoading || isLoadingMore}
                        >
                            {isLoadingMore ? 'Loading more…' : 'Show more'}
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
                <div className="flex-none">
                    <AppsFooter />
                </div>
            </div>
        </div>
    );
}
