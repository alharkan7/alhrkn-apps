'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { FileText, Link as LinkIcon, FileQuestion } from 'lucide-react';

export function PapermapHistorySidebar() {
  return (
    <HistorySidebar 
      apiEndpoint="/api/papermap/history"
      itemUrlPrefix="/papermap/"
      eventName="toggleHistorySidebar"
      emptyMessage="No previous mindmaps found."
      onRenderTitle={(item) => item.title || 'Untitled Mindmap'}
      onRenderIcon={(item) => {
        switch (item.inputType) {
          case 'pdf': return <FileText size={16} className="text-red-500" />;
          case 'url': return <LinkIcon size={16} className="text-blue-500" />;
          case 'text': return <FileQuestion size={16} className="text-emerald-500" />;
          default: return <FileText size={16} className="text-gray-500" />;
        }
      }}
    />
  );
}
