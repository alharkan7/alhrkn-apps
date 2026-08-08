'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import { PosterUploader, type PosterInput } from './components/PosterUploader';

export default function PosterlyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (input: PosterInput) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (input.file) formData.append('file', input.file);
      if (input.text) formData.append('text', input.text);
      formData.append('style', input.style);

      const response = await fetch('/api/posterly', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || 'Poster generation failed');
      window.location.assign(`/posterly/${data.id}`);
    } catch (generationError: any) {
      setError(generationError?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><div className="absolute -left-[12%] -top-[20%] h-[55%] w-[55%] rounded-full bg-cyan-500/10 blur-[120px] dark:bg-cyan-900/20" /><div className="absolute -bottom-[20%] -right-[12%] h-[60%] w-[60%] rounded-full bg-indigo-500/10 blur-[150px] dark:bg-indigo-900/20" /><div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" /></div>
      <div className="fixed left-0 right-0 top-0 z-50 border-b bg-background/60 backdrop-blur-xl"><AppsHeader leftButton={<Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('togglePosterlyHistorySidebar'))}><Menu className="h-5 w-5" /></Button>} /></div>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-12 pt-16 sm:px-8">
        <div className="mb-6 max-w-4xl text-center"><h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">Poster<span className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">ly</span></h1><p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Turn scientific papers into professional posters.</p></div>
        <PosterUploader loading={loading} loadingText="Reading paper and composing poster…" error={error} onGenerate={handleGenerate} />
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/60 py-1 text-center text-xs text-muted-foreground backdrop-blur-md"><AppsFooter /></div>
    </div>
  );
}
