// remark plugin: converts inline [[Term]] markers into link nodes that the
// MarkdownRenderer intercepts (href "#primer-concept-<encoded term>") to render
// interactive ConceptLink tooltips. Skips code spans and code blocks.

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Text, Link, Parent } from 'mdast';

const CONCEPT_RE = /\[\[([^\[\]\n]+?)\]\]/g;

export const remarkConcepts = () => (tree: Root) => {
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index == null) return;
    // Never transform text inside code spans or fenced code blocks.
    if (parent.type === 'inlineCode' || parent.type === 'code') return;

    const value = node.value;
    CONCEPT_RE.lastIndex = 0;
    if (!CONCEPT_RE.test(value)) return;
    CONCEPT_RE.lastIndex = 0;

    const newChildren: Array<Text | Link> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = CONCEPT_RE.exec(value)) !== null) {
      const term = m[1].trim();
      if (!term) {
        last = m.index + m[0].length;
        continue;
      }
      if (m.index > last) {
        newChildren.push({ type: 'text', value: value.slice(last, m.index) });
      }
      newChildren.push({
        type: 'link',
        // Use a hash marker rather than a custom protocol. react-markdown
        // sanitizes unknown protocols before components.a receives href.
        url: '#primer-concept-' + encodeURIComponent(term),
        children: [{ type: 'text', value: term }],
      });
      last = m.index + m[0].length;
    }
    if (last < value.length) {
      newChildren.push({ type: 'text', value: value.slice(last) });
    }

    if (newChildren.length === 0) return;
    parent.children.splice(index, 1, ...newChildren);
    return [SKIP, index + newChildren.length] as [typeof SKIP, number];
  });
};

export default remarkConcepts;
