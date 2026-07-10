'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { Network, Activity, GitBranch, Share2, Workflow, Database, Layers, LayoutTemplate, Box, Map, Clock, PenTool } from 'lucide-react';

export function InztagramHistorySidebar() {
  return (
    <HistorySidebar 
      apiEndpoint="/api/inztagram/history"
      itemUrlPrefix="/inztagram/"
      eventName="toggleInztagramHistorySidebar"
      emptyMessage="No previous diagrams found."
      onRenderTitle={(item) => item.pdfName || item.description || 'Untitled Diagram'}
      onRenderIcon={(item) => {
        if (item.mode === 'freeform') {
          return <PenTool size={16} className="text-indigo-500" />;
        }
        switch (item.diagramType) {
          case 'flowchart': return <Workflow size={16} className="text-blue-500" />;
          case 'sequence': return <Share2 size={16} className="text-purple-500" />;
          case 'class': return <Box size={16} className="text-emerald-500" />;
          case 'state': return <Activity size={16} className="text-orange-500" />;
          case 'er': return <Database size={16} className="text-yellow-500" />;
          case 'journey': return <Map size={16} className="text-cyan-500" />;
          case 'gantt': return <Clock size={16} className="text-red-500" />;
          case 'pie': return <Activity size={16} className="text-pink-500" />;
          case 'mindmap': return <Network size={16} className="text-indigo-500" />;
          case 'timeline': return <GitBranch size={16} className="text-teal-500" />;
          case 'architecture': return <Layers size={16} className="text-sky-500" />;
          default: return <LayoutTemplate size={16} className="text-gray-500" />;
        }
      }}
    />
  );
}
