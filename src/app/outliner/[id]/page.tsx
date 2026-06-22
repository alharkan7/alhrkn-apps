'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import '../styles/editor.css';
import { ResearchIdea} from './utils';
import { FullDocumentEditor } from './DocumentEditor';

export default function OutlinerDetailPage() {
    const params = useParams();
    const id = (params?.id as string) || '';
    const [idea, setIdea] = useState<ResearchIdea | null>(null);
    const [language, setLanguage] = useState<'en' | 'id'>('en');

    useEffect(() => {
        if (!id) return;
        try {
            const raw = localStorage.getItem(`outliner:${id}`);
            const languagePref = localStorage.getItem(`outliner:${id}:language`) as 'en' | 'id';

            if (raw) {
                const parsedIdea = JSON.parse(raw);
                console.log('Loaded idea:', parsedIdea);
                setIdea(parsedIdea);
            }

            if (languagePref && (languagePref === 'en' || languagePref === 'id')) {
                setLanguage(languagePref);
            }
        } catch (error) {
            console.error('Error loading idea from localStorage:', error);
            // Clear corrupted data
            localStorage.removeItem(`outliner:${id}`);
        }
    }, [id]);

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

            <div className="relative z-10 min-h-[100vh] w-full max-w-3xl mx-auto px-4 py-2 flex flex-col">
                {!idea ? (
                    <div className="text-center pt-24">
                        <p className="opacity-70 mb-4">No content found for this paper. It may have expired from your browser storage.</p>
                        <button
                            onClick={() => window.history.back()}
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Go back to outliner
                        </button>
                    </div>
                ) : (
                    <FullDocumentEditor id={id} idea={idea} language={language} />
                )}
            </div>
        </div>
    );
}

