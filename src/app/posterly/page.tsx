'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { Button } from '@/components/ui/button';
import { PosterUploader, type PosterInput } from './components/PosterUploader';
import { motion, useReducedMotion } from 'framer-motion';
import { extractClientPdfText } from './lib/client-pdf';

export default function PosterlyPage() {
  const prefersReducedMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (input: PosterInput) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (input.file) {
        formData.append('fileName', input.file.name);
        
        if (input.file.type === 'application/pdf' || input.file.name.toLowerCase().endsWith('.pdf')) {
          const extractedText = await extractClientPdfText(input.file);
          formData.append('text', extractedText);
          // Omit appending the actual file to bypass Vercel's 4.5MB request body limit
        } else {
          // For other files, we can just send the file
          formData.append('file', input.file);
          const text = await input.file.text();
          formData.append('text', text); // Send text too, since server no longer extracts it
        }
      } else if (input.text) {
        formData.append('text', input.text);
      }
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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/[0.05] blur-3xl dark:bg-cyan-500/[0.06]"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={prefersReducedMotion ? undefined : { duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
        <AppsHeader
          leftButton={
            <Button variant="ghost" size="icon" className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white" onClick={() => window.dispatchEvent(new Event('togglePosterlyHistorySidebar'))} aria-label="Open poster history">
              <Menu size={18} />
            </Button>
          }
          title={<span className="text-sm font-semibold tracking-[-0.01em]">Posterly</span>}
        />
      </div>
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <motion.section
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
          className="my-auto w-full py-4 sm:py-6"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }} className="mx-auto mb-6 max-w-3xl text-center sm:mb-7">
            <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">Create Research Poster</h1>
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }} transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}>
            <PosterUploader loading={loading} loadingText="Creating..." error={error} onGenerate={handleGenerate} />
          </motion.div>
        </motion.section>
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40"><AppsFooter /></div>
    </div>
  );
}
