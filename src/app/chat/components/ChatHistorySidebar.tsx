'use client';

import React from 'react';
import { HistorySidebar } from '@/components/history-sidebar';
import { MessageSquare } from 'lucide-react';

export function ChatHistorySidebar() {
  const fetchChatHistory = async (offset: number = 0) => {
    const res = await fetch(`/api/chat/history?offset=${offset}&limit=50`);
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();
    return data;
  };

  const renderIcon = () => <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />;

  const renderTitle = (item: any) => {
    return item.title || 'New Chat';
  };

  return (
    <HistorySidebar
      cacheKey="chat"
      fetchItems={fetchChatHistory}
      itemUrlPrefix="/chat/"
      eventName="toggleChatHistorySidebar"
      emptyMessage="No chats yet. Start a conversation to see history."
      onRenderTitle={renderTitle}
      onRenderIcon={renderIcon}
    />
  );
}
