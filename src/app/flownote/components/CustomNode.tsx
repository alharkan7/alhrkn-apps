'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { Eye } from 'lucide-react';
import { NoteData } from '../types';

// Common handle styles
const handleBaseStyle = "!w-3 !h-3 !border-2 !border-white dark:!border-slate-800 transition-all duration-200 opacity-0 group-hover:opacity-100";
const targetHandleStyle = `${handleBaseStyle} !bg-slate-400 hover:!bg-blue-500 hover:!scale-125`;
const sourceHandleStyle = `${handleBaseStyle} !bg-slate-600 hover:!bg-blue-600 hover:!scale-125`;

// Color Mappings
const COLOR_STYLES: Record<string, { bg: string; border: string; header: string }> = {
  default: {
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    header: 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    header: 'bg-red-100/50 dark:bg-red-900/60 border-red-100 dark:border-red-800'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900',
    header: 'bg-orange-100/50 dark:bg-orange-900/60 border-orange-100 dark:border-orange-800'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    header: 'bg-amber-100/50 dark:bg-amber-900/60 border-amber-100 dark:border-amber-800'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-900',
    header: 'bg-green-100/50 dark:bg-green-900/60 border-green-100 dark:border-green-800'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-900',
    header: 'bg-blue-100/50 dark:bg-blue-900/60 border-blue-100 dark:border-blue-800'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-900',
    header: 'bg-purple-100/50 dark:bg-purple-900/60 border-purple-100 dark:border-purple-800'
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    border: 'border-pink-200 dark:border-pink-900',
    header: 'bg-pink-100/50 dark:bg-pink-900/60 border-pink-100 dark:border-pink-800'
  }
};

const CustomNode = ({ data, selected, id }: NodeProps<NoteData>) => {
  const colorKey = data.color || 'default';
  const styles = COLOR_STYLES[colorKey] || COLOR_STYLES.default;

  const handleOpenEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Dispatch a custom event that the parent can listen to
    const event = new CustomEvent('openNodeEditor', { detail: { nodeId: id } });
    window.dispatchEvent(event);
  };

  return (
    // Wrap everything in a group div to control handle visibility on hover
    <div className="w-full h-full group relative">
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500 dark:border-blue-400"
        handleClassName="h-2.5 w-2.5 bg-blue-500 rounded border-none z-50"
      />

      {/* --- TARGET HANDLES (Incoming) --- */}
      <Handle type="target" id="target-top" position={Position.Top} className={targetHandleStyle} style={{ top: -6 }} />
      <Handle type="target" id="target-left" position={Position.Left} className={targetHandleStyle} style={{ left: -6 }} />

      {/* --- SOURCE HANDLES (Outgoing) --- */}
      <Handle type="source" id="source-right" position={Position.Right} className={sourceHandleStyle} style={{ right: -6 }} />
      <Handle type="source" id="source-bottom" position={Position.Bottom} className={sourceHandleStyle} style={{ bottom: -6 }} />

      {/* Node Card UI */}
      <div className={`
        h-full w-full flex flex-col overflow-hidden
        ${styles.bg}
        rounded-xl pb-3
        border transition-all duration-200
        ${selected
          ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] dark:border-blue-400 dark:shadow-[0_0_0_2px_rgba(96,165,250,0.3)]'
          : `${styles.border} shadow-sm hover:shadow-md dark:shadow-none`
        }
      `}>

        {/* Header Strip */}
        <div className={`${styles.header} px-4 py-3 border-b flex items-center gap-2 group/header relative`}>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate select-none flex-1">
            {data.title || 'Untitled Note'}
          </h3>

          {/* Eye Icon - appears on hover */}
          <button
            onClick={handleOpenEditor}
            className="nodrag nopan absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            title="Open in Document Editor"
          >
            <Eye size={14} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body Content */}
        <div
          className="flex-1 px-4 pt-4 pb-2 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 prose prose-sm max-w-none nodrag nowheel cursor-text node-scroll-area"
          dangerouslySetInnerHTML={{ __html: data.content || '<p class="text-slate-400 dark:text-slate-500 italic">No content</p>' }}
        />
      </div>
    </div>
  );
};

const CustomNodeMemo = memo(CustomNode);
CustomNodeMemo.displayName = 'CustomNode';
export default CustomNodeMemo;