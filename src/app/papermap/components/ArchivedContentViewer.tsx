'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArchivedContentViewerProps {
  markdownContent: string;
  onClose: () => void;
  isOpen: boolean;
}

const processMarkdownContent = (content: string): string => {
  // First, strip everything before "Markdown Content:"
  const marker = 'Markdown Content:';
  const idx = content.indexOf(marker);
  const cleanContent = idx !== -1 ? content.slice(idx + marker.length).trimStart() : content;
  
  // Process line combinations
  const lines = cleanContent.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Handle empty lines
    if (line === '') {
      result.push('');
      i++;
      continue;
    }
    
    // Handle numbered lines (don't combine with previous)
    if (/^\s*\d+/.test(line)) {
      result.push(line);
      i++;
      continue;
    }
    
    // Start with current line
    let combinedLine = line;
    i++;
    
    // Keep combining while current line doesn't end with period
    while (!combinedLine.endsWith('.') && i < lines.length) {
      const nextLine = lines[i].trim();
      
      // Skip empty lines
      if (nextLine === '') {
        i++;
        continue;
      }
      
      // Don't combine with numbered lines
      if (/^\s*\d+/.test(nextLine)) {
        break;
      }
      
      // Combine lines with space
      combinedLine += ' ' + nextLine;
      i++;
    }
    
    result.push(combinedLine);
  }
  
  return result.join('\n');
};

const ArchivedContentViewer: React.FC<ArchivedContentViewerProps> = ({ 
  markdownContent,
  onClose,
  isOpen
}) => {
  if (!isOpen) {
    return null;
  }

  const processedContent = processMarkdownContent(markdownContent);

  return (
    <div
      className={`
        fixed top-0 right-0 z-50 h-full w-full transform border-l border-black/[0.08] bg-[#fbfaf8] p-4 shadow-xl
        transition-transform duration-300 ease-in-out dark:border-white/[0.08] dark:bg-[#161614]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        flex flex-col
      `}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Parsed PDF Content</h2>
        <Button variant="secondary" size="icon" onClick={onClose}>
          <X className="h-6 w-6" />
        </Button>
      </div>
      <div className="markdown-content prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-blockquote:my-1 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent">
        <ReactMarkdown>{processedContent}</ReactMarkdown>
      </div>
    </div>
  );
};

export default ArchivedContentViewer; 