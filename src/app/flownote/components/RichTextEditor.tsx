'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [showBubble, setShowBubble] = React.useState(false);
  const [bubblePosition, setBubblePosition] = React.useState({ top: 0, left: 0 });

  const extensions = React.useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2],
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 dark:text-blue-400 underline hover:opacity-80',
      },
    }),
    Placeholder.configure({
      placeholder: placeholder || 'Type your content here...',
    }),
  ], [placeholder]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editorProps: {
      attributes: {
        class: `outline-none min-h-[2em] focus:outline-none ${className || ''}`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value) {
        onChange(html);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;

      if (empty || !editor.view.hasFocus()) {
        setShowBubble(false);
        return;
      }

      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);

      const editorElement = editor.view.dom;
      const editorRect = editorElement.getBoundingClientRect();

      // Position bubble menu above selection
      const left = ((start.left + end.left) / 2) - editorRect.left;
      const top = start.top - editorRect.top - 10; // 10px above selection

      setBubblePosition({ top, left });
      setShowBubble(true);
    },
  });

  // Update editor content when value prop changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor-bubble relative">
      {/* Bubble Menu - appears on text selection */}
      {showBubble && (
        <div
          style={{
            position: 'absolute',
            top: `${bubblePosition.top}px`,
            left: `${bubblePosition.left}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
          }}
          className="flex items-center gap-1 bg-slate-800 dark:bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700 p-1"
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('bold') ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('italic') ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button
            type="button"
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-2 hover:bg-slate-700 rounded transition-colors ${editor.isActive('link') ? 'bg-slate-700 text-white' : 'text-slate-300'
              }`}
            title="Add Link"
          >
            <LinkIcon size={16} />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
