"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';

type Language = 'en' | 'id';

export default function OutlinerSearchPage() {
    const router = useRouter();
    const [queryText, setQueryText] = useState<string>('');
    const [language, setLanguage] = useState<Language>('en');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize from localStorage for language
    useEffect(() => {
        try {
            const savedLanguage = localStorage.getItem('outliner-language') as Language;
            if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'id')) {
                setLanguage(savedLanguage);
            }
        } catch { }
    }, []);

    const toggleLanguage = () => {
        const newLanguage = language === 'en' ? 'id' : 'en';
        setLanguage(newLanguage);
        localStorage.setItem('outliner-language', newLanguage);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedQuery = queryText.trim();
        if (!trimmedQuery || trimmedQuery.length < 10) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/outliner/queries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: trimmedQuery, language })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to initialize research session');
            }

            const data = await res.json();
            if (data.id) {
                router.push(`/outliner/q/${data.id}?q=${encodeURIComponent(trimmedQuery)}`);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err: any) {
            console.error('Error creating query:', err);
            setError(err.message || 'Something went wrong');
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
            {/* --- Ambient Background --- */}
            <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
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

            <div className={`relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col pt-24 pb-28 px-4`}>
                <div className="min-h-[calc(100vh-15rem)] flex flex-col justify-center relative group">
                    <div className="text-center pb-8 space-y-6 max-w-3xl mx-auto">
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x whitespace-nowrap">Outliner</span>{' '}
                        </h1>
                        <div className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed">
                            {language === 'en' ? 'What do you want to research?' : 'Apa yang ingin kamu riset?'}
                        </div>
                    </div>

                    <div className="w-full relative flex justify-center max-w-3xl mx-auto">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200"></div>
                        <form onSubmit={handleSubmit} className="relative z-10 w-full bg-background/80 backdrop-blur-2xl transition-all duration-200 rounded-[2rem] border shadow-xl flex flex-col items-center focus:outline-none p-4 sm:p-6 pb-4">
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
                                    {isLoading ? (language === 'en' ? 'Starting...' : 'Memulai...') : (language === 'en' ? 'Outline' : 'Outline')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 text-center text-red-500 text-sm">
                        {error}
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
