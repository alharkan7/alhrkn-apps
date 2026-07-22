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
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[600px] lg:w-[800px] max-w-[100vw] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-[110] border-l border-slate-200 dark:border-slate-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            FlowNote Editor
          </h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors h-auto"
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
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {selectedNode ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#111]">

            {/* Scrollable Document Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
              <div className="bg-white dark:bg-[#1a1a1a] shadow-2xl rounded-sm border border-black/10 dark:border-white/5 px-6 py-12 md:px-16 md:py-20 mx-auto w-full max-w-[850px] min-h-full font-serif transition-colors duration-200 pb-32">

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
                      className="flex items-center gap-2 mx-auto text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-3 px-6 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
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
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-600 p-8 text-center bg-slate-50 dark:bg-slate-950/50">
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