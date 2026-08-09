'use client';

import React from 'react';
import { HistorySidebar } from '@/components/history-sidebar';
import { GitCommitHorizontal, FileText, Sparkles } from 'lucide-react';

export function FlownoteHistorySidebar() {
  const fetchFlownoteHistory = async (offset: number = 0) => {
    const res = await fetch(`/api/flownote/history?offset=${offset}&limit=50`);
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();
    return data;
  };

  const renderIcon = (item: any) => {
    if (item.aiPrompt) return <Sparkles className="size-4 shrink-0" />;
    if (item.originalFileName) return <FileText className="size-4 shrink-0" />;
    return <GitCommitHorizontal className="size-4 shrink-0" />;
  };

  const renderTitle = (item: any) => {
    return item.title || 'Untitled Document';
  };

  return (
    <HistorySidebar
      cacheKey="flownote"
      fetchItems={fetchFlownoteHistory}
      itemUrlPrefix="/flownote/"
      eventName="toggleHistorySidebar"
      title="Recent FlowNotes"
      variant="quiet"
      emptyMessage="No flownotes yet. Create a new document to get started."
      onRenderTitle={renderTitle}
      onRenderIcon={renderIcon}
    />
  );
}
