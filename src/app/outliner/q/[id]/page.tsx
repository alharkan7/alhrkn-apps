"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import IdeasGrid from '../../components/IdeasGrid';
import { Menu, ArrowLeft } from 'lucide-react';

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
        <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
            <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            </div>

            <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
                <AppsHeader 
                  leftButton={
                    <div className="flex items-center space-x-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full sidebar-toggle hover:bg-black/5 dark:hover:bg-white/10" 
                            onClick={() => window.dispatchEvent(new Event('toggleOutlinerHistorySidebar'))}
                        >
                            <Menu size={20} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full gap-2 hover:bg-black/5 dark:hover:bg-white/10"
                            aria-label="Go Back"
                            onClick={() => router.push('/outliner')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-medium">Back</span>
                        </Button>
                    </div>
                  }
                />
            </div>

            <div className="relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col pt-24 pb-28 px-4">
                {displayQuery && (
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold tracking-tight">
                            Research Ideas for: <span className="text-primary">{displayQuery}</span>
                        </h2>
                    </div>
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
                            className="h-11 px-6 text-base rounded-full"
                            disabled={isLoading || isLoadingMore}
                        >
                            {isLoadingMore ? 'Loading more...' : 'Show More'}
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
                <div className="flex-none">
                    <AppsFooter />
                </div>
            </div>
        </div>
    );
}
