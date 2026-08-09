'use client';

import { useRef, useState } from 'react';
import { ArrowUp, ChevronDown, ChevronUp, FileText, Type, Upload, X } from 'lucide-react';
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
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
      <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
      <div className="relative z-10 rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] transition-shadow duration-300 focus-within:shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(6,182,212,0.08)] dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:p-4">
        <div className="relative mb-3 grid grid-cols-2 gap-1 rounded-xl border border-black/[0.05] bg-black/[0.035] p-1 dark:border-white/[0.06] dark:bg-white/[0.045]">
          <span
            className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%_-_0.375rem)] rounded-lg bg-[#191918] shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:bg-[#f2f2ef] ${mode === 'text' ? 'translate-x-[calc(100%_+_0.25rem)]' : 'translate-x-0'}`}
            aria-hidden="true"
          />
          <button type="button" onClick={() => setMode('file')} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'file' ? 'text-white dark:text-[#191918]' : 'text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white'}`}>
            <Upload className="size-4" /><span>Upload</span>
          </button>
          <button type="button" onClick={() => setMode('text')} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'text' ? 'text-white dark:text-[#191918]' : 'text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white'}`}>
            <Type className="size-4" /><span>Paste Text</span>
          </button>
        </div>

        {mode === 'file' ? (
          file ? (
            <div className="flex items-center gap-4 rounded-2xl border border-black/[0.07] bg-black/[0.025] p-5 dark:border-white/[0.08] dark:bg-white/[0.035]">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-black/[0.055] text-black/48 dark:bg-white/[0.07] dark:text-white/48"><FileText className="size-6" /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-sm text-black/42 dark:text-white/42">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to analyze</p></div>
              <Button type="button" variant="ghost" size="icon" disabled={loading} onClick={() => setFile(null)} aria-label="Remove paper"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <button
              type="button"
              className={`w-full rounded-2xl border border-dashed p-8 text-center transition-colors sm:p-10 ${dragging ? 'border-black/30 bg-black/[0.04] dark:border-white/30 dark:bg-white/[0.05]' : 'border-black/15 hover:border-black/28 hover:bg-black/[0.025] dark:border-white/15 dark:hover:border-white/28 dark:hover:bg-white/[0.035]'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-black/[0.055] text-black/45 dark:bg-white/[0.07] dark:text-white/45"><Upload className="size-6" /></span>
              <span className="block text-lg font-semibold">Drop a scientific paper here</span>
              <span className="mt-2 block text-sm text-black/42 dark:text-white/42">PDF, Markdown, text, or HTML · up to 25 MB</span>
            </button>
          )
        ) : (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the paper, abstract, or Markdown here…"
            className="min-h-44 w-full resize-y rounded-2xl border border-black/[0.07] bg-transparent px-4 py-4 text-[15px] leading-relaxed outline-none transition placeholder:text-black/27 focus:border-black/18 focus:ring-2 focus:ring-black/[0.04] dark:border-white/[0.08] dark:placeholder:text-white/25 dark:focus:border-white/18 dark:focus:ring-white/[0.04] sm:min-h-48"
            disabled={loading}
          />
        )}

        <div className="mt-4">
          <button type="button" disabled={loading} aria-expanded={showStyles} onClick={() => setShowStyles((value) => !value)} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-xs font-medium text-black/48 hover:text-black dark:text-white/48 dark:hover:text-white">
            <span>Style · {POSTER_STYLES.find((option) => option.id === style)?.label}</span>
            {showStyles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${showStyles ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none invisible grid-rows-[0fr] opacity-0'}`} aria-hidden={!showStyles}>
            <div className="min-h-0 overflow-hidden">
              <div className="grid gap-2 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                {POSTER_STYLES.map((option) => {
                  const preview = STYLE_PREVIEWS[option.id];
                  return (
                    <button key={option.id} type="button" disabled={loading} onClick={() => setStyle(option.id)} className={`relative h-20 overflow-hidden rounded-xl border p-0 text-left transition ${style === option.id ? 'border-black ring-2 ring-black/20 ring-offset-1 dark:border-white dark:ring-white/20 dark:ring-offset-[#1b1b19]' : 'border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30'}`}>
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
        <div className="mt-4 flex justify-end border-t border-black/[0.055] pt-3 dark:border-white/[0.07]">
          <Button className="group h-10 rounded-xl bg-[#191918] px-4 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white" disabled={loading || !ready} onClick={submit}>
            {loading ? <><span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{loadingText}</> : <>Create<ArrowUp className="ml-1 size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
