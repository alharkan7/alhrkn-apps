import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'FlowNote',
  description: 'A Node-based Document Authoring System',
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
    <>
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
          margin-top: 0.5em;
          margin-bottom: 0.75em;
        }
        
        .rich-text-editor-bubble .prose li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }
        
        .rich-text-editor-bubble .prose h1,
        .rich-text-editor-bubble .prose h2 {
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor-bubble .tiptap:focus {
          outline: none;
        }
        
        /* Node Content Prose Styling - Fix bold text in dark mode */
        .prose strong,
        .prose b {
          color: inherit;
          font-weight: 600;
        }
        
        .dark .prose strong,
        .dark .prose b {
          color: inherit;
        }
        
        /* Smooth transitions for theme switching */
        * {
          transition-property: background-color, border-color, color, fill, stroke;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }
        
        /* Disable transition for transforms to avoid laggy drags */
        .react-flow__viewport,
        .react-flow__node,
        .react-flow__edge {
          transition: none !important;
        }
        
        /* React Flow Controls Customization */
        .react-flow__controls {
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
          border-radius: 0.5rem !important;
          overflow: hidden !important;
          border: 1px solid #e2e8f0;
        }
        
        .react-flow__controls-button {
          background-color: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
          color: #475569 !important;
          width: 12px !important;
          height: 12px !important;
        }
        
        .react-flow__controls-button:last-child {
          border-bottom: none !important;
        }
        
        .react-flow__controls-button:hover {
          background-color: #f8fafc !important;
          color: #1e293b !important;
        }
        
        .react-flow__controls-button svg {
          fill: currentColor !important;
          max-width: 8px !important;
          max-height: 8px !important;
        }
        
        /* Dark Mode overrides for Controls */
        .dark .react-flow__controls {
          border-color: #334155 !important;
        }
        
        .dark .react-flow__controls-button {
          background-color: #1e293b !important;
          border-bottom-color: #334155 !important;
          color: #94a3b8 !important;
        }
        
        .dark .react-flow__controls-button:hover {
          background-color: #334155 !important;
          color: #f1f5f9 !important;
        }
        
        /* Node Content Scrollbar - visibility on hover */
        .node-scroll-area {
          scrollbar-color: transparent transparent;
          transition: scrollbar-color 0.2s;
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
    </>

  );
}

