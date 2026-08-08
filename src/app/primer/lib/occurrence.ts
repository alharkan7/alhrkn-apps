// Client-only helpers that pin a user's text selection to a stable occurrence
// index, so the exact phrase they explained can be re-underlined on reload.
//
// The index counts whole-word, case-insensitive matches of the term inside the
// lesson body, skipping text inside <code> and <a> (which mirrors the mdast
// auto-link plugin's skip rules). The confirm-time count and the link-time count
// use the same regex over the same text order, so the Nth match is the same
// phrase instance in both places.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the 0-based occurrence index of `term` that the current selection
 * starts on, or null when the selection is not aligned to a whole-word match
 * (e.g. it begins inside a code block or link, or a partial word).
 */
export function computeSelectionOccurrence(root: HTMLElement, term: string): number | null {
  const trimmed = term.trim();
  if (!trimmed) return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);

  // Gather linkable text nodes (not under <code> or <a>) with their base offset
  // in the concatenated text.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code, a')) return NodeFilter.FILTER_REJECT;
      return parent.closest('.primer-markdown') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const segments: { node: Text; base: number }[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    segments.push({ node, base: text.length });
    text += node.nodeValue ?? '';
  }

  // Resolve where the selection starts within the concatenated text.
  const startContainer = range.startContainer;
  const startSegment =
    startContainer.nodeType === Node.TEXT_NODE
      ? segments.find((s) => s.node === startContainer)
      : null;
  if (!startSegment) return null;
  const selectionStart = startSegment.base + range.startOffset;

  // Count whole-word matches strictly before the selection; the match that begins
  // exactly at the selection start is the occurrence the reader selected.
  const re = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi');
  let occurrence = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index < selectionStart) {
      occurrence++;
    } else if (m.index === selectionStart) {
      return occurrence;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Citation variant of occurrence pinning. Unlike computeSelectionOccurrence:
 *  - includes text inside <a> (concept links), excluding only <code>, so a
 *    passage spanning inline links still matches;
 *  - normalizes whitespace in both the body and the passage, then does a literal
 *    substring match (no \b), so passages with punctuation at the edges match;
 *  - resolves the occurrence by OVERLAP of the selection range with the match
 *    range, which tolerates leading/trailing whitespace in the selection.
 *
 * The count is over the whole flattened body, so the remark plugin must count
 * occurrences globally across blocks in document order to stay consistent.
 */
export function computePassageOccurrence(root: HTMLElement, passage: string): number | null {
  const normPassage = passage.replace(/\s+/g, ' ').trim();
  if (!normPassage) return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code')) return NodeFilter.FILTER_REJECT;
      return parent.closest('.primer-markdown') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const segments: { node: Text; base: number }[] = [];
  let raw = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    segments.push({ node, base: raw.length });
    raw += node.nodeValue ?? '';
  }

  const segOf = (container: Node) =>
    container.nodeType === Node.TEXT_NODE ? segments.find((s) => s.node === container) : undefined;
  const startSeg = segOf(range.startContainer);
  const endSeg = segOf(range.endContainer);
  if (!startSeg || !endSeg) return null;
  const startRaw = Math.min(startSeg.base + range.startOffset, raw.length);
  const endRaw = Math.min(endSeg.base + range.endOffset, raw.length);

  // Build a whitespace-normalized copy of the body with a raw->normalized index
  // map so we can translate the selection range into normalized coordinates.
  let norm = '';
  const rawToNorm: number[] = new Array(raw.length + 1);
  rawToNorm[0] = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const isWs = /\s/.test(ch);
    const prevWs = norm.length > 0 && /\s/.test(norm[norm.length - 1]);
    if (isWs && prevWs) {
      rawToNorm[i + 1] = norm.length;
    } else {
      norm += isWs ? ' ' : ch;
      rawToNorm[i + 1] = norm.length;
    }
  }
  const normStart = rawToNorm[startRaw] ?? norm.length;
  const normEnd = rawToNorm[endRaw] ?? norm.length;

  const re = new RegExp(escapeRegExp(normPassage), 'gi');
  let occurrence = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const matchEnd = m.index + normPassage.length;
    if (m.index < normEnd && matchEnd > normStart) {
      return occurrence;
    }
    if (m.index >= normEnd) return null;
    occurrence++;
  }
  return null;
}
