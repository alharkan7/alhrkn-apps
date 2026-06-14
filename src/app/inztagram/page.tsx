"use client";

import { useState } from "react";
import { DiagramInput } from "./components/DiagramInput";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { DIAGRAM_THEMES, DIAGRAM_TYPES } from './components/diagram-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePreview } from './components/PDFPreview';
import { useRouter } from 'next/navigation';

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
    <div className="flex flex-col min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50">
        <AppsHeader />
      </div>
      <div className="flex-1 flex flex-col justify-start items-center max-w-6xl mx-auto w-full px-1 md:px-4">
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="diagram-input"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="w-full mt-[25vh]"
            >
              <div className="text-center pt-4 pb-8">
                <h1 className="text-5xl font-black mb-2">
                  <span className="text-primary whitespace-nowrap">Inztagram</span>{' '}
                </h1>
                <div className="text-base text-muted-foreground">
                  Create <span className="font-bold text-primary">Instant Diagram</span> in Seconds
                </div>
              </div>
              <div className="w-full flex justify-center">
                <div className="w-full h-full max-w-6xl">
                  {/* File preview above the form */}
                  {pdfFile && (
                    <div className="w-full flex flex-col items-center mb-2">
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
                    <div className="text-center text-red-500 mt-2">
                      {error.length > 200 ? error.slice(0, 200) + '…' : error}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex-none mb-1">
        <AppsFooter />
      </div>
    </div>
  );
}
