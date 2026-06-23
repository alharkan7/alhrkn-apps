'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { Search } from 'lucide-react';

interface BeeblioHistoryItem {
  id: string;
  originalQuery: string | null;
  contextText: string | null;
  createdAt: string;
}

export function BeeblioHistorySidebar() {
  return (
    <HistorySidebar<BeeblioHistoryItem>
      apiEndpoint="/api/beeblio/history"
      itemUrlPrefix="/beeblio/"
      eventName="toggleBeeblioHistorySidebar"
      emptyMessage="No search history found."
      onRenderIcon={(item) => <Search size={16} className="text-purple-500" />}
      onRenderTitle={(item) => item.originalQuery || item.contextText?.substring(0, 50) || 'Untitled Search'}
    />
  );
}
