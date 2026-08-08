'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { X, Plus, FileText, FileCode, File, Download } from 'lucide-react';
import { Edge } from 'reactflow';
import { NoteNode } from '../types';
import RichTextEditor from './RichTextEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { generatePDF, generateDOCX } from '../utils';

interface SidebarProps {
  isOpen: boolean;
  selectedNode: NoteNode | null;
  allNodes: NoteNode[];
  allEdges: Edge[];
  onClose: () => void;
  onUpdateNode: (id: string, data: Partial<NoteNode['data']>) => void;
  onAddChild: (parentId: string) => void;
  isOwner?: boolean;
  onInteract?: (e?: React.SyntheticEvent | Event) => boolean | void;
}

const getHeadingStyle = (depth: number) => {
  if (depth === 0) return "text-3xl font-serif font-normal text-center text-slate-900 dark:text-white mb-6 mt-0 leading-tight";
  if (depth === 1) return "text-2xl font-serif font-normal text-slate-800 dark:text-slate-100 mb-4 mt-6 pb-1 border-b border-black/10 dark:border-white/10 leading-tight";
  if (depth === 2) return "text-xl font-serif font-normal text-slate-800 dark:text-slate-200 mb-2 mt-4 leading-snug";
  return "text-lg font-serif font-normal text-slate-700 dark:text-slate-300 mb-2 mt-3 leading-snug";
};

