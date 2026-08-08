// remark plugin: appends a citation marker (e.g. "[1]" / "[1,2]") at the END of a
// cited passage, linking to its References entry.
//
// A passage can span inline [[concept]] links, bold/italic, etc., which split it
// across mdast text nodes. So we first flatten each text block's visible content
// (INCLUDING link text, EXCLUDING code) into one whitespace-normalized string to
// FIND the right occurrence and which text node the passage ends in. But we only
// ever INSERT into a block's direct text-node children, using the same safe
// visit('text') + splice + SKIP pattern as remark-autolink-terms (which never
// touches nested link/strong interiors). Passages that end inside a link/bold
// get no marker (rare); passages ending in plain text, even with links in the
// middle, do.
//
// Occurrence counting is GLOBAL across blocks (document order) to match
// computePassageOccurrence, which counts over the whole flattened body.

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Text, Link, Parent } from 'mdast';
import type { CitationTarget } from './citation-merge';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INLINE_CONTAINER = new Set(['link', 'strong', 'emphasis', 'delete', 'span']);

function collectText(parent: any, out: any[]) {
  for (const child of parent.children ?? []) {
    if (!child) continue;
    if (child.type === 'text') {
      out.push(child);
    } else if (INLINE_CONTAINER.has(child.type)) {
      collectText(child, out);
    }
  }
}

interface Flat {
  text: string;
  /** chars[i] is the original mdast text node + offset of the i-th normalized char. */
  chars: { node: Text; off: number }[];
}

function flattenBlock(block: any): Flat | null {
  const textNodes: Text[] = [];
  collectText(block, textNodes);
  if (textNodes.length === 0) return null;

  let text = '';
  const chars: { node: Text; off: number }[] = [];
  let prevWs = true; // trim leading whitespace from the block's run
  for (const node of textNodes) {
    const value: string = node.value ?? '';
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      const isWs = /\s/.test(ch);
      if (isWs) {
        if (!prevWs) {
          text += ' ';
          chars.push({ node, off: i });
          prevWs = true;
        }
      } else {
        text += ch;
        chars.push({ node, off: i });
        prevWs = false;
      }
    }
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    chars.pop();
  }
  return { text, chars };
}

export const remarkCitationMarkers = (targets: CitationTarget[]) => (tree: Root) => {
  const byKey = new Map<string, { occurrence: number; label: string; href: string }>();
  const passages: string[] = [];
  for (const t of targets) {
    const p = t.selection.replace(/\s+/g, ' ').trim();
    if (p.length < 3 || t.refs.length === 0) continue;
    const key = p.toLowerCase();
    if (byKey.has(key)) continue; // one marker per distinct passage
    const nums = t.refs.map((r) => r.num);
    byKey.set(key, { occurrence: t.occurrence, label: `[${nums.join(',')}]`, href: `#${t.refs[0].anchorId}` });
    passages.push(p);
  }
  if (byKey.size === 0) return;

  passages.sort((a, b) => b.length - a.length); // longest first so substrings don't shadow
  const re = new RegExp(passages.map(escapeRegExp).join('|'), 'gi');

  // Phase 1 — find, per block, which direct-child text node each marker ends in.
  // insertionsByNode maps a text node -> offsets (in its original value) to split at.
  const insertionsByNode = new Map<Text, { off: number; label: string; href: string }[]>();

  const blocks: Parent[] = [];
  visit(tree, (node: any) => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') blocks.push(node as Parent);
  });

  const seen = new Map<string, number>(); // global occurrence counter, document order
  for (const block of blocks) {
    const flat = flattenBlock(block);
    if (!flat) continue;
    re.lastIndex = 0;
    if (!re.test(flat.text)) continue;
    re.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = re.exec(flat.text)) !== null) {
      const key = m[0].replace(/\s+/g, ' ').toLowerCase();
      const target = byKey.get(key);
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      if (!(target && count === target.occurrence)) continue;

      const endNorm = m.index + m[0].length;
      const pos = flat.chars[Math.min(endNorm, flat.chars.length) - 1];
      if (!pos) continue;
      // Only mark when the passage ends in a text node that is a DIRECT child of
      // this block. Ending inside a link/strong/emphasis is skipped (nested splice
      // would be unsafe and the marker would often be swallowed by ConceptLink).
      if (!block.children.includes(pos.node)) continue;
      const arr = insertionsByNode.get(pos.node) ?? [];
      arr.push({ off: pos.off + 1, label: target.label, href: target.href });
      insertionsByNode.set(pos.node, arr);
    }
  }

  if (insertionsByNode.size === 0) return;

  // Phase 2 — apply via the same safe pattern as remark-autolink-terms: replace a
  // text node with [text, link, text, ...] in its parent, then SKIP past the new
  // nodes. Skips code/link interiors defensively.
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index == null) return;
    if (parent.type === 'inlineCode' || parent.type === 'code' || parent.type === 'link') return;

    const list = insertionsByNode.get(node);
    if (!list || list.length === 0) return;
    list.sort((a, b) => a.off - b.off);

    const value = node.value;
    const newChildren: Array<Text | Link> = [];
    let cursor = 0;
    for (const ins of list) {
      if (ins.off > cursor) newChildren.push({ type: 'text', value: value.slice(cursor, ins.off) });
      newChildren.push({ type: 'link', url: ins.href, children: [{ type: 'text', value: ins.label }] });
      cursor = ins.off;
    }
    if (cursor < value.length) newChildren.push({ type: 'text', value: value.slice(cursor) });

    parent.children.splice(index, 1, ...newChildren);
    return [SKIP, index + newChildren.length] as [typeof SKIP, number];
  });
};

export default remarkCitationMarkers;
