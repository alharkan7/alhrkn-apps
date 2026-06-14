"use client";

import { useState } from "react";
import { AppsHeader } from '@/components/apps-header';
import AppsFooter from '@/components/apps-footer';
import { MermaidRenderer } from "../components/MermaidRenderer";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export function DiagramViewer({ initialCode, initialType, initialDescription, fileName }: any) {
  const router = useRouter();
  const [diagramCode, setDiagramCode] = useState<string>(initialCode);
  const [diagramType, setDiagramType] = useState<string>(initialType);
  const [diagramTheme, setDiagramTheme] = useState<string>('default');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50">
        <AppsHeader
          leftButton={(
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" aria-label="Create new diagram">
                  <Plus className="size-5" /> New
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
          )}
        />
      </div>
      <div className="flex-1 flex flex-col justify-start items-center max-w-6xl mx-auto w-full px-1 md:px-4">
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
              />
            </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex-none mb-1">
        <AppsFooter />
      </div>
    </div>
  );
}