// Subcomponent to handle individual section rendering and textarea auto-resizing
const SidebarSection = ({
  node,
  depth,
  onUpdateNode,
  onAddChild,
  forceUpdateTrigger,
  isOwner = true,
  onInteract
}: {
  node: NoteNode;
  depth: number;
  onUpdateNode: (id: string, data: Partial<NoteNode['data']>) => void;
  onAddChild: (id: string) => void;
  forceUpdateTrigger: boolean;
  isOwner?: boolean;
  onInteract?: (e?: React.SyntheticEvent | Event) => boolean | void;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '0px'; // Collapse to get correct scrollHeight
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight + 2}px`; // Add buffer to prevent cut-off
    }
  };

  // Auto-resize textarea logic
  useEffect(() => {
    adjustHeight();
    // Run again after a short delay to ensure rendering is complete
    const timeoutId = setTimeout(adjustHeight, 10);
    return () => clearTimeout(timeoutId);
  }, [node.data.title, forceUpdateTrigger]);

  return (
    <div className="relative group/section transition-all">
      {/* Title (Heading) - Textarea for multiline support */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={node.data.title}
        readOnly={!isOwner}
        onClick={(e) => {
          if (!isOwner && onInteract) onInteract(e);
        }}
        onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
        className={`w-full bg-transparent border-none focus:ring-0 outline-none resize-none overflow-hidden placeholder:text-slate-300 dark:placeholder:text-slate-700 whitespace-pre-wrap ${getHeadingStyle(depth)}`}
        placeholder="Untitled Section"
        style={{ minHeight: '1.5em' }}
      />

      {/* Content (Rich Text Editor) */}
      <div className="mb-6" onClick={(e) => {
        if (!isOwner && onInteract) onInteract(e);
      }}>
        <RichTextEditor
          key={node.id}
          value={node.data.content}
          onChange={(content) => onUpdateNode(node.id, { content })}
          placeholder="Type your content here..."
          className="text-slate-800 dark:text-slate-200 leading-relaxed prose max-w-none dark:prose-invert font-serif prose-p:text-justify prose-a:text-blue-600 dark:prose-a:text-blue-400"
          readOnly={!isOwner}
        />
      </div>

      {isOwner && (
        <>
          {/* Hover Controls for Section */}
          <div className="absolute -left-10 top-3 opacity-0 group-hover/section:opacity-100 transition-opacity hidden md:block">
            <button
              onClick={() => onAddChild(node.id)}
              title="Add Sub-section"
              className="rounded-lg p-1.5 text-black/35 hover:bg-black/[0.05] hover:text-black dark:text-white/35 dark:hover:bg-white/[0.07] dark:hover:text-white"
            >
              <Plus size={18} />
            </button>
          </div>
          {/* Mobile Controls for Section (always visible or different interaction) */}
          <div className="md:hidden mb-4">
            <button
              onClick={() => onAddChild(node.id)}
              className="flex items-center gap-1 text-xs text-slate-400"
            >
              <Plus size={14} /> Add Sub-section
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default function Sidebar({ isOpen, selectedNode, allNodes, allEdges, onClose, onUpdateNode, onAddChild, isOwner = true, onInteract }: SidebarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const documentStructure = useMemo(() => {
    if (!selectedNode) return [];

    const result: { node: NoteNode; depth: number }[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = allNodes.find(n => n.id === nodeId);
      if (!node || node.hidden) return;

      result.push({ node, depth });

      const childIds = allEdges
        .filter(e => e.source === nodeId)
        .map(e => ({ id: e.target, edge: e }));

      const children = childIds
        .map(c => allNodes.find(n => n.id === c.id))
        .filter((n): n is NoteNode => !!n);

      children.sort((a, b) => {
        const yDiff = a.position.y - b.position.y;
        if (Math.abs(yDiff) > 20) {
          return yDiff;
        }
        return a.position.x - b.position.x;
      });

      children.forEach(child => traverse(child.id, depth + 1));
    };

    traverse(selectedNode.id, 0);
    return result;
  }, [selectedNode, allNodes, allEdges]);

  // Reset scroll position when selectedNode changes
  useEffect(() => {
    if (scrollContainerRef.current && selectedNode) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedNode?.id]); // Only trigger when the node ID changes


  const handleDownload = async (format: 'markdown' | 'pdf' | 'docx') => {
    if (!documentStructure.length) return;

    const fileName = `${selectedNode?.data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "document"}`;

    if (format === 'markdown') {
      // Generate markdown content
      let mdContent = "";

      documentStructure.forEach(({ node, depth }) => {
        const prefix = "#".repeat(depth + 1);
        const title = node.data.title || "Untitled Section";
        mdContent += `${prefix} ${title}\n\n`;

        let text = node.data.content || "";
        // Strip HTML for markdown download
        text = text.replace(/<p>/g, "").replace(/<\/p>/g, "\n\n");
        text = text.replace(/<ul>/g, "").replace(/<\/ul>/g, "\n");
        text = text.replace(/<ol>/g, "").replace(/<\/ol>/g, "\n");
        text = text.replace(/<li>/g, "- ").replace(/<\/li>/g, "\n");
        text = text.replace(/<strong>/g, "**").replace(/<\/strong>/g, "**");
        text = text.replace(/<b>/g, "**").replace(/<\/b>/g, "**");
        text = text.replace(/<em>/g, "*").replace(/<\/em>/g, "*");
        text = text.replace(/<i>/g, "*").replace(/<\/i>/g, "*");
        text = text.replace(/<h[1-6]>/g, "\n**").replace(/<\/h[1-6]>/g, "**\n");
        text = text.replace(/<br\s*\/?>/g, "\n");
        text = text.replace(/<a href="(.*?)">(.*?)<\/a>/g, "[$2]($1)");
        text = text.replace(/<[^>]+>/g, "");

        const txt = document.createElement("textarea");
        txt.innerHTML = text;
        text = txt.value;

        mdContent += `${text.trim()}\n\n`;
      });

      const blob = new Blob([mdContent], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } else if (format === 'pdf' || format === 'docx') {
      // Generate HTML content for PDF/DOCX
      let htmlContent = "";

      documentStructure.forEach(({ node, depth }) => {
        const title = node.data.title || "Untitled Section";
        const headingLevel = Math.min(depth + 1, 6); // h1-h6
        htmlContent += `<h${headingLevel}>${title}</h${headingLevel}>`;
        htmlContent += node.data.content || "";
      });

      if (format === 'pdf') {
        await generatePDF(fileName, htmlContent);
      } else {
        generateDOCX(fileName, htmlContent);
      }
    }
  };

  return (
    <>
      {/* Backdrop overlay - blocks clicks on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/15 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-[110] flex h-full w-full max-w-[100vw] transform flex-col border-l border-black/[0.07] bg-[#f7f7f5] shadow-2xl transition-transform duration-300 ease-in-out dark:border-white/[0.08] dark:bg-[#151513] sm:w-[500px] md:w-[600px] lg:w-[800px] ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#f7f7f5]/90 px-6 py-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#151513]/90">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-black/70 dark:text-white/70">
            Document editor
          </h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto rounded-lg p-2 text-black/40 hover:bg-black/[0.05] hover:text-black dark:text-white/40 dark:hover:bg-white/[0.07] dark:hover:text-white"
                  title="Download"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Download size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 z-[120]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload('pdf'); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  <span>PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload('docx'); }}>
                  <File className="h-4 w-4 mr-2" />
                  <span>DOCX</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload('markdown'); }}>
                  <FileCode className="h-4 w-4 mr-2" />
                  <span>Markdown</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-lg p-2 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black dark:text-white/40 dark:hover:bg-white/[0.07] dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {selectedNode ? (
          <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#efefec] dark:bg-[#10100f]">

            {/* Scrollable Document Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
              <div className="mx-auto min-h-full w-full max-w-[850px] rounded-md border border-black/[0.08] bg-white px-6 py-12 pb-32 font-serif shadow-[0_14px_44px_rgba(25,25,24,0.08)] transition-colors duration-200 dark:border-white/[0.07] dark:bg-[#1b1b19] md:px-16 md:py-20">

                {documentStructure.map(({ node, depth }) => (
                  <SidebarSection
                    key={node.id}
                    node={node}
                    depth={depth}
                    onUpdateNode={onUpdateNode}
                    onAddChild={onAddChild}
                    forceUpdateTrigger={isOpen}
                    isOwner={isOwner}
                    onInteract={onInteract}
                  />
                ))}

                {isOwner && (
                  <div className="mt-16 pt-8 border-t border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <button
                      onClick={() => selectedNode && onAddChild(documentStructure[documentStructure.length - 1]?.node.id || selectedNode.id)}
                      className="mx-auto flex items-center gap-2 rounded-xl px-6 py-3 text-black/40 transition-colors hover:bg-black/[0.04] hover:text-black dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    >
                      <Plus size={20} />
                      <span className="font-medium">Append Section</span>
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#efefec] p-8 text-center text-black/40 dark:bg-[#10100f] dark:text-white/40">
            <div>
              <p className="mb-2 font-medium">No active document.</p>
              <p className="text-xs opacity-70">Select a note on the canvas to open the Document Editor.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
