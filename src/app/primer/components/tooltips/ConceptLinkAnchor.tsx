'use client';

import React from 'react';
import { ConceptLink } from './ConceptLink';

const CONCEPT_PREFIX = '#primer-concept-';

/**
 * react-markdown `a` override. Concept links (href "#primer-concept-<term>")
 * become interactive <ConceptLink>s; everything else is a normal external link.
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
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
