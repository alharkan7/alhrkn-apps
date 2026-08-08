// Shared academic literature search across OpenAlex, Crossref, and Semantic
// Scholar. Ported from Beeblio's /api/beeblio/search and Outliner's
// /api/outliner/cite, cleaned up for reuse. All three APIs are free; OpenAlex
// and Crossref ask for a mailto for the polite pool (OPENALEX_EMAIL).
//
// Relevance over fame: we let each database rank by its native relevance score
// (no citation-count sort) and merge results round-robin so the verifier sees
// topically-matched candidates from every source, not just heavily-cited ones.

import { generateText } from 'ai';
import { getModel } from '@/lib/ai';
import { jsonrepair } from 'jsonrepair';
import type { PrimerReference } from '@/app/primer/types';

export interface AcademicPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue?: string;
  citationCount?: number;
  abstract?: string;
  doi?: string;
  url?: string;
  openAccessPdf?: string;
  database: 'OpenAlex' | 'Crossref' | 'Semantic Scholar';
}

/** A search query tailored per database (each ranks/queries differently). */
export interface AcademicQueries {
  openalex: string;
  crossref: string;
  s2: string;
}

const OPENALEX_API = 'https://api.openalex.org';
const USER_AGENT = process.env.OPENALEX_EMAIL
  ? `alhrkn-primer/1.0 (mailto:${process.env.OPENALEX_EMAIL})`
  : 'alhrkn-primer/1.0';

function invertAbstract(invertedIndex: Record<string, number[]> | undefined | null): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

function truncate(text: string | undefined | null, max = 600): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Light retry with exponential backoff for transient/429 failures.
async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
    }
  }
  return null;
}

// No `sort` here: with `search`, OpenAlex ranks by relevance by default, which
// returns topically-matched works instead of the most-cited ones.
export async function searchOpenAlex(query: string, perPage = 6): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      'per-page': String(perPage),
      select: 'id,title,publication_year,authorships,primary_location,cited_by_count,doi,abstract_inverted_index',
    });
    if (process.env.OPENALEX_EMAIL) params.set('mailto', process.env.OPENALEX_EMAIL);
    const res = await fetchWithRetry(`${OPENALEX_API}/works?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((w: any): AcademicPaper => ({
      id: `openalex-${String(w.id || '').replace('https://openalex.org/', '')}`,
      title: w.title || 'Untitled',
      authors: (w.authorships || []).slice(0, 6).map((a: any) => a?.author?.display_name).filter(Boolean),
      year: w.publication_year ?? null,
      venue: w.primary_location?.source?.display_name || undefined,
      citationCount: w.cited_by_count ?? 0,
      abstract: truncate(invertAbstract(w.abstract_inverted_index)) || undefined,
      doi: w.doi || undefined,
      url: w.doi || w.id || undefined,
      database: 'OpenAlex',
    }));
  } catch {
    return [];
  }
}

// No `sort`: Crossref ranks by relevance by default with the `query` parameter.
export async function searchCrossref(query: string, perPage = 6): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(perPage),
      select: 'DOI,title,author,issued,is-referenced-by-count,container-title,abstract,URL',
    });
    if (process.env.OPENALEX_EMAIL) params.set('mailto', process.env.OPENALEX_EMAIL);
    const res = await fetchWithRetry(`https://api.crossref.org/works?${params}`);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.message?.items || []).map((w: any): AcademicPaper => ({
      id: `crossref-${w.DOI || Math.random().toString(36).slice(2)}`,
      title: w.title?.[0] || 'Untitled',
      authors: (w.author || []).slice(0, 6).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
      year: w.issued?.['date-parts']?.[0]?.[0] ?? null,
      venue: w['container-title']?.[0] || undefined,
      citationCount: w['is-referenced-by-count'] ?? 0,
      abstract: w.abstract ? truncate(w.abstract.replace(/<[^>]+>/g, '')) : undefined,
      doi: w.DOI || undefined,
      url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : undefined),
      database: 'Crossref',
    }));
  } catch {
    return [];
  }
}

