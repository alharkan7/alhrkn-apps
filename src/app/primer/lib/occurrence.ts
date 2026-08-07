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
