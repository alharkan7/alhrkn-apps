'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { FileText } from 'lucide-react';
import { useCallback } from 'react';

// Outliner saves items directly to localStorage using the format "outliner:{id}"
export function OutlinerHistorySidebar() {
  const fetchLocalHistory = useCallback(async (offset: number = 0) => {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('outliner:') && !key.endsWith(':doc') && !key.endsWith(':expanded') && !key.endsWith(':language')) {
          const id = key.replace('outliner:', '');
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.title) {
                items.push({
                  id,
                  title: parsed.title,
                  // Since we didn't store createdAt previously, just use a placeholder or current time if missing
                  createdAt: parsed.createdAt || new Date().toISOString()
                });
              }
            }
          } catch (e) {
            console.error('Error parsing local outliner history item', e);
          }
        }
      }
      
      // Sort by newest first (descending), since we don't have accurate dates for legacy items, 
      // they might bunch up, but new ones will be correct.
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const PAGE_SIZE = 50;
      return items.slice(offset, offset + PAGE_SIZE);
    } catch (e) {
      console.error('Failed to read localStorage history', e);
      return [];
    }
  }, []);

  return (
    <HistorySidebar 
      cacheKey="outliner-local-history"
      fetchItems={fetchLocalHistory}
      itemUrlPrefix="/outliner/"
      eventName="toggleOutlinerHistorySidebar"
      emptyMessage="No previous outlines found."
      onRenderTitle={(item) => item.title || 'Untitled Outline'}
      onRenderIcon={(item) => <FileText size={16} className="text-blue-500" />}
    />
  );
}