// Semantic Scholar ranks by relevance by default. We also pull `tldr` (a
// one-line model summary) and fold it into the abstract for the verifier.
export async function searchSemanticScholar(query: string, perPage = 6): Promise<AcademicPaper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,citationCount,venue,abstract,tldr,externalIds,url&limit=${perPage}`;
    const headers: Record<string, string> = {};
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const res = await fetchWithRetry(url, { headers });
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((w: any): AcademicPaper => {
      const tldr = typeof w.tldr?.text === 'string' ? w.tldr.text : '';
      const abstract = truncate([tldr, w.abstract].filter(Boolean).join(' ')) || undefined;
      return {
        id: `s2-${w.paperId}`,
        title: w.title || 'Untitled',
        authors: (w.authors || []).slice(0, 6).map((a: any) => a?.name).filter(Boolean),
        year: w.year ?? null,
        venue: w.venue || undefined,
        citationCount: w.citationCount ?? 0,
        abstract,
        doi: w.externalIds?.DOI || undefined,
        url: w.url || (w.externalIds?.DOI ? `https://doi.org/${w.externalIds.DOI}` : undefined),
        database: 'Semantic Scholar',
      };
    });
  } catch {
    return [];
  }
}

export interface SearchOptions {
  perPage?: number;
  databases?: { openalex?: boolean; crossref?: boolean; semanticScholar?: boolean };
}

function dedupeKey(p: AcademicPaper): string {
  return (p.doi || p.url || p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Run all enabled databases in parallel (each in its own relevance order) and
 * merge ROUND-ROBIN so the top-ranked result from every source surfaces before
 * any source's second result. Dedupe by DOI/URL/title. The order is preserved
 * (no citation re-sort) so callers get a relevance-balanced candidate list.
 */
export async function searchAcademicPapers(queries: AcademicQueries, opts: SearchOptions = {}): Promise<AcademicPaper[]> {
  const perPage = opts.perPage ?? 6;
  const db = opts.databases ?? {};
  const tasks: Promise<AcademicPaper[]>[] = [];
  if (db.openalex !== false) tasks.push(searchOpenAlex(queries.openalex, perPage));
  if (db.crossref !== false) tasks.push(searchCrossref(queries.crossref, perPage));
  if (db.semanticScholar !== false) tasks.push(searchSemanticScholar(queries.s2, perPage));
  const perDb = await Promise.all(tasks);

  const maxLen = perDb.reduce((m, g) => Math.max(m, g.length), 0);
  const ordered: AcademicPaper[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const group of perDb) {
      if (group[i]) ordered.push(group[i]);
    }
  }

  const seen = new Set<string>();
  const out: AcademicPaper[] = [];
  for (const p of ordered) {
    const key = dedupeKey(p);
    if (key.length < 5 || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'would',
  'could', 'should', 'also', 'such', 'then', 'than', 'these', 'those', 'when', 'where',
  'what', 'which', 'while', 'their', 'there', 'about', 'into', 'over', 'after', 'between',
]);

function fallbackQueries(text: string): AcademicQueries {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w)).slice(0, 5);
  const q = (words.length ? words : ['research']).join(' ');
  return { openalex: q, crossref: q, s2: q };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Ask the model for THREE database-tailored queries that capture the passage's
 * core claim as a canonical technical phrase (not loose keywords). Falls back to
 * a heuristic query on any failure.
 */
export async function extractSearchKeywords(text: string): Promise<AcademicQueries> {
  const fallback = fallbackQueries(text);
  try {
    const { text: raw } = await generateText({
      model: getModel(process.env.PRIMER_MODEL || 'google/gemini-2.5-flash'),
      system: [
        'You are an expert academic librarian. Given a passage, produce three search queries that capture its CORE CLAIM as a precise technical phrase (the kind of phrase a relevant paper title would contain), not loose keywords.',
        'Return ONLY JSON: {"openalexQuery": string, "crossrefQuery": string, "s2Query": string}.',
        '- openalexQuery: a boolean query using AND between the key concepts (OpenAlex handles boolean well).',
        '- crossrefQuery: flat space-separated keywords, no boolean operators (Crossref fails on complex booleans).',
        '- s2Query: a short natural phrase or the canonical name of the concept (Semantic Scholar matches phrases well).',
      ].join('\n'),
      prompt: `Passage from a lesson:\n"""\n${text.slice(0, 700)}\n"""\nIdentify the central claim/topic and produce the three tailored queries.`,
      maxOutputTokens: 220,
    });
    const parsed = JSON.parse(jsonrepair(raw)) as Record<string, unknown>;
    const openalex = asString(parsed.openalexQuery) || fallback.openalex;
    const crossref = asString(parsed.crossrefQuery) || fallback.crossref;
    const s2 = asString(parsed.s2Query) || fallback.s2;
    if (!openalex && !crossref && !s2) return fallback;
    return { openalex, crossref, s2 };
  } catch {
    return fallback;
  }
}

/** Strip an AcademicPaper down to the persisted PrimerReference shape. */
export function toPrimerReference(p: AcademicPaper): PrimerReference {
  return {
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    doi: p.doi,
    url: p.url,
    citationCount: p.citationCount,
  };
}
