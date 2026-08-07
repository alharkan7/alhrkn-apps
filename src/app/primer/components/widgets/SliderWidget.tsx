'use client';

import { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import type { SliderWidgetProps } from '../../types';
import { formulaToLatex } from '../../lib/formula-latex';

/**
 * Compiles a trusted-LLM formula string ("x*x", "Math.sin(x)") into a numeric
 * function. The charset is locked down and assignment/semicolons are rejected so
 * the expression can only be arithmetic over x and Math.*.
 */
function compileFormula(expr: string): ((x: number) => number | null) | null {
  if (!/^[0-9+\-*/%.(),\sxA-Za-z_]+$/.test(expr)) return null;
  if (/[;=]|=>/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', 'with(Math){return (' + expr + ');}') as (x: number) => unknown;
    return (x: number) => {
      try {
        const v = fn(x);
        return typeof v === 'number' && isFinite(v) ? v : null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}

export function SliderWidget({ label, min, max, step, default: def, unit, formula }: SliderWidgetProps) {
  const [value, setValue] = useState<number>(def);

  const compute = useMemo(() => (formula ? compileFormula(formula) : null), [formula]);
  const result = compute ? compute(value) : null;

  // Render the symbolic formula as LaTeX once (it does not change with the
  // slider). The live numeric evaluation below stays as plain text so dragging
  // stays cheap.
  const formulaHtml = useMemo(() => {
    if (!formula) return null;
    const latex = formulaToLatex(formula);
    if (!latex) return null;
    try {
      const html = katex.renderToString(`f(x) = ${latex}`, { displayMode: false, throwOnError: false });
      return html.includes('katex-error') ? null : html;
    } catch {
      return null;
    }
  }, [formula]);

  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : 100;
  const safeStep = step > 0 ? step : 1;
  const clamped = Math.min(safeMax, Math.max(safeMin, value));

  return (
    <div className="my-4 rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums text-primary">
          {formatNum(clamped)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={safeStep}
        value={clamped}
        onChange={(e) => setValue(Number(e.target.value))}
        className={cn('primer-slider w-full')}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatNum(safeMin)}{unit ? ` ${unit}` : ''}</span>
        <span>{formatNum(safeMax)}{unit ? ` ${unit}` : ''}</span>
      </div>
      {(formula || compute) && (
        <div className="mt-3 space-y-1 rounded-lg bg-background/60 px-3 py-2 text-sm">
          {formulaHtml ? (
            <div className="overflow-x-auto text-foreground" dangerouslySetInnerHTML={{ __html: formulaHtml }} />
          ) : (
            formula && <div className="font-mono text-xs text-muted-foreground">f(x) = {formula}</div>
          )}
          {compute && (
            <div className="text-muted-foreground">
              <span className="font-mono">f({formatNum(clamped)})</span> ={' '}
              <span className="font-mono font-medium text-foreground">{result === null ? '—' : formatNum(result)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
