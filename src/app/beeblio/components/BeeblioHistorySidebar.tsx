'use client';

import { HistorySidebar } from '@/components/history-sidebar';
import { Search } from 'lucide-react';

interface BeeblioHistoryItem {
  id: string;
  originalQuery: string | null;
  contextText: string | null;
  fileName?: string | null;
  createdAt: string;
}

export function BeeblioHistorySidebar() {
  return (
    <HistorySidebar<BeeblioHistoryItem>
      apiEndpoint="/api/beeblio/history"
      itemUrlPrefix="/beeblio/"
      eventName="toggleBeeblioHistorySidebar"
      title="Recent Searches"
      variant="quiet"
      emptyMessage="No search history found."
      onRenderIcon={() => <Search size={15} />}
      onRenderTitle={(item) => item.originalQuery?.trim() || item.fileName || item.contextText?.trim().substring(0, 50) || 'Untitled Search'}
    />
  );
}
