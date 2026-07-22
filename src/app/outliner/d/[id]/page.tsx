'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import '../../styles/editor.css';
import { ResearchIdea } from './utils';
import dynamic from 'next/dynamic';

const FullDocumentEditor = dynamic(
  () => import('./DocumentEditor').then((mod) => mod.FullDocumentEditor),
  { ssr: false }
);

export default function OutlinerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = (params?.id as string) || '';
    const [idea, setIdea] = useState<ResearchIdea | null>(null);
    const [initialContent, setInitialContent] = useState<any>(null);
    const [language, setLanguage] = useState<'en' | 'id'>('en');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        
        let ignore = false;
        
        const fetchDraft = async () => {
            try {
                // Fetch from DB
                const res = await fetch(`/api/outliner/drafts/${id}`);
                if (ignore) return;
                
                if (res.status === 401) {
                    router.push(`/login?next=/outliner/d/${id}`);
                    return;
                }

                if (res.ok) {
                    const data = await res.json();
                    setIdea({
                        title: data.title,
                        abstract: data.abstract
                    });
                    setInitialContent(data.content);
                    if (data.language) setLanguage(data.language);
                } else {
                    // Fallback to localStorage if draft not found in DB
                    const raw = localStorage.getItem(`outliner:${id}`);
                    const languagePref = localStorage.getItem(`outliner:${id}:language`) as 'en' | 'id';

                    if (raw) {
                        const parsedIdea = JSON.parse(raw);
                        setIdea(parsedIdea);
                    }
                    if (languagePref && (languagePref === 'en' || languagePref === 'id')) {
                        setLanguage(languagePref);
                    }
                }
            } catch (error) {
                if (ignore) return;
                console.error('Error loading draft:', error);
            } finally {
                if (!ignore) {
                    setIsLoading(false);
                }
            }
        };
        
        fetchDraft();
        
        return () => {
            ignore = true;
        };
    }, [id]);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
            <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            </div>

            <div className="relative z-10 min-h-[100vh] w-full max-w-5xl mx-auto px-4 sm:px-8 py-4 flex flex-col">
                {isLoading ? (
                    <div className="text-center pt-24">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-8 w-64 bg-muted rounded mb-4"></div>
                            <div className="h-4 w-48 bg-muted rounded"></div>
                        </div>
                    </div>
                ) : !idea ? (
                    <div className="text-center pt-24">
                        <p className="opacity-70 mb-4">No content found for this paper. It may have expired or was not saved.</p>
                        <button
                            onClick={() => window.history.back()}
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Go back
                        </button>
                    </div>
                ) : (
                    <FullDocumentEditor id={id} idea={idea} language={language} initialContent={initialContent} />
                )}
            </div>
        </div>
    );
}
