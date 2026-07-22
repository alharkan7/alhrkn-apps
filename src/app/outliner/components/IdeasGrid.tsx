"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Lightbulb, BookOpen, Microscope, LineChart, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function IdeasGrid({
    ideas,
    isLoading,
    isLoadingMore,
    language = 'en'
}: {
    ideas: ResearchIdea[],
    isLoading: boolean,
    isLoadingMore: boolean,
    language?: Language
}) {
    const [open, setOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isExpanding, setIsExpanding] = useState(false);
    const router = useRouter();

    const selected: ResearchIdea | null = useMemo(() => {
        if (selectedIndex === null) return null;
        return ideas?.[selectedIndex] ?? null;
    }, [ideas, selectedIndex]);

    // Show a single skeleton while loading
    const showSkeleton = isLoading || isLoadingMore;

    // Debug logging
    console.log('IdeasGrid render:', {
        ideasCount: ideas.length,
        isLoading,
        isLoadingMore,
        showSkeleton
    });

    async function navigateToExpanded(idea: ResearchIdea) {
        setIsExpanding(true);
        const id = crypto.randomUUID();

        // Store the original idea and language preference immediately
        localStorage.setItem(`outliner:${id}`, JSON.stringify(idea));
        localStorage.setItem(`outliner:${id}:language`, language);

        // Navigate immediately - the outline page will handle streaming
        router.push(`/outliner/${id}`);

        setIsExpanding(false);
    }

    function goPrev() {
        setSelectedIndex((idx) => {
            if (idx === null) return idx;
            const prev = idx - 1;
            return prev >= 0 ? prev : idx;
        });
    }

    function goNext() {
        setSelectedIndex((idx) => {
            if (idx === null) return idx;
            const next = idx + 1;
            return next < ideas.length ? next : idx;
        });
    }

    const renderSkeletonCard = () => (
        <Card className="h-full bg-background">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3 pb-10">
                <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-5/6 mb-1" />
                    <Skeleton className="h-4 w-4/6" />
                </div>
                <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-4/5 mb-1" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
                <div>
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-4 w-3/5" />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 md:h-32 bg-gradient-to-t from-main/95 via-main/60 to-transparent" />
            </CardContent>
        </Card>
    );

    return (
        <>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideas.map((idea, idx) => (
                    <Card
                        key={idx}
                        className="h-full cursor-pointer transition hover:shadow-lg bg-background hover:bg-main hover:text-foreground"
                        onClick={() => {
                            setSelectedIndex(idx);
                            setOpen(true);
                        }}
                    >
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold line-clamp-2 text-foreground">
                                {idea.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="relative space-y-3 pb-10 overflow-hidden">
                            <div>
                                <div className="font-medium">{language === 'en' ? 'Background' : 'Latar Belakang'}</div>
                                <p className="text-sm text-muted-foreground line-clamp-3">{idea.abstract.background}</p>
                            </div>
                            <div>
                                <div className="font-medium">{language === 'en' ? 'Literature Review' : 'Tinjauan Literatur'}</div>
                                <p className="text-sm text-muted-foreground line-clamp-3">{idea.abstract.literatureReview}</p>
                            </div>
                            <div>
                                <div className="font-medium">{language === 'en' ? 'Method' : 'Metode'}</div>
                                <p className="text-sm text-muted-foreground line-clamp-1">{idea.abstract.method}</p>
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 md:h-32 bg-gradient-to-t from-main/95 via-main/60 to-transparent" />
                        </CardContent>
                    </Card>
                ))}

                {/* Show skeleton for next expected card */}
                {showSkeleton && renderSkeletonCard()}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-[90vw] sm:w-[90vw] max-w-5xl max-h-[90vh] overflow-hidden p-0 flex flex-col" aria-describedby={undefined}>
                    {selected && (
                        <>
                            <div className="flex-1 overflow-auto p-6 space-y-4">
                                <DialogHeader className="pr-8">
                                    <DialogTitle className="text-2xl font-semibold leading-tight">
                                        {selected.title}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="mt-6 mb-8 px-2">
                                    <div className="relative space-y-8">
                                        {/* The Vertical Line */}
                                        <div className="absolute top-4 bottom-4 left-[10px] w-[2px] bg-border" />
                                        
                                        {/* The sections */}
                                        {[
                                            { title: language === 'en' ? 'Background' : 'Latar Belakang', content: selected.abstract.background, icon: Lightbulb },
                                            { title: language === 'en' ? 'Literature Review' : 'Tinjauan Literatur', content: selected.abstract.literatureReview, icon: BookOpen },
                                            { title: language === 'en' ? 'Method' : 'Metode', content: selected.abstract.method, icon: Microscope },
                                            { title: language === 'en' ? 'Analysis Technique' : 'Teknik Analisis', content: selected.abstract.analysisTechnique, icon: LineChart },
                                            { title: language === 'en' ? 'Impact' : 'Dampak', content: selected.abstract.impact, icon: Target }
                                        ].map((section, idx) => {
                                            const Icon = section.icon;
                                            return (
                                                <div key={idx} className="relative pl-10">
                                                    <div className="absolute left-[-1px] top-[-2px] flex h-6 w-6 items-center justify-center rounded-full bg-background ring-[6px] ring-background">
                                                        <Icon className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <h4 className="font-semibold text-foreground text-base mb-1">{section.title}</h4>
                                                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{section.content}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 sm:px-6 sm:pb-6 pt-4 border-t bg-background shrink-0 mt-auto">
                                <DialogFooter className="flex flex-row sm:flex-row justify-between items-center gap-2 space-x-0 sm:space-x-0 w-full">
                                    <Button size="icon" variant="default" aria-label={language === 'en' ? 'Previous' : 'Sebelumnya'}
                                        onClick={goPrev}
                                        disabled={selectedIndex === null || selectedIndex <= 0}
                                        className="shrink-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    
                                    <Button
                                        className="flex-1"
                                        onClick={() => selected && navigateToExpanded(selected)}
                                        disabled={isExpanding}
                                    >
                                        {isExpanding
                                            ? (language === 'en' ? 'Expanding...' : 'Mengembangkan...')
                                            : (language === 'en' ? 'Create Draft' : 'Draft Naskah')
                                        }
                                    </Button>

                                    <Button size="icon" variant="default" aria-label={language === 'en' ? 'Next' : 'Selanjutnya'}
                                        onClick={goNext}
                                        disabled={selectedIndex === null || selectedIndex >= ideas.length - 1}
                                        className="shrink-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </DialogFooter>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}


