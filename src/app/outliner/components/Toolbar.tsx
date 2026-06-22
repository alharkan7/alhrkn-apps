'use client';

import { Download, FileText, FileCode, FileType, File, ArrowLeft, Quote, MessageCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ToolbarProps {
  onDownload: (format: 'pdf' | 'markdown' | 'txt' | 'docx') => void;
  onOpenChat?: () => void;
}

export function Toolbar({ onDownload, onOpenChat }: ToolbarProps) {
  const router = useRouter();
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-border/50 px-4 md:px-8 py-3 bg-background/60 backdrop-blur-xl">
      
      {/* Left side - back button */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-2 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Go Back"
          onClick={() => router.push('/outliner')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">Back</span>
        </Button>
      </div>

      {/* Middle - citations and chat */}
      <div className="flex items-center justify-center space-x-3">
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full shadow-sm gap-2"
          aria-label="Open Citations"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('outliner-open-citations'));
            }
          }}
        >
          <Quote className="h-4 w-4" />
          <span className="font-medium">Cite</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full shadow-sm gap-2"
          aria-label="Open Chat"
          onClick={(e) => {
            e.preventDefault();
            if (onOpenChat) {
              onOpenChat();
            }
          }}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">Chat</span>
        </Button>
      </div>

      {/* Right side - download dropdown */}
      <div className="flex items-center space-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="rounded-full shadow-sm gap-2">
              <Download className="h-4 w-4" />
              <span className="font-medium">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl">
            <DropdownMenuItem onClick={() => onDownload('pdf')} className="gap-2 cursor-pointer rounded-lg">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload('markdown')} className="gap-2 cursor-pointer rounded-lg">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Markdown</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload('txt')} className="gap-2 cursor-pointer rounded-lg">
              <FileType className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Text</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload('docx')} className="gap-2 cursor-pointer rounded-lg">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Word</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
