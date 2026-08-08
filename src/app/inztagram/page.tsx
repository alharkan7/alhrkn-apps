"use client";

import { useState } from "react";
import { DiagramInput } from "./components/DiagramInput";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { DIAGRAM_TYPES } from './components/diagram-types';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FilePreview } from './components/PDFPreview';
import { useRouter } from 'next/navigation';
import { Boxes, GitBranch, Menu, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InztagramMode } from './lib/types';

const STARTER_PROMPTS = [
  {
    icon: GitBranch,
    label: 'Product flow',
    prompt: 'Map a user onboarding flow from sign-up to first successful project',
  },
  {
    icon: Boxes,
    label: 'System design',
    prompt: 'Show a microservice architecture for an online learning platform',
  },
  {
    icon: Network,
    label: 'Concept map',
    prompt: 'Explain photosynthesis as a concept map for a high school student',
  },
] as const;

export default function InztagramPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<InztagramMode>('freeform');
  const [pdfFile, setPdfFile] = useState<{ name: string; type: string; url: string; uploaded?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSend = async (
    value: string,
    type: string,
    theme: string,
    pdfUrl?: string,
    pdfName?: string,
    freeformLayout?: string
  ) => {
    setLoading(true);
    setError(null);
    const useStream = process.env.NEXT_PUBLIC_DISABLE_FREEFORM_STREAM !== 'true';
    try {
      const body: Record<string, unknown> = {
        mode,
        ...(pdfUrl
          ? {
              pdfUrl,
              pdfName,
              diagramType: mode === 'mermaid' ? (type || undefined) : undefined,
              layout: mode === 'freeform' ? (freeformLayout || undefined) : undefined,
              stream: mode === 'freeform' ? useStream : undefined,
            }
          : {
              description: value,
              diagramType: mode === 'mermaid' ? (type || undefined) : undefined,
              layout: mode === 'freeform' ? (freeformLayout || undefined) : undefined,
              stream: mode === 'freeform' ? useStream : undefined,
            }),
      };
      const res = await fetch("/api/inztagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        if (mode === 'mermaid' && (!data.code || !data.diagramType)) {
          setError("Diagram generated but response was incomplete.");
          return;
        }
        router.push(`/inztagram/${data.id}`);
      } else if (res.ok && !data.id) {
        setError("Diagram generated but failed to save to database.");
      } else {
        setError(data.error || "Failed to generate diagram");
      }
    } catch (e: any) {
      setError(e.message || "Failed to generate diagram");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    const localUrl = URL.createObjectURL(file);
    setPdfFile({ name: file.name, type: file.type, url: localUrl, uploaded: false });
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/inztagram/blob?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setPdfFile({ name: file.name, type: file.type, url: data.url, uploaded: true });
        URL.revokeObjectURL(localUrl);
      }
    } finally {
      setUploading(false);
    }
  };
  const clearFile = () => setPdfFile(null);

  /** Mermaid-only: fill input with a random type example and generate. */
  const handleRandomize = async () => {
    const randomIndex = Math.floor(Math.random() * DIAGRAM_TYPES.length);
    const randomType = DIAGRAM_TYPES[randomIndex];
    setInput(randomType.example.trim());
    handleSend(randomType.example.trim(), randomType.value, 'default');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f7f5] font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_42%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(37,37,34,0.75),rgba(16,16,15,1)_60%)]" />
        <div className="absolute inset-0 opacity-[0.32] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.14] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-1/2 top-[31%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/[0.07] blur-3xl dark:bg-blue-500/[0.08]"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={prefersReducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
        <AppsHeader
          leftButton={
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
              onClick={() => window.dispatchEvent(new Event('toggleInztagramHistorySidebar'))}
              aria-label="Open diagram history"
            >
              <Menu size={18} />
            </Button>
          }
          title={
            <span className="text-sm font-semibold tracking-[-0.01em]">Inztagram</span>
          }
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key="diagram-input"
            initial={prefersReducedMotion ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0, y: -16 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
            }}
            className="my-auto w-full py-4 sm:py-6"
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-6 max-w-2xl text-center sm:mb-7"
            >
              <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">
                Create Diagram Instantly
              </h1>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-2xl"
            >
              <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
              <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
              <div className="relative">
                {pdfFile && (
                  <div className="mb-2 flex w-full flex-col items-center">
                    <FilePreview file={pdfFile} isUploading={uploading} onRemove={clearFile} />
                  </div>
                )}
                <DiagramInput
                  value={input}
                  onChange={setInput}
                  placeholder={mode === 'freeform' ? 'Describe the diagram you have in mind…' : 'Describe the diagram you want to generate…'}
                  onSend={handleSend}
                  disabled={loading}
                  loading={loading}
                  pdfFile={pdfFile}
                  uploading={uploading}
                  onFileSelect={handleFileSelect}
                  onClearFile={clearFile}
                  onRandomize={handleRandomize}
                  mode={mode}
                  onModeChange={setMode}
                />
              </div>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-600 dark:text-red-400"
                >
                  {error.length > 200 ? error.slice(0, 200) + '…' : error}
                </motion.div>
              )}
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-5 hidden max-w-2xl grid-cols-1 gap-2 sm:grid sm:grid-cols-3"
              aria-label="Starter ideas"
            >
              {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <motion.button
                  key={label}
                  type="button"
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                  onClick={() => setInput(prompt)}
                  className="group flex items-center gap-3 rounded-2xl border border-black/[0.065] bg-white/45 px-3.5 py-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm transition-colors hover:border-black/[0.11] hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.055]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black/[0.045] text-black/55 transition-colors group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:bg-white/[0.06] dark:text-white/55 dark:group-hover:bg-blue-400/10 dark:group-hover:text-blue-300">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-black/70 dark:text-white/70">{label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-black/38 dark:text-white/35">Try an example</span>
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </motion.section>
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  );
}
