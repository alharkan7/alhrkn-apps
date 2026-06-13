"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
                <DialogContent className="w-[90vw] sm:w-[90vw] max-w-5xl max-h-[90vh] overflow-auto p-6" aria-describedby={undefined}>
                    {selected && (
                        <div className="space-y-4">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-semibold leading-tight">
                                    {selected.title}
                                </DialogTitle>
                            </DialogHeader>
                            <section className="space-y-1">
                                <h4 className="font-medium">{language === 'en' ? 'Background' : 'Latar Belakang'}</h4>
                                <p className="text-sm opacity-90 whitespace-pre-line">{selected.abstract.background}</p>
                            </section>
                            <section className="space-y-1">
                                <h4 className="font-medium">{language === 'en' ? 'Literature Review' : 'Tinjauan Literatur'}</h4>
                                <p className="text-sm opacity-90 whitespace-pre-line">{selected.abstract.literatureReview}</p>
                            </section>
                            <section className="space-y-1">
                                <h4 className="font-medium">{language === 'en' ? 'Method' : 'Metode'}</h4>
                                <p className="text-sm opacity-90 whitespace-pre-line">{selected.abstract.method}</p>
                            </section>
                            <section className="space-y-1">
                                <h4 className="font-medium">{language === 'en' ? 'Analysis Technique' : 'Teknik Analisis'}</h4>
                                <p className="text-sm opacity-90 whitespace-pre-line">{selected.abstract.analysisTechnique}</p>
                            </section>
                            <section className="space-y-1">
                                <h4 className="font-medium">{language === 'en' ? 'Impact' : 'Dampak'}</h4>
                                <p className="text-sm opacity-90 whitespace-pre-line">{selected.abstract.impact}</p>
                            </section>
                            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <Button
                                    className="order-1 sm:order-2"
                                    onClick={() => selected && navigateToExpanded(selected)}
                                    disabled={isExpanding}
                                >
                                    {isExpanding
                                        ? (language === 'en' ? 'Expanding...' : 'Mengembangkan...')
                                        : (language === 'en' ? 'Create Draft' : 'Draft Naskah')
                                    }
                                </Button>
                                <div className="flex items-center gap-2 order-2 sm:order-1 justify-center sm:justify-start w-full sm:w-auto">
                                    <Button size="icon" variant="default" aria-label={language === 'en' ? 'Previous' : 'Sebelumnya'}
                                        onClick={goPrev}
                                        disabled={selectedIndex === null || selectedIndex <= 0}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="default" aria-label={language === 'en' ? 'Next' : 'Selanjutnya'}
                                        onClick={goNext}
                                        disabled={selectedIndex === null || selectedIndex >= ideas.length - 1}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}


