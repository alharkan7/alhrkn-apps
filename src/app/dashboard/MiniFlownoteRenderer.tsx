'use client';
import React, { useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from '@/app/flownote/components/CustomNode';
import { Network, FileText } from 'lucide-react';

const nodeTypes = {
  note: CustomNode,
};

export default function MiniFlownoteRenderer({ nodes = [], edges = [] }: { nodes: any[], edges: any[] }) {
  const [viewMode, setViewMode] = useState<'mindmap' | 'document'>('mindmap');

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="flex justify-center p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('mindmap')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'mindmap' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Network size={16} />
            Mindmap
          </button>
          <button
            onClick={() => setViewMode('document')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'document' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Document
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'mindmap' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background color="#94a3b8" gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto">
              <FlownoteDocumentView nodes={nodes} edges={edges} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlownoteDocumentView({ nodes, edges }: { nodes: any[], edges: any[] }) {
  if (!nodes || nodes.length === 0) return <div className="text-slate-500">No content.</div>;
  
  const rootNode = nodes.find(n => !edges.some((e: any) => e.target === n.id)) || nodes[0];
  const result: { node: any; depth: number }[] = [];

  const traverse = (nodeId: string, depth: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      result.push({ node, depth });
    }

    const childIds = edges
      .filter((e: any) => e.source === nodeId)
      .map((e: any) => ({ id: e.target }));

    const children = childIds
      .map((c: any) => nodes.find(n => n.id === c.id))
      .filter(n => !!n);

    children.sort((a, b) => {
      const yDiff = (a.position?.y || 0) - (b.position?.y || 0);
      if (Math.abs(yDiff) > 20) {
        return yDiff;
      }
      return (a.position?.x || 0) - (b.position?.x || 0);
    });

    children.forEach(child => traverse(child.id, depth + 1));
  };

  traverse(rootNode.id, 0);

  const getHeadingStyle = (depth: number) => {
    if (depth === 0) return "text-3xl font-serif font-normal text-center text-slate-900 dark:text-white mb-6 mt-0 leading-tight";
    if (depth === 1) return "text-2xl font-serif font-normal text-slate-800 dark:text-slate-100 mb-4 mt-6 pb-1 border-b border-black/10 dark:border-white/10 leading-tight";
    if (depth === 2) return "text-xl font-serif font-normal text-slate-800 dark:text-slate-200 mb-2 mt-4 leading-snug";
    return "text-lg font-serif font-normal text-slate-700 dark:text-slate-300 mb-2 mt-3 leading-snug";
  };

  return (
    <div className="space-y-6 pb-20">
      {result.map(({ node, depth }, index) => (
        <div key={node.id || index} className="mb-6">
          <div className={getHeadingStyle(depth)}>
            {node.data?.title || "Untitled Section"}
          </div>
          <div 
            className="text-slate-800 dark:text-slate-200 leading-relaxed prose max-w-none dark:prose-invert font-serif prose-p:text-justify prose-a:text-blue-600 dark:prose-a:text-blue-400"
            dangerouslySetInnerHTML={{ __html: node.data?.content || '' }}
          />
        </div>
      ))}
    </div>
  );
}
