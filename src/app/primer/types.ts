// Primer shared types

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface PrimerMeta {
  title?: string;
  glossary: GlossaryEntry[];
}

export interface PrimerOptions {
  audience?: string;
  language?: string;
  length?: 'brief' | 'moderate' | 'detailed';
  tone?: string;
  /** Nearby lesson context used to disambiguate a selected phrase. */
  context?: string;
}

export type PrimerStatus = 'pending' | 'generating' | 'ready' | 'error';

// --- Citations (Cite feature) ---

/** A single academic source backing a cited passage. */
export interface PrimerReference {
  title: string;
  authors: string[];
  year: number | null;
  venue?: string;
  doi?: string;
  url?: string;
  citationCount?: number;
}

/** A persisted citation: one passage + the LLM verdict + the 1-3 sources it picked. */
export interface PrimerCitation {
  id: string;
  selection: string;
  occurrence: number | null;
  verdict: string;
  references: PrimerReference[];
}

// --- Widget props (emitted by the LLM inside fenced blocks) ---

export interface SliderWidgetProps {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** A JavaScript numeric expression in the variable `x`, e.g. "x*x" or "Math.sin(x)". */
  formula?: string;
}

export interface QuizWidgetProps {
  question: string;
  options: string[];
  answer: number; // index into options
  explanation?: string;
}

export interface ToggleWidgetProps {
  prompt: string;
  /** Markdown revealed on click. */
  reveal: string;
}

export type WidgetType = 'slider' | 'quiz' | 'toggle';
