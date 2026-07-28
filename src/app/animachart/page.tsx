"use client";

import { useState } from "react";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Menu, Upload, Sparkles, LoaderCircle, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function AnimaChartPage() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    setError(null);
    
    try {
      // For this app, we read the image as a base64 string to send to our API
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        const res = await fetch("/api/animachart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: base64data }),
        });
        
        const data = await res.json();
        
        if (res.ok && data.id) {
          router.push(`/animachart/${data.id}`);
        } else {
          setError(data.error || "Failed to generate animated chart");
        }
        setLoading(false);
      };
    } catch (e: any) {
      setError(e.message || "Failed to process image");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden relative font-sans">
      {/* Background aesthetics */}
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 dark:bg-violet-900/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-900/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[20%] w-[20%] h-[20%] rounded-full bg-rose-500/10 dark:bg-rose-900/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b">
        <AppsHeader
          leftButton={
            <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleAnimaChartHistorySidebar'))}>
              <Menu size={20} />
            </Button>
          }
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-start items-center max-w-6xl mx-auto w-full px-4 pt-24 pb-16">
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`w-full transition-all duration-500 ${imagePreview ? 'mt-4 md:mt-[2vh]' : 'mt-[10vh]'}`}
            >
              <div className={`text-center space-y-6 max-w-4xl mx-auto transition-all duration-500 ${imagePreview ? 'pb-6' : 'pb-12'}`}>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 animate-gradient-x whitespace-nowrap">Motion Chart</span>{' '}
                </h1>
                <div className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                  Turn boring graphs into <span className="font-semibold text-foreground">animated charts</span>, download as videos
                </div>
              </div>

              <div className="w-full max-w-3xl mx-auto relative group flex justify-center">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 dark:from-violet-500/30 dark:to-fuchsia-500/30 rounded-[2rem] blur-xl opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-300"></div>
                <div className="relative z-10 w-full bg-background/80 backdrop-blur-xl border rounded-[2rem] shadow-2xl p-6 sm:p-8 flex flex-col items-center">
                  
                  {!imagePreview ? (
                    <div 
                      className="w-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('chart-upload')?.click()}
                    >
                      <input id="chart-upload" type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Upload a chart image</h3>
                      <p className="text-sm text-muted-foreground text-center max-w-xs">Drag and drop your image here, or click to browse</p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-6">
                      <div className="relative w-full max-w-md aspect-[4/3] rounded-xl overflow-hidden border bg-black/5">
                        <Image src={imagePreview} alt="Chart preview" fill className="object-contain" />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2 rounded-full opacity-80 hover:opacity-100 transition-opacity"
                          onClick={clearFile}
                          disabled={loading}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {error && (
                        <div className="text-red-500 text-sm text-center px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20 w-full max-w-md">
                          {error}
                        </div>
                      )}

                      <Button 
                        onClick={handleGenerate} 
                        disabled={loading}
                        className="w-full max-w-md rounded-full py-6 text-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all"
                      >
                        {loading ? (
                          <>
                            <LoaderCircle className="w-5 h-5 mr-2 animate-spin" /> Analyzing Image...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" /> Animate Chart
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
        </AnimatePresence>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 py-1 px-0 text-center text-muted-foreground text-xs bg-background/60 backdrop-blur-md z-50">
        <AppsFooter />
      </div>
    </div>
  );
}
