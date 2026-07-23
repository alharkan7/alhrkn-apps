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
    if (item.aiPrompt) return <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />;
    if (item.originalFileName) return <FileText className="w-4 h-4 text-emerald-500 shrink-0" />;
    return <GitCommitHorizontal className="w-4 h-4 text-blue-500 shrink-0" />;
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
      emptyMessage="No flownotes yet. Create a new document to get started."
      onRenderTitle={renderTitle}
      onRenderIcon={renderIcon}
    />
  );
}
