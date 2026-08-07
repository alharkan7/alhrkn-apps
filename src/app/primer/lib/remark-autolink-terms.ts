// remark plugin: underlines the EXACT occurrence of a phrase that a reader
// previously explained (stored in primer_explanations with an occurrence index).
// Unlike a glossary autolinker, this converts only one specified occurrence per
// term (the one the user selected), not every match. Skips code spans, fenced
// code blocks, and text already inside a link.

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Text, Link, Parent } from 'mdast';

const MIN_TERM_LENGTH = 3;

export interface AutoLinkTarget {
  term: string;
  /** 0-based whole-word match index (in document order, excluding code/links) to underline. */
  occurrence: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const remarkAutoLinkTerms = (targets: AutoLinkTarget[]) => (tree: Root) => {
  // One target occurrence per term (explanations are unique per term/primer).
  const targetByTerm = new Map<string, number>();
  const termsForRegex: string[] = [];
  for (const target of targets) {
    const term = target.term.trim();
    if (term.length < MIN_TERM_LENGTH || !/^\w.*\w$/.test(term)) continue;
    const key = term.toLowerCase();
    if (targetByTerm.has(key)) continue;
    targetByTerm.set(key, target.occurrence);
    termsForRegex.push(term);
  }
  if (targetByTerm.size === 0) return;

  // Longest first so multi-word phrases win over their substrings at one spot.
  termsForRegex.sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(?:${termsForRegex.map(escapeRegExp).join('|')})\\b`, 'gi');
  const seen = new Map<string, number>();

  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index == null) return;
    if (parent.type === 'inlineCode' || parent.type === 'code' || parent.type === 'link') return;

    const value = node.value;
    re.lastIndex = 0;
    if (!re.test(value)) return;
    re.lastIndex = 0;

    const newChildren: Array<Text | Link> = [];
    let last = 0;
    let changed = false;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      const matched = m[0];
      const key = matched.toLowerCase();
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      const isTarget = count === targetByTerm.get(key);

      if (m.index > last) newChildren.push({ type: 'text', value: value.slice(last, m.index) });
      if (isTarget) {
        newChildren.push({
          type: 'link',
          url: '#primer-concept-' + encodeURIComponent(matched),
          children: [{ type: 'text', value: matched }],
        });
        changed = true;
      } else {
        newChildren.push({ type: 'text', value: matched });
      }
      last = m.index + matched.length;
    }
    if (last < value.length) newChildren.push({ type: 'text', value: value.slice(last) });

    // Leave the node untouched when its matches contained no target occurrence;
    // we still tallied them in `seen` so later nodes get the right indices.
    if (!changed) return;
    parent.children.splice(index, 1, ...newChildren);
    return [SKIP, index + newChildren.length] as [typeof SKIP, number];
  });
};

export default remarkAutoLinkTerms;
