'use client';
import React, { useState } from 'react';
import { Lightbulb, FileText, ChevronRight, LayoutGrid } from 'lucide-react';

export default function MiniOutlinerRenderer({ details }: { details: any }) {
  const isQuery = details.type === 'query';
  
  let ideas: any[] = [];
  if (isQuery && details.ideas) {
    if (typeof details.ideas === 'string') {
      try { ideas = JSON.parse(details.ideas); } catch (e) {}
    } else if (Array.isArray(details.ideas)) {
      ideas = details.ideas;
    }
  }

  let contentBlocks: any[] = [];
  if (!isQuery && details.content) {
    let parsedContent = details.content;
    if (typeof parsedContent === 'string') {
      try { parsedContent = JSON.parse(parsedContent); } catch (e) {}
    }
    
    if (Array.isArray(parsedContent)) {
      contentBlocks = parsedContent;
    } else if (parsedContent && typeof parsedContent === 'object' && Array.isArray(parsedContent.blocks)) {
      contentBlocks = parsedContent.blocks;
    }
  }

  let abstract: any = null;
  if (!isQuery && details.abstract) {
    if (typeof details.abstract === 'string') {
      try { abstract = JSON.parse(details.abstract); } catch (e) {}
    } else {
      abstract = details.abstract;
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          {isQuery ? (
            <Lightbulb className="text-amber-500" size={20} />
          ) : (
            <FileText className="text-blue-500" size={20} />
          )}
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[300px]">
            {isQuery ? details.keywords : details.title}
          </h2>
        </div>
        <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
          {isQuery ? 'Research Query' : 'Research Draft'}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50 dark:bg-slate-900/50">
        {isQuery ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <LayoutGrid size={16} />
              <span className="text-sm font-medium">Generated Ideas</span>
            </div>
            {ideas.length === 0 ? (
              <p className="text-slate-500 text-sm">No ideas generated yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ideas.map((idea, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-tight">
                      {idea.title}
                    </h3>
                    {idea.abstract?.background && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-4">
                        {idea.abstract.background}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl shadow-sm min-h-full">
            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-6">
              {details.title}
            </h1>
            
            {abstract && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg mb-8 border border-slate-100 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Abstract</h3>
                <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 font-serif">
                  {Object.entries(abstract).map(([key, val]) => (
                    <div key={key}>
                      <span className="font-bold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                      <span>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="prose prose-slate dark:prose-invert max-w-none font-serif prose-headings:font-serif prose-p:text-justify leading-relaxed">
              {contentBlocks.length === 0 ? (
                <p className="text-slate-400 italic text-center py-8">Draft content is empty or still generating...</p>
              ) : (
                contentBlocks.map((block: any, idx: number) => {
                  if (!block || !block.type || !block.data) return null;
                  if (idx === 0 && block.type === 'header') return null;
                  
                  if (block.type === 'header') {
                    const HTag = `h${Math.min(Math.max(block.data.level || 2, 1), 6)}` as any;
                    return <HTag key={idx} dangerouslySetInnerHTML={{ __html: block.data.text }} />;
                  } else if (block.type === 'paragraph') {
                    return <p key={idx} dangerouslySetInnerHTML={{ __html: block.data.text }} />;
                  } else if (block.type === 'list') {
                    const ListTag = block.data.style === 'ordered' ? 'ol' : 'ul';
                    return (
                      <ListTag key={idx}>
                        {(block.data.items || []).map((item: any, i: number) => {
                          let itemText = '';
                          if (typeof item === 'string') {
                            itemText = item;
                          } else if (item && typeof item === 'object') {
                            itemText = item.content || item.text || item.value || item.label || item.name || item.title || String(item);
                          } else {
                            itemText = String(item);
                          }
                          return <li key={i} dangerouslySetInnerHTML={{ __html: itemText }} />;
                        })}
                      </ListTag>
                    );
                  }
                  
                  return null;
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
