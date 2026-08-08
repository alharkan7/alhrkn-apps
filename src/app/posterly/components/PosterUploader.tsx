'use client';

import { useRef, useState } from 'react';
import { FileText, Sparkles, Type, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POSTER_STYLES, type PosterStyle } from '../types';

export interface PosterInput {
  file: File | null;
  text: string;
  style: PosterStyle;
}

interface PosterUploaderProps {
  loading: boolean;
  loadingText: string;
  error: string | null;
  onGenerate: (input: PosterInput) => Promise<void>;
}

const ACCEPTED_FILE_TYPES = '.pdf,.md,.markdown,.txt,.html,.htm';

export function PosterUploader({ loading, loadingText, error, onGenerate }: PosterUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<PosterStyle>('minimal');
  const [dragging, setDragging] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    const supported = candidate.type === 'application/pdf' || candidate.type.startsWith('text/') || /\.(pdf|md|markdown|txt|html|htm)$/i.test(candidate.name);
    if (!supported) {
      setInputError('Choose a PDF, Markdown, plain text, or HTML file.');
      return;
    }
    if (candidate.size > 25 * 1024 * 1024) {
      setInputError('Files must be 25 MB or smaller.');
      return;
    }
    setInputError(null);
    setFile(candidate);
  };

  const submit = () => onGenerate({ file: mode === 'file' ? file : null, text: mode === 'text' ? text : '', style });
  const ready = mode === 'file' ? Boolean(file) : text.trim().length >= 20;

  return (
    <div className="relative mx-auto w-full max-w-5xl group">
      <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-violet-500/20 blur-xl opacity-70 transition duration-700 group-hover:opacity-100" />
      <div className="relative z-10 rounded-[2rem] border bg-background/85 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex flex-wrap gap-2 rounded-xl bg-muted/50 p-1">
          <button type="button" onClick={() => setMode('file')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === 'file' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Upload className="h-4 w-4" /> Upload paper
          </button>
          <button type="button" onClick={() => setMode('text')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === 'text' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Type className="h-4 w-4" /> Paste text / Markdown
          </button>
        </div>

        {mode === 'file' ? (
          file ? (
            <div className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to analyze</p></div>
              <Button type="button" variant="ghost" size="icon" disabled={loading} onClick={() => setFile(null)} aria-label="Remove paper"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <button
              type="button"
              className={`w-full rounded-2xl border-2 border-dashed p-12 text-center transition-colors sm:p-16 ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-8 w-8" /></span>
              <span className="block text-lg font-semibold">Drop a scientific paper here</span>
              <span className="mt-2 block text-sm text-muted-foreground">PDF, Markdown, text, or HTML · up to 25 MB</span>
            </button>
          )
        ) : (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the paper, abstract, or Markdown here…"
            className="min-h-64 w-full resize-y rounded-2xl border bg-background px-5 py-4 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
        )}

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold">Choose a visual style</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {POSTER_STYLES.map((option) => (
              <button key={option.id} type="button" disabled={loading} onClick={() => setStyle(option.id)} className={`rounded-xl border p-3 text-left transition ${style === option.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/30'}`}>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {(inputError || error) && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{inputError || error}</div>}
        <Button className="mt-6 w-full rounded-full py-6 text-base shadow-lg" disabled={loading || !ready} onClick={submit}>
          {loading ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{loadingText}</> : <><Sparkles className="mr-2 h-5 w-5" />Generate scientific poster</>}
        </Button>
      </div>
    </div>
  );
}
