// Shared parsing for the Primer "primer:meta" trailing block.
// Used both server-side (persist on stream finish) and client-side (progressive strip + glossary).

import { jsonrepair } from 'jsonrepair';
import type { GlossaryEntry, PrimerMeta } from '../types';

const META_OPEN_RE = /```primer:meta\b/g;

/**
 * Index in `text` of the opening backticks of the (last) primer:meta block, or -1.
 */
function metaOpenIndex(text: string): number {
  let last = -1;
  let m: RegExpExecArray | null;
  META_OPEN_RE.lastIndex = 0;
  while ((m = META_OPEN_RE.exec(text)) !== null) {
    last = m.index;
  }
  return last;
}

/**
 * The markdown body with the trailing primer:meta block removed. Safe to call on
 * partial streams: if the opening fence has arrived but the block is incomplete,
 * everything from the fence onward is stripped from display.
 */
export function getDisplayBody(text: string): string {
  const start = metaOpenIndex(text);
  if (start === -1) return text;
  return text.slice(0, start).replace(/\s+$/, '\n');
}

function normalizeMeta(parsed: unknown): PrimerMeta {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rawGlossary = Array.isArray(obj.glossary) ? obj.glossary : [];
  const glossary: GlossaryEntry[] = rawGlossary
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object' && typeof (g as Record<string, unknown>).term === 'string')
    .map((g) => ({
      term: String(g.term).trim(),
      definition: typeof g.definition === 'string' ? g.definition : '',
    }));
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : undefined;
  return { title, glossary };
}

/**
 * Parse the trailing primer:meta block into { title?, glossary[] }. Tolerant of
 * partial streams and minor JSON errors (via jsonrepair). Returns an empty
 * glossary when no block is present or parsing fails.
 */
export function parseMeta(text: string): PrimerMeta {
  const start = metaOpenIndex(text);
  if (start === -1) return { glossary: [] };

  let rest = text.slice(start);
  rest = rest.replace(/^```primer:meta\b[^\n]*\n?/, '');
  const closeIdx = rest.indexOf('```');
  const inner = (closeIdx === -1 ? rest : rest.slice(0, closeIdx)).trim();
  if (!inner) return { glossary: [] };

  for (const candidate of [() => JSON.parse(inner), () => JSON.parse(jsonrepair(inner))]) {
    try {
      return normalizeMeta(candidate());
    } catch {
      // try next strategy
    }
  }
  return { glossary: [] };
}

export function splitPrimerMeta(text: string): { body: string; meta: PrimerMeta } {
  return { body: getDisplayBody(text), meta: parseMeta(text) };
}

/**
 * Case-insensitive lookup helper for the tooltip engine. Keys are normalized to
 * trimmed lowercase.
 */
export function buildGlossaryMap(glossary: GlossaryEntry[] | null | undefined): Map<string, GlossaryEntry> {
  const map = new Map<string, GlossaryEntry>();
  if (!glossary) return map;
  for (const entry of glossary) {
    if (!entry?.term) continue;
    map.set(entry.term.trim().toLowerCase(), entry);
  }
  return map;
}

export function lookupGlossary(map: Map<string, GlossaryEntry>, term: string): GlossaryEntry | undefined {
  return map.get(term.trim().toLowerCase());
}
