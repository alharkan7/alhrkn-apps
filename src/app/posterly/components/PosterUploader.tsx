'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Presentation, Type, Upload, X } from 'lucide-react';
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
const STYLE_PREVIEWS: Record<PosterStyle, { backgroundColor: string; backgroundImage: string; textClass: string }> = {
  minimal: {
    backgroundColor: '#f8fafc',
    backgroundImage: 'linear-gradient(135deg, rgba(37, 99, 235, 0.16) 1px, transparent 1px), linear-gradient(45deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
    textClass: 'text-slate-900',
  },
  editorial: {
    backgroundColor: '#f6ede2',
    backgroundImage: 'repeating-linear-gradient(0deg, rgba(182, 91, 53, 0.14) 0, rgba(182, 91, 53, 0.14) 1px, transparent 1px, transparent 9px)',
    textClass: 'text-stone-900',
  },
  dark: {
    backgroundColor: '#101827',
    backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(102, 227, 196, 0.35), transparent 32%), linear-gradient(135deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
    textClass: 'text-white',
  },
  blueprint: {
    backgroundColor: '#0d3b66',
    backgroundImage: 'linear-gradient(rgba(125, 211, 252, 0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 211, 252, 0.28) 1px, transparent 1px)',
    textClass: 'text-white',
  },
};

export function PosterUploader({ loading, loadingText, error, onGenerate }: PosterUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<PosterStyle>('minimal');
  const [showStyles, setShowStyles] = useState(false);
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
      <div className="relative z-10 rounded-[1.5rem] border bg-background/85 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-muted/50 p-1">
          <button type="button" onClick={() => setMode('file')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === 'file' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Upload className="h-4 w-4" /> Upload
          </button>
          <button type="button" onClick={() => setMode('text')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === 'text' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Type className="h-4 w-4" /> Paste Text
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
              className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-7 w-7" /></span>
              <span className="block text-lg font-semibold">Drop a scientific paper here</span>
              <span className="mt-2 block text-sm text-muted-foreground">PDF, Markdown, text, or HTML · up to 25 MB</span>
            </button>
          )
        ) : (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the paper, abstract, or Markdown here…"
            className="min-h-48 w-full resize-y rounded-2xl border bg-background px-5 py-4 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:min-h-56"
            disabled={loading}
          />
        )}

        <div className="mt-4">
          <button type="button" disabled={loading} aria-expanded={showStyles} onClick={() => setShowStyles((value) => !value)} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-sm font-semibold hover:text-primary">
            <span>Choose a Style</span>
            {showStyles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${showStyles ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none invisible grid-rows-[0fr] opacity-0'}`} aria-hidden={!showStyles}>
            <div className="min-h-0 overflow-hidden">
              <div className="grid gap-2 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                {POSTER_STYLES.map((option) => {
                  const preview = STYLE_PREVIEWS[option.id];
                  return (
                    <button key={option.id} type="button" disabled={loading} onClick={() => setStyle(option.id)} className={`relative h-20 overflow-hidden rounded-xl border p-0 text-left transition ${style === option.id ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-border hover:border-primary/60'}`}>
                      <span className="absolute inset-0" style={{ backgroundColor: preview.backgroundColor, backgroundImage: preview.backgroundImage, backgroundSize: option.id === 'blueprint' ? '18px 18px' : undefined }} />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <span className={`relative z-10 flex h-full items-end p-3 text-sm font-semibold ${preview.textClass}`}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {(inputError || error) && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{inputError || error}</div>}
        <Button className="mt-4 w-full rounded-full py-5 text-base shadow-lg" disabled={loading || !ready} onClick={submit}>
          {loading ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{loadingText}</> : <><Presentation className="mr-2 h-5 w-5" />Create Poster</>}
        </Button>
      </div>
    </div>
  );
}
