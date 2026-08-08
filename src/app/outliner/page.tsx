"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, Globe, Menu } from 'lucide-react';
import AppsFooter from '@/components/apps-footer'
import { AppsHeader } from '@/components/apps-header'
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

type Language = 'en' | 'id';

export default function OutlinerSearchPage() {
    const router = useRouter();
    const prefersReducedMotion = useReducedMotion();
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
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
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
                  title={<span className="text-sm font-semibold tracking-[-0.01em]">Outliner</span>}
                />
            </div>

            <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
                <motion.section
                    initial={prefersReducedMotion ? false : 'hidden'}
                    animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
                    className="my-auto w-full py-4 sm:py-6"
                >
                    <motion.div
                        variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                        className="mx-auto mb-6 max-w-3xl text-center sm:mb-7"
                    >
                        <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">
                            {language === 'en' ? 'Draft Research Outline' : 'Buat Kerangka Riset'}
                        </h1>
                    </motion.div>

                    <motion.div
                        variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }}
                        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                        className="relative mx-auto w-full max-w-2xl"
                    >
                        <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
                        <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
                        <form onSubmit={handleSubmit} className="relative flex w-full flex-col rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] outline-none transition-shadow duration-300 focus-within:shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(59,130,246,0.11)] dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] dark:focus-within:shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_0_3px_rgba(96,165,250,0.12)] sm:p-4">
                            <Input
                                value={queryText}
                                onChange={(e) => setQueryText(e.target.value)}
                                placeholder={language === 'en' ? 'Enter a topic or research question…' : 'Masukkan topik atau pertanyaan riset…'}
                                className="h-auto min-h-[92px] w-full rounded-none border-none bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none outline-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
                            />
                            <div className="flex w-full items-center justify-between gap-2 border-t border-black/[0.055] px-1 pt-3 dark:border-white/[0.07]">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleLanguage}
                                    className="h-9 rounded-xl border border-black/[0.065] bg-black/[0.025] px-3 text-xs font-medium text-black/50 shadow-none hover:bg-black/[0.055] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/48 dark:hover:bg-white/[0.07] dark:hover:text-white"
                                    title={language === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
                                >
                                    <Globe className="mr-1.5 size-3.5" />
                                    {language === 'en' ? 'EN' : 'ID'}
                                </Button>
                                <Button
                                    type="submit"
                                    className="group h-10 shrink-0 rounded-xl bg-[#191918] px-4 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
                                    disabled={isLoading || !queryText.trim() || queryText.trim().length < 10}
                                >
                                    {isLoading ? (language === 'en' ? 'Starting…' : 'Memulai…') : 'Outline'}
                                    {!isLoading && <ArrowUp className="ml-1 size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} />}
                                </Button>
                            </div>
                        </form>
                    </motion.div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-600 dark:text-red-400">
                            {error}
                        </motion.div>
                    )}
                </motion.section>
            </main>
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
                <div className="flex-none">
                    <AppsFooter />
                </div>
            </div>
        </div>
    );
}
