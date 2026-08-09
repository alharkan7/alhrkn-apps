'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { FileImage, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { PosterlyHistoryItem } from '../types';

export function PosterlyHistorySidebar() {
  return (
    <HistorySidebar<PosterlyHistoryItem>
      apiEndpoint="/api/posterly/history"
      itemUrlPrefix="/posterly/"
      eventName="togglePosterlyHistorySidebar"
      title="Recent Posters"
      variant="quiet"
      emptyMessage="No posters yet. Upload a paper to begin."
      onRenderTitle={(item) => item.title || item.sourceFileName || 'Untitled poster'}
      onRenderIcon={(item) => {
        if (item.status === 'processing' || item.status === 'pending') return <LoaderCircle size={16} className="animate-spin" />;
        if (item.status === 'error') return <TriangleAlert size={16} className="text-red-500" />;
        return <FileImage size={16} />;
      }}
    />
  );
}
