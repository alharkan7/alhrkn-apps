'use client';

import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { AlertTriangle } from 'lucide-react';
import type { WidgetType } from '../../types';
import { SliderWidget } from './SliderWidget';
import { QuizWidget } from './QuizWidget';
import { ToggleWidget } from './ToggleWidget';

const sliderSchema = z.object({
  label: z.string().default('x'),
  min: z.coerce.number().default(0),
  max: z.coerce.number().default(100),
  step: z.coerce.number().default(1),
  default: z.coerce.number().default(50),
  unit: z.string().optional(),
  formula: z.string().optional(),
});

const quizSchema = z.object({
  question: z.string().default(''),
  options: z.array(z.string()).min(2).default([]),
  answer: z.coerce.number().default(0),
  explanation: z.string().optional(),
});

const toggleSchema = z.object({
  prompt: z.string().default(''),
  reveal: z.string().default(''),
});

function parseRaw(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(jsonrepair(raw));
    } catch {
      return null;
    }
  }
}

/**
 * Renders a fenced widget block. `raw` is the JSON body the model emitted.
 */
export function WidgetBlock({ type, raw }: { type: string; raw: string }) {
  const data = parseRaw(raw);

  if (type === 'slider') {
    const parsed = sliderSchema.safeParse(data);
    if (!parsed.success) return <WidgetError raw={raw} />;
    return <SliderWidget {...parsed.data} />;
  }
  if (type === 'quiz') {
    const parsed = quizSchema.safeParse(data);
    if (!parsed.success) return <WidgetError raw={raw} />;
    return <QuizWidget {...parsed.data} />;
  }
  if (type === 'toggle') {
    const parsed = toggleSchema.safeParse(data);
    if (!parsed.success) return <WidgetError raw={raw} />;
    return <ToggleWidget {...parsed.data} />;
  }
  return <WidgetError raw={raw} />;
}

function WidgetError({ raw }: { raw: string }) {
  return (
    <div className="my-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Could not render this widget.</p>
        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] opacity-80">
{raw.slice(0, 400)}
        </pre>
      </div>
    </div>
  );
}

export const SUPPORTED_WIDGET_TYPES: WidgetType[] = ['slider', 'quiz', 'toggle'];
