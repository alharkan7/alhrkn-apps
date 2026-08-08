"use client";

import { useState } from "react";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowUp, LoaderCircle, Menu, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnimaChartPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Animate Chart');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc).');
      return;
    }
    
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc).');
      return;
    }
    
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const clearFile = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleGenerate = async () => {
    if (!imageFile || !imagePreview) return;
    setLoading(true);
    setLoadingText("Compressing image...");
    setError(null);
    
    try {
      // Client-side image resizing to save payload size and AI tokens
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onload = (event) => {
          const img = document.createElement('img');
          img.src = event.target?.result as string;
          img.onload = () => {
            const MAX_SIZE = 1024;
            let { width, height } = img;
            
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = Math.round((height * MAX_SIZE) / width);
                width = MAX_SIZE;
              } else {
                width = Math.round((width * MAX_SIZE) / height);
                height = MAX_SIZE;
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.85));
                return;
              }
            }
            resolve(event.target?.result as string);
          };
          img.onerror = () => reject(new Error('Failed to load image for resizing'));
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
      });
      
      setLoadingText("Analyzing chart type...");
      
      // Cycle through dummy loading states to keep user engaged during the API call
      const loadingStates = [
        "Validating chart structure...",
        "Extracting data points...",
        "Converting to structured format...",
        "Applying motion templates...",
        "Finalizing animation...",
        "Almost there..."
      ];
      
      let stateIndex = 0;
      const intervalId = setInterval(() => {
        if (stateIndex < loadingStates.length) {
          setLoadingText(loadingStates[stateIndex]);
          stateIndex++;
        }
      }, 2500);
      
      const res = await fetch("/api/animachart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: base64data }),
      });
      
      clearInterval(intervalId);
      
      const data = await res.json();
      
      if (res.ok && data.id) {
        setLoadingText("Done!");
        router.push(`/animachart/${data.id}`);
      } else {
        setError(data.error || "Failed to generate animated chart");
        setLoadingText("Animate Chart");
      }
    } catch (e: any) {
      setError(e.message || "Failed to process image");
      setLoadingText("Animate Chart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-violet-400/[0.055] blur-3xl dark:bg-violet-500/[0.065]"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={prefersReducedMotion ? undefined : { duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
        <AppsHeader
          leftButton={
            <Button variant="ghost" size="icon" className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white" onClick={() => window.dispatchEvent(new Event('toggleAnimaChartHistorySidebar'))} aria-label="Open chart history">
              <Menu size={18} />
            </Button>
          }
          title={<span className="text-sm font-semibold tracking-[-0.01em]">Motion Chart</span>}
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
            <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">Animate Your Chart</h1>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }} transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }} className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
            <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
            <div className="relative flex w-full flex-col rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-4">
              {!imagePreview ? (
                <div
                  className="group flex min-h-[230px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 p-8 text-center transition-colors hover:border-black/28 hover:bg-black/[0.025] dark:border-white/15 dark:hover:border-white/28 dark:hover:bg-white/[0.035]"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('chart-upload')?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') document.getElementById('chart-upload')?.click(); }}
                >
                  <input id="chart-upload" type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-black/[0.055] text-black/45 transition-transform group-hover:-translate-y-0.5 dark:bg-white/[0.07] dark:text-white/45">
                    <Upload className="size-6" />
                  </div>
                  <h2 className="text-lg font-semibold">Upload a chart image</h2>
                  <p className="mt-2 text-sm text-black/42 dark:text-white/42">Drop an image here or click to browse</p>
                </div>
              ) : (
                <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden rounded-2xl border border-black/[0.07] bg-black/[0.025] p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <img src={imagePreview} alt="Chart preview" className="max-h-[310px] w-auto max-w-full rounded-xl object-contain shadow-sm" />
                  <Button variant="ghost" size="icon" className="absolute right-3 top-3 size-8 rounded-xl border border-black/[0.07] bg-white/90 text-black/55 shadow-sm hover:bg-white hover:text-black dark:border-white/[0.09] dark:bg-[#252523]/90 dark:text-white/55 dark:hover:bg-[#292927] dark:hover:text-white" onClick={clearFile} disabled={loading} aria-label="Remove chart image">
                    <X className="size-4" />
                  </Button>
                </div>
              )}

              {error && <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-600 dark:text-red-400">{error}</div>}

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.055] px-1 pt-3 dark:border-white/[0.07]">
                <span className="min-w-0 truncate text-xs text-black/38 dark:text-white/38">{imageFile?.name || 'PNG, JPG, or WebP'}</span>
                <Button onClick={handleGenerate} disabled={loading || !imageFile} className="group h-10 shrink-0 overflow-hidden rounded-xl bg-[#191918] px-4 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={loadingText} initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex items-center">
                      {loading ? <><LoaderCircle className="mr-2 size-4 shrink-0 animate-spin" /><span className="max-w-40 truncate">{loadingText}</span></> : <>Animate<ArrowUp className="ml-1 size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} /></>}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
        <AppsFooter />
      </div>
    </div>
  );
}
