"use client";

import { useState, FormEvent, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import IdeasGrid from './components/IdeasGrid'
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';

type ResearchIdea = {
    title: string;
    abstract: {
        background: string;
        literatureReview: string;
        method: string;
        analysisTechnique: string;
        impact: string;
    };
};

type Language = 'en' | 'id';

export default function OutlinerPage() {
    const router = useRouter();
    const [queryText, setQueryText] = useState<string>('');
    const [language, setLanguage] = useState<Language>('en');
    const [ideas, setIdeas] = useState<ResearchIdea[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasResponded, setHasResponded] = useState<boolean>(false);
    const controllerRef = useRef<AbortController | null>(null);
    // removed expectedCount-based skeleton logic

    // Function to handle language change
    const handleLanguageChange = (newLanguage: Language) => {
        console.log('Language changing from', language, 'to', newLanguage);
        setLanguage(newLanguage);
        localStorage.setItem('outliner-language', newLanguage);

        // Refetch ideas if we have a query and results, so they appear in the new language
        if (queryText.trim() && ideas && ideas.length > 0) {
            fetchIdeas(queryText.trim());
        }
    };

    // Function to toggle language
    const toggleLanguage = () => {
        const newLanguage = language === 'en' ? 'id' : 'en';
        handleLanguageChange(newLanguage);
    };

    const searchParams = useSearchParams();

    // Initialize from URL parameter (?q=...) and localStorage for language
    useEffect(() => {
        try {
            // Load language preference from localStorage
            const savedLanguage = localStorage.getItem('outliner-language') as Language;
            if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'id')) {
                setLanguage(savedLanguage);
            }

            const q = searchParams.get('q');
            // If the URL has a query, and it's different from our current text, fetch it!
            if (q && q.trim() && q.trim() !== queryText) {
                setQueryText(q);
                setHasResponded(false);
                fetchIdeas(q.trim());
            }
        } catch { }
        // We do NOT want to include queryText in dependencies to avoid infinite loops,
        // but we do want to re-run when searchParams change (like clicking a history item)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Debug language changes
    useEffect(() => {
        console.log('Language state changed to:', language);
    }, [language]);

    const fetchIdeas = async (keywords: string) => {
        setIsLoading(true);
        setError(null);
        setIdeas([]);
        try {
            if (controllerRef.current) controllerRef.current.abort();
            controllerRef.current = new AbortController();

            // Debug logging
            console.log('Sending request with language:', language);

            const res = await fetch('/api/outliner/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, numIdeas: 6, language }),
                signal: controllerRef.current.signal,
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({} as any));
                console.error('API Error Response:', { status: res.status, data });
                throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            setHasResponded(true);

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
                        const idea = JSON.parse(trimmed) as ResearchIdea;
                        console.log('Processing idea from stream:', { title: idea.title, currentCount: ideas?.length || 0 });
                        setIdeas((prev) => {
                            const existing = Array.isArray(prev) ? prev : [];
                            const seen = new Set(existing.map((i) => i.title.toLowerCase().trim()));
                            const key = String(idea?.title || '').toLowerCase().trim();
                            if (!key || seen.has(key)) {
                                console.log('Filtered out duplicate idea:', { title: idea?.title, existingCount: existing.length });
                                return existing;
                            }
                            console.log('Adding new idea:', { title: idea?.title, newCount: existing.length + 1 });
                            return [...existing, idea];
                        });
                    } catch { }
                }
            }

            const last = buffer.trim();
            if (last) {
                try {
                    const idea = JSON.parse(last) as ResearchIdea;
                    setIdeas((prev) => {
                        const existing = Array.isArray(prev) ? prev : [];
                        const seen = new Set(existing.map((i) => i.title.toLowerCase().trim()));
                        const key = String(idea?.title || '').toLowerCase().trim();
                        if (!key || seen.has(key)) return existing;
                        return [...existing, idea];
                    });
                } catch { }
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                console.error('Frontend fetchIdeas error:', e);
                setError(e?.message || (language === 'en' ? 'Something went wrong' : 'Terjadi kesalahan'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!queryText.trim() || queryText.trim().length < 10) return;
        setHasResponded(false);
        // Sync query to URL (?q=...)
        try {
            const params = new URLSearchParams(window.location.search);
            params.set('q', queryText.trim());
            router.replace(`?${params.toString()}`);
        } catch { }
        fetchIdeas(queryText.trim());
    };

    const hasResults = Array.isArray(ideas) && ideas.length > 0;

    const appendIdeas = async () => {
        if (!queryText.trim()) return;
        setIsLoadingMore(true);
        setError(null);
        try {
            // rely on isLoadingMore to control skeleton visibility
            console.log('Appending ideas with language:', language);
            const existingTitles = ideas ? ideas.map(i => i.title) : [];
            const res = await fetch('/api/outliner/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: queryText.trim(), numIdeas: 6, language, existingTitles })
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || (language === 'en' ? 'Failed to get more ideas' : 'Gagal mendapatkan ide tambahan'));
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
                        const idea = JSON.parse(trimmed) as ResearchIdea;
                        console.log('Processing idea from appendIdeas:', { title: idea.title, currentCount: ideas?.length || 0 });
                        setIdeas((prev) => {
                            const existing = Array.isArray(prev) ? prev : [];
                            const seen = new Set(existing.map((i) => i.title.toLowerCase().trim()));
                            const key = String(idea?.title || '').toLowerCase().trim();
                            if (!key || seen.has(key)) {
                                console.log('Filtered out duplicate idea (append):', { title: idea?.title, existingCount: existing.length });
                                return existing;
                            }
                            console.log('Adding new idea (append):', { title: idea?.title, newCount: existing.length + 1 });
                            return [...existing, idea];
                        });
                    } catch { }
                }
            }
            const last = buffer.trim();
            if (last) {
                try {
                    const idea = JSON.parse(last) as ResearchIdea;
                    setIdeas((prev) => {
                        const existing = Array.isArray(prev) ? prev : [];
                        const seen = new Set(existing.map((i) => i.title.toLowerCase().trim()));
                        const key = String(idea?.title || '').toLowerCase().trim();
                        if (!key || seen.has(key)) return existing;
                        return [...existing, idea];
                    });
                } catch { }
            }
        } catch (e: any) {
            setError(e?.message || (language === 'en' ? 'Something went wrong' : 'Terjadi kesalahan'));
        } finally {
            setIsLoadingMore(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
            {/* --- Ambient Background --- */}
            <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
                {/* Animated Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
                
                {/* Subtle Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            </div>

            <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
                <AppsHeader 
                  leftButton={
                    <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleOutlinerHistorySidebar'))}>
                      <Menu size={20} />
                    </Button>
                  }
                />
            </div>

            <div className={`relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col ${(hasResults || isLoading) ? 'pt-20' : 'pt-24'} pb-28 px-4`}>
                <div className={!isLoading && !hasResponded ? 'min-h-[calc(100vh-15rem)] flex flex-col justify-center relative group' : 'relative group w-full flex justify-center'}>
                    {!isLoading && !hasResponded && (
                        <div className="text-center pb-8 space-y-6 max-w-3xl mx-auto">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x whitespace-nowrap">Outliner</span>{' '}
                            </h1>
                            <div className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed">
                                {language === 'en' ? 'What do you want to research?' : 'Apa yang ingin kamu riset?'}
                            </div>
                        </div>
                    )}

                    <div className="w-full relative flex justify-center max-w-3xl mx-auto">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200"></div>
                        <form onSubmit={handleSubmit} className={`relative z-10 w-full bg-background/80 backdrop-blur-2xl transition-all duration-200 rounded-[2rem] border shadow-xl flex flex-col items-center focus:outline-none ${!isLoading && !hasResponded ? 'p-4 sm:p-6 pb-4' : 'p-2'}`}>
                            <div className="w-full flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="relative w-full sm:flex-1 flex items-center">
                                    <Input
                                        value={queryText}
                                        onChange={(e) => setQueryText(e.target.value)}
                                        placeholder={language === 'en' ? "Type your keywords or school major..." : "Input kata kunci atau jurusan studi..."}
                                        className="h-12 text-lg bg-transparent border-none text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 px-2 shadow-none rounded-none outline-none resize-none pl-4 pr-12 w-full"
                                    />
                                    <div className="absolute right-2 top-[50%] transform -translate-y-1/2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleLanguage}
                                            className="h-10 w-10 p-0 hover:bg-muted rounded-full"
                                            title={language === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
                                        >
                                            <Globe className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="shrink-0 grow-0 transition-colors disabled:opacity-50 w-auto rounded-full font-semibold px-6 h-12 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                                    disabled={isLoading || !queryText.trim() || queryText.trim().length < 10}
                                >
                                    {isLoading ? (language === 'en' ? 'Researching...' : 'Researching...') : (language === 'en' ? 'Outline' : 'Outline')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 text-center text-red-500 text-sm">
                        {language === 'en' ? error : (error === 'Failed to get ideas' ? 'Gagal mendapatkan ide' : error === 'Failed to get more ideas' ? 'Gagal mendapatkan ide tambahan' : error)}
                    </div>
                )}

                {ideas && (
                    <IdeasGrid
                        ideas={ideas}
                        isLoading={isLoading}
                        isLoadingMore={isLoadingMore}
                        language={language}
                    />
                )}
                {hasResults && (
                    <div className="mt-6 flex justify-center">
                        <Button
                            onClick={appendIdeas}
                            className="h-11 px-6 text-base rounded-full"
                            disabled={isLoading || isLoadingMore}
                        >
                            {isLoadingMore ? (language === 'en' ? 'Loading more...' : 'Memuat lebih banyak...') : (language === 'en' ? 'Show More' : 'Tampilkan Lebih Banyak')}
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
