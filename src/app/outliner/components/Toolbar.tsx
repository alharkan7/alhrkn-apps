'use client';

import { Download, FileText, FileCode, FileType, File, Quote, MessageCircle, Menu, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AppsHeader } from '@/components/apps-header';
import Link from 'next/link';

interface ToolbarProps {
  onDownload: (format: 'pdf' | 'markdown' | 'txt' | 'docx') => void;
  onOpenChat?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function Toolbar({ onDownload, onOpenChat, onSave, isSaving, isSaved }: ToolbarProps) {
  const renderCitationControls = () => (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 max-lg:w-9 rounded-xl border-black/[0.07] bg-black/[0.025] px-3 max-lg:px-0 text-black/65 shadow-none hover:bg-black/[0.06] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
        aria-label="Open Citations"
        title="Citations"
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('outliner-open-citations'));
          }
        }}
      >
        <Quote className="h-4 w-4" />
        <span className="font-medium max-lg:hidden">Cite</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 max-lg:w-9 rounded-xl border-black/[0.07] bg-black/[0.025] px-3 max-lg:px-0 text-black/65 shadow-none hover:bg-black/[0.06] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
        aria-label="Open Chat"
        title="Chat"
        onClick={(e) => {
          e.preventDefault();
          onOpenChat?.();
        }}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="font-medium max-lg:hidden">Chat</span>
      </Button>
    </>
  );

  const quietButtonClass = 'h-9 max-lg:w-9 rounded-xl border-black/[0.07] bg-black/[0.025] px-3 max-lg:px-0 text-black/65 shadow-none hover:bg-black/[0.06] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white';

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80">
      <AppsHeader
        leftButton={
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
            aria-label="Open outline history"
            onClick={() => window.dispatchEvent(new Event('toggleOutlinerHistorySidebar'))}
          >
            <Menu size={18} />
          </Button>
        }
        title={
          <Link
            href="/outliner"
            title="Back to Outliner"
            className="inline-flex items-center text-sm font-semibold tracking-[-0.01em] text-[#191918] no-underline transition-opacity hover:opacity-65 dark:text-[#f2f2ef]"
          >
            Outliner
          </Link>
        }
        centerContent={renderCitationControls()}
        rightContent={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 lg:hidden">
              {renderCitationControls()}
            </div>
            {onSave && (
          <Button
            variant="secondary"
            size="sm"
            className={quietButtonClass}
            onClick={onSave}
            disabled={isSaving}
            aria-label={isSaved ? 'Saved' : 'Save document'}
            title={isSaved ? 'Saved' : 'Save document'}
          >
            {isSaved ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            <span className="font-medium max-lg:hidden">{isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}</span>
          </Button>
            )}
            <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className={quietButtonClass} aria-label="Export document" title="Export document">
              <Download className="h-4 w-4" />
              <span className="font-medium max-lg:hidden">Export</span>
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
        }
      />
    </div>
  );
}
