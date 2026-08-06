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
  /** Nearby lesson context used to disambiguate a selected phrase. */
  context?: string;
}

export type PrimerStatus = 'pending' | 'generating' | 'ready' | 'error';

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
