'use client';

import React from 'react';
import { ConceptLink } from './ConceptLink';

const CONCEPT_PREFIX = '#primer-concept-';
const CITE_PREFIX = '#cite-ref-';

/**
 * react-markdown `a` override. Concept links (href "#primer-concept-<term>")
 * become interactive <ConceptLink>s; citation markers (href "#cite-ref-<n>")
 * become superscript scroll-links to the References entry; everything else is a
 * normal external link.
 */
export function ConceptLinkAnchor(props: any) {
  const { href, children, node: _node, ...rest } = props;

  if (typeof href === 'string' && href.startsWith(CONCEPT_PREFIX)) {
    let term = href.slice(CONCEPT_PREFIX.length);
    try {
      term = decodeURIComponent(term);
    } catch {
      // keep raw
    }
    return <ConceptLink term={term} />;
  }

  if (typeof href === 'string' && href.startsWith(CITE_PREFIX)) {
    const scrollToRef = (e: React.MouseEvent) => {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('citation-ref--flash');
      window.setTimeout(() => el.classList.remove('citation-ref--flash'), 1600);
    };
    return (
      <sup className="primer-citation-marker">
        <a
          href={href}
          onClick={scrollToRef}
          className="cursor-pointer font-semibold text-primary hover:underline"
          aria-label="Jump to reference"
        >
          {children}
        </a>
      </sup>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
