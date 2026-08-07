// Display-time title casing for lesson titles. Topics entered by the user or
// derived from a highlighted passage are often lower- or sentence-case; this
// normalises them so breadcrumbs, the sidebar, and the learning map read
// consistently. It is idempotent and preserves acronyms/camelCase in the rest
// of each word (e.g. "DNA replication" stays "DNA Replication").

const MINOR_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'of', 'in', 'on', 'at',
  'to', 'from', 'by', 'with', 'as', 'is', 'are', 'be', 'it', 'this', 'that',
]);

export function toTitleCase(text: string | null | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  return words
    .map((word, index) => {
      if (index > 0 && MINOR_WORDS.has(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
