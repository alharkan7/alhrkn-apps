'use client';
import React, { useState } from 'react';
import { FileText, Table } from 'lucide-react';

function HighlightedText({ text, statements }: { text: string, statements: any[] }) {
  if (!text) return <span className="text-slate-400 italic">No text content available.</span>;

  const allHighlights: Array<{
    start: number
    end: number
    type: 'statement'
    data?: any
  }> = []

  statements.forEach((stmt) => {
    if (stmt.startIndex !== undefined && stmt.endIndex !== undefined && stmt.startIndex >= 0 && stmt.endIndex > stmt.startIndex) {
      allHighlights.push({
        start: stmt.startIndex,
        end: stmt.endIndex,
        type: 'statement',
        data: stmt,
      })
    }
  })

  if (allHighlights.length === 0) {
    return <>{text}</>
  }

  // Sort by start index
  allHighlights.sort((a, b) => a.start - b.start)

  const parts: React.JSX.Element[] = []
  let lastIndex = 0

  allHighlights.forEach((highlight, index) => {
    const start = Math.max(lastIndex, highlight.start)
    const end = Math.max(start, highlight.end)

    if (start > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>
          {text.substring(lastIndex, start)}
        </span>
      )
    }

    if (end > start) {
      const highlightedText = text.substring(start, end)
      const stmt = highlight.data
      parts.push(
        <span
          key={`highlight-${index}`}
          className="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded relative group hover:bg-yellow-300 dark:hover:bg-yellow-800/60 transition-colors"
          title={`${stmt.actor} (${stmt.organization || 'No organization'}): ${stmt.agree ? 'Agrees' : 'Disagrees'} about ${stmt.concept}`}
        >
          {highlightedText}
          <span
            className={`absolute -top-6 left-0 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white ${
              stmt.agree ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {stmt.actor}
          </span>
        </span>
      )
    }

    lastIndex = Math.max(lastIndex, end)
  })

  if (lastIndex < text.length) {
    parts.push(
      <span key="remaining">
        {text.substring(lastIndex)}
      </span>
    )
  }

  return <>{parts}</>
}

export default function MiniDiscourseRenderer({ title, text, statements = [] }: { title: string, text: string, statements: any[] }) {
  const [viewMode, setViewMode] = useState<'text' | 'statements'>('text');

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="flex justify-center p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('text')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'text' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Source Text
          </button>
          <button
            onClick={() => setViewMode('statements')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'statements' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Table size={16} />
            Analyzed Statements
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
        {viewMode === 'text' ? (
          <div className="p-6 max-w-3xl mx-auto space-y-4">
            <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white border-b pb-4">{title || 'Untitled Document'}</h1>
            <div className="whitespace-pre-wrap font-serif text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
              <HighlightedText text={text} statements={statements} />
            </div>
          </div>
        ) : (
          <div className="p-4">
            {statements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 min-h-[400px]">
                <Table size={48} className="text-slate-300 mb-4" />
                <p>No analyzed statements found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">Statement</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">Concept</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">Actor</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">Organization</th>
                      <th className="px-4 py-3 font-semibold text-center border-b border-slate-200 dark:border-slate-700">Agree</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statements.map((stmt: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-md">{stmt.statement}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{stmt.concept}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{stmt.actor}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{stmt.organization}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stmt.agree ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                            {stmt.agree ? 'TRUE' : 'FALSE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
