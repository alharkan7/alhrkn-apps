'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { Network, Activity, GitBranch, Share2, Workflow, Database, Layers, LayoutTemplate, Box, Map, Clock, PenTool } from 'lucide-react';

export function InztagramHistorySidebar() {
  return (
    <HistorySidebar 
      apiEndpoint="/api/inztagram/history"
      itemUrlPrefix="/inztagram/"
      eventName="toggleInztagramHistorySidebar"
      title="Recent diagrams"
      variant="quiet"
      emptyMessage="No previous diagrams found."
      onRenderTitle={(item) => item.pdfName || item.description || 'Untitled Diagram'}
      onRenderIcon={(item) => {
        if (item.mode === 'freeform') {
          return <PenTool size={15} />;
        }
        switch (item.diagramType) {
          case 'flowchart': return <Workflow size={15} />;
          case 'sequence': return <Share2 size={15} />;
          case 'class': return <Box size={15} />;
          case 'state': return <Activity size={15} />;
          case 'er': return <Database size={15} />;
          case 'journey': return <Map size={15} />;
          case 'gantt': return <Clock size={15} />;
          case 'pie': return <Activity size={15} />;
          case 'mindmap': return <Network size={15} />;
          case 'timeline': return <GitBranch size={15} />;
          case 'architecture': return <Layers size={15} />;
          default: return <LayoutTemplate size={15} />;
        }
      }}
    />
  );
}
