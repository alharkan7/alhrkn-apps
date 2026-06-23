"use client";

import { useState } from "react";
import { DiagramInput } from "./components/DiagramInput";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { DIAGRAM_THEMES, DIAGRAM_TYPES } from './components/diagram-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePreview } from './components/PDFPreview';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InztagramPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<string | null>(null);
  const [diagramTheme, setDiagramTheme] = useState<string>('default');
  const [pdfFile, setPdfFile] = useState<{ name: string; type: string; url: string; uploaded?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSend = async (value: string, type: string, theme: string, pdfUrl?: string, pdfName?: string) => {
    setLoading(true);
    setError(null);
    setDiagramType(type || null);
    setDiagramTheme(theme);
    try {
      const body: any = pdfUrl
        ? { pdfUrl, pdfName, diagramType: type || undefined }
        : { description: value, diagramType: type || undefined };
      const res = await fetch("/api/inztagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.code && data.diagramType) {
        if (data.id) {
          router.push(`/inztagram/${data.id}`);
        } else {
          setError("Diagram generated but failed to save to database.");
        }
      } else {
        setError(data.error || "Failed to generate diagram");
      }
    } catch (e: any) {
      setError(e.message || "Failed to generate diagram");
    } finally {
      setLoading(false);
    }
  };

  // Handles file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    // Show preview immediately
    const localUrl = URL.createObjectURL(file);
    setPdfFile({ name: file.name, type: file.type, url: localUrl, uploaded: false });
    setUploading(true);
    try {
      // Upload to Vercel Blob
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

  // Handler for randomize button
  const handleRandomize = async () => {
    // Pick a random diagram type
    const randomIndex = Math.floor(Math.random() * DIAGRAM_TYPES.length);
    const randomType = DIAGRAM_TYPES[randomIndex];
    
    // Instead of directly displaying, we can just fill the input and trigger the generation
    setInput(randomType.example.trim());
    handleSend(randomType.example.trim(), randomType.value, 'default');
  };

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

      <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader 
          leftButton={
            <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleInztagramHistorySidebar'))}>
              <Menu size={20} />
            </Button>
          }
        />
      </div>
      <div className="relative z-10 flex-1 flex flex-col justify-start items-center max-w-6xl mx-auto w-full px-1 md:px-4 pt-16">
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="diagram-input"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="w-full mt-[15vh]"
            >
              <div className="text-center pt-4 pb-8 space-y-6 max-w-3xl mx-auto">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x whitespace-nowrap">Inztagram</span>{' '}
                </h1>
                <div className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-light leading-relaxed">
                  Create <span className="font-bold text-foreground">Instant Diagram</span> in Seconds
                </div>
              </div>
              <div className="w-full relative group flex justify-center mt-4">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 dark:from-indigo-500/30 dark:to-cyan-500/30 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-80 transition duration-1000 group-hover:duration-200 max-w-2xl mx-auto"></div>
                <div className="relative z-10 w-full h-full max-w-6xl flex flex-col items-center">
                  {/* File preview above the form */}
                  {pdfFile && (
                    <div className="w-full max-w-2xl flex flex-col items-center mb-2">
                      <FilePreview file={pdfFile} isUploading={uploading} onRemove={clearFile} />
                    </div>
                  )}
                  <DiagramInput
                    value={input}
                    onChange={setInput}
                    placeholder="Describe your diagram..."
                    onSend={handleSend}
                    disabled={loading}
                    loading={loading}
                    pdfFile={pdfFile}
                    uploading={uploading}
                    onFileSelect={handleFileSelect}
                    onClearFile={clearFile}
                    onRandomize={handleRandomize}
                  />
                  {error && (
                    <div className="text-center text-red-500 mt-4 max-w-2xl">
                      {error.length > 200 ? error.slice(0, 200) + '…' : error}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
        </AnimatePresence>
      </div>
      <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-gray-600 text-xs bg-background/60 backdrop-blur-md z-50">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  );
}
