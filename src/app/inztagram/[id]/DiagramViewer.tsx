"use client";

import { useState } from "react";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { MermaidRenderer } from "../components/MermaidRenderer";
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export function DiagramViewer({ initialCode, initialType, initialDescription, fileName, id, isOwner = true }: any) {
  const router = useRouter();
  const [diagramCode, setDiagramCode] = useState<string>(initialCode);
  const [diagramType, setDiagramType] = useState<string>(initialType);
  const [diagramTheme, setDiagramTheme] = useState<string>('default');

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
          leftButton={(
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="sidebar-toggle" onClick={() => window.dispatchEvent(new Event('toggleInztagramHistorySidebar'))}>
                <Menu size={20} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="px-2 text-sm font-semibold tracking-[-0.01em]" aria-label="Create new diagram">
                    Inztagram
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Create New Diagram?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Make sure you have saved your current diagram. It will be erased.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      router.push('/inztagram');
                    }}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-6xl px-1 md:px-4 pt-20 pb-16">
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="mermaid-renderer"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="w-full"
            >
              <MermaidRenderer
                code={diagramCode}
                diagramType={diagramType || ''}
                diagramTheme={diagramTheme}
                onThemeChange={setDiagramTheme}
                onNewDiagram={() => {
                  router.push('/inztagram');
                }}
                onCodeChange={setDiagramCode}
                fileName={fileName}
                description={initialDescription}
                isOwner={isOwner}
                id={id}
              />
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
