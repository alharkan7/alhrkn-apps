'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { FileText } from 'lucide-react';
import { useCallback } from 'react';

// Outliner history is fetched from the outliner_events table
export function OutlinerHistorySidebar() {
  const fetchDBHistory = useCallback(async (offset: number = 0) => {
    try {
      const res = await fetch(`/api/outliner/history?offset=${offset}&limit=50`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Failed to read database history', e);
      return [];
    }
  }, []);

  return (
    <HistorySidebar 
      cacheKey="outliner-db-history"
      fetchItems={fetchDBHistory}
      itemUrlPrefix="/outliner"
      eventName="toggleOutlinerHistorySidebar"
      emptyMessage="No previous research searches found."
      onRenderTitle={(item) => item.title || 'Untitled Research'}
      onRenderIcon={(item) => <FileText size={16} className="text-blue-500" />}
    />
  );
}
