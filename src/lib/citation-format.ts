// APA-style citation formatting for Primer references. Pure helpers, safe for
// server and client. Adapted from Outliner's CitationTool formatter.

import type { PrimerReference } from '@/app/primer/types';

/** Format one author name as "Last, F." from either "Last, First" or "First Last". */
function formatSingleAuthor(fullName: string): string {
  try {
    if (!fullName) return '';
    let last = '';
    let first = '';
    if (fullName.includes(',')) {
      const [lastPart, firstPart] = fullName.split(',');
      last = (lastPart || '').trim();
      first = (firstPart || '').trim().split(/\s+/)[0] || '';
    } else {
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        last = parts[0];
      } else {
        first = parts[0];
        last = parts[parts.length - 1];
      }
    }
    const initial = first ? `${first[0].toUpperCase()}.` : '';
    return last ? `${last}, ${initial}`.trim() : fullName;
  } catch {
    return fullName;
  }
}

/** "Last, F., Other, G., et al." (max 3 shown, then et al.). */
export function formatAuthors(authors: string[]): string {
  const list = (authors || []).filter(Boolean);
  if (list.length === 0) return 'Unknown authors';
  const limited = list.slice(0, 3).map(formatSingleAuthor);
  const etAl = list.length > 3 ? ['et al.'] : [];
  return [...limited, ...etAl].join(', ');
}

/** Full APA reference string (without the URL). */
export function formatApa(ref: PrimerReference): string {
  const authors = formatAuthors(ref.authors);
  const year = ref.year ?? 'n.d.';
  const title = ref.title || 'Untitled';
  const venue = ref.venue ? `. ${ref.venue}` : '';
  return `${authors} (${year}). ${title}${venue}`;
}

/** Inline key like "(Smith, 2020)" for in-text anchors. */
export function makeCitationKey(ref: PrimerReference): string {
  const first = (ref.authors[0] || 'Unknown').trim();
  const last = first.includes(',') ? first.split(',')[0].trim() : (first.split(/\s+/).pop() || first);
  const year = ref.year ?? 'n.d.';
  return `(${last}, ${year})`;
}
