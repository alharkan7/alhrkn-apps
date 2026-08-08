// Pure presentation logic for citations: dedupe references across all cited
// passages, number them for the bibliography, and produce occurrence targets for
// the inline-marker remark plugin. Used both at render (server-seeded citations)
// and for live updates (a freshly saved citation).

import type { PrimerCitation, PrimerReference } from '../types';

export interface CitationMarkerRef {
  num: number;
  anchorId: string;
}

export interface CitationTarget {
  selection: string;
  /** 0-based whole-word occurrence of the passage in the lesson body. */
  occurrence: number;
  refs: CitationMarkerRef[];
}

export interface BibliographyEntry {
  num: number;
  anchorId: string;
  ref: PrimerReference;
}

export interface BuiltCitations {
  bibliography: BibliographyEntry[];
  citationTargets: CitationTarget[];
}

export function dedupeKey(ref: PrimerReference): string {
  return (ref.doi || ref.url || ref.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildCitations(citations: PrimerCitation[]): BuiltCitations {
  // Order by document position so bibliography numbers read top-to-bottom.
  const ordered = [...citations].sort((a, b) => {
    const ao = a.occurrence ?? Number.MAX_SAFE_INTEGER;
    const bo = b.occurrence ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });

  const refMap = new Map<string, BibliographyEntry>();
  const bibliography: BibliographyEntry[] = [];
  const citationTargets: CitationTarget[] = [];

  const intern = (ref: PrimerReference): BibliographyEntry => {
    const key = dedupeKey(ref);
    if (key.length > 0) {
      const existing = refMap.get(key);
      if (existing) return existing;
    }
    const num = bibliography.length + 1;
    const entry: BibliographyEntry = { num, anchorId: `cite-ref-${num}`, ref };
    bibliography.push(entry);
    if (key.length > 0) refMap.set(key, entry);
    return entry;
  };

  for (const c of ordered) {
    const refs = c.references.map(intern);
    if (c.occurrence != null && refs.length > 0) {
      citationTargets.push({
        selection: c.selection,
        occurrence: c.occurrence,
        refs: refs.map((r) => ({ num: r.num, anchorId: r.anchorId })),
      });
    }
  }

  return { bibliography, citationTargets };
}
