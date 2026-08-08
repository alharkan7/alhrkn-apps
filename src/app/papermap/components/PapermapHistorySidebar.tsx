'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { FileText, Link as LinkIcon, FileQuestion } from 'lucide-react';

export function PapermapHistorySidebar() {
  return (
    <HistorySidebar 
      apiEndpoint="/api/papermap/history"
      itemUrlPrefix="/papermap/"
      eventName="toggleHistorySidebar"
      title="Recent mindmaps"
      variant="quiet"
      emptyMessage="No previous mindmaps found."
      onRenderTitle={(item) => item.title || 'Untitled Mindmap'}
      onRenderIcon={(item) => {
        switch (item.inputType) {
          case 'pdf': return <FileText size={15} />;
          case 'url': return <LinkIcon size={15} />;
          case 'text': return <FileQuestion size={15} />;
          default: return <FileText size={15} />;
        }
      }}
    />
  );
}
