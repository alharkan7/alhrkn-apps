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
    const [isOwner, setIsOwner] = useState<boolean>(true);
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
                    setIsOwner(data.isOwner ?? true);
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
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
            <div className="relative z-10 mx-auto flex min-h-[100vh] w-full max-w-5xl flex-col px-4 py-4 sm:px-8">
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
                    <FullDocumentEditor id={id} idea={idea} language={language} initialContent={initialContent} isOwner={isOwner} />
                )}
            </div>
        </div>
    );
}
