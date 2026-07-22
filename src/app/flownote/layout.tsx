import { Metadata, Viewport } from 'next';
import { FlownoteHistorySidebar } from './components/FlownoteHistorySidebar';

export const metadata: Metadata = {
  title: 'FlowNote',
  description: 'A Node-based Document Authoring System',
  openGraph: {
    title: 'FlowNote',
    description: 'A Node-based Document Authoring System',
    images: [`/api/og?title=${encodeURIComponent('FlowNote')}&description=${encodeURIComponent('A Node-based Document Authoring System')}&path=flownote`],
  },
  twitter: {
    card: "summary_large_image",
    title: 'FlowNote',
    description: 'A Node-based Document Authoring System',
    images: [`/api/og?title=${encodeURIComponent('FlowNote')}&description=${encodeURIComponent('A Node-based Document Authoring System')}&path=flownote`],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Ensures the app extends into safe areas
};

export default function FlowNoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <FlownoteHistorySidebar />
      <div className="flex-1 relative">
        <style dangerouslySetInnerHTML={{
          __html: `
          /* FlowNote Custom Styles - Converted from CSS to inline JSX */
          
          body {
            background-color: #f8fafc;
            transition: background-color 0.3s ease;
          }
          
          body.dark {
            background-color: #020617;
          }
          
          /* Custom scrollbar for sidebar */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          
          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          
          .dark ::-webkit-scrollbar-thumb {
            background: #475569;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          
          .dark ::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
          
          /* TipTap Rich Text Editor Customization */
          .rich-text-editor-bubble .tiptap {
            font-family: inherit;
            line-height: 1.625;
            color: #334155;
            padding: 0.5rem 0;
          }
          
          .dark .rich-text-editor-bubble .tiptap {
            color: #e2e8f0;
          }
          
          /* TipTap placeholder */
          .rich-text-editor-bubble .tiptap p.is-editor-empty:first-child::before {
            color: #cbd5e1;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          
          .dark .rich-text-editor-bubble .tiptap p.is-editor-empty:first-child::before {
            color: #475569;
          }
          
          /* Prose styling for TipTap content */
          .rich-text-editor-bubble .prose {
            max-width: none;
          }
          
          .rich-text-editor-bubble .prose p {
            margin-bottom: 0.75em;
            margin-top: 0;
          }
          
          .rich-text-editor-bubble .prose p:last-child {
            margin-bottom: 0;
          }
          
          .rich-text-editor-bubble .prose ul, 
          .rich-text-editor-bubble .prose ol {
            padding-left: 1.25rem;
            margin-top: 0.25rem;
            margin-bottom: 0.75rem;
          }
          
          .rich-text-editor-bubble .prose li {
            margin-top: 0.25rem;
            margin-bottom: 0.25rem;
          }
          
          .rich-text-editor-bubble .prose li > p {
            margin: 0;
          }
          
          .rich-text-editor-bubble .prose strong {
            color: inherit;
            font-weight: 600;
          }
          
          /* React Flow Node Customization */
          .react-flow__node {
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          }
          
          .react-flow__node.selected {
            box-shadow: 0 0 0 2px #6366f1;
          }
          
          /* Handle styles */
          .react-flow__handle {
            width: 8px;
            height: 8px;
            background-color: #94a3b8;
            border: 2px solid white;
            transition: all 0.2s ease;
          }
          
          .dark .react-flow__handle {
            background-color: #64748b;
            border-color: #1e293b;
          }
          
          .react-flow__handle:hover {
            width: 12px;
            height: 12px;
            background-color: #6366f1;
          }
          
          /* Connection line styles */
          .react-flow__connection-path {
            stroke: #94a3b8;
            stroke-width: 2;
          }
          
          .dark .react-flow__connection-path {
            stroke: #64748b;
          }
          
          /* Selection styles */
          .react-flow__nodeselection-rect {
            background: rgba(99, 102, 241, 0.05);
            border: 1px dashed #6366f1;
          }
          
          /* Controls panel styles */
          .react-flow__controls {
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .react-flow__controls-button {
            border-bottom: 1px solid #e2e8f0;
            background-color: white;
            color: #475569;
          }
          
          .dark .react-flow__controls-button {
            border-bottom: 1px solid #334155;
            background-color: #1e293b;
            color: #cbd5e1;
          }
          
          .react-flow__controls-button:hover {
            background-color: #f1f5f9;
          }
          
          .dark .react-flow__controls-button:hover {
            background-color: #334155;
          }
          
          /* Mini map styles */
          .react-flow__minimap {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          
          .dark .react-flow__minimap {
            background-color: #1e293b;
          }
          
          .react-flow__minimap-mask {
            fill: rgba(248, 250, 252, 0.7);
          }
          
          .dark .react-flow__minimap-mask {
            fill: rgba(2, 6, 23, 0.7);
          }
          
          /* Node custom internal scrollbar area */
          .node-scroll-area {
            scrollbar-width: thin;
            scrollbar-color: transparent transparent;
            transition: scrollbar-color 0.3s ease;
          }
          
          .group:hover .node-scroll-area {
            scrollbar-color: #cbd5e1 transparent;
          }
          
          .dark .group:hover .node-scroll-area {
            scrollbar-color: #475569 transparent;
          }
          
          .node-scroll-area::-webkit-scrollbar-thumb {
            background-color: transparent;
          }
          
          .group:hover .node-scroll-area::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
          }
          
          .dark .group:hover .node-scroll-area::-webkit-scrollbar-thumb {
            background-color: #475569;
          }
          
          /* Custom scrollbar styling */
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          
          .dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #475569;
          }
        `}} />
        {children}
      </div>
    </div>

  );
}
