'use client';

import React from 'react';
import { formatApa } from '@/lib/citation-format';
import type { BibliographyEntry } from '../lib/citation-merge';

/**
 * The References section at the bottom of a lesson. Rendered only when there is
 * at least one cited source. Each entry's id is its anchor so in-text [n] markers
 * and the verdict popover can smooth-scroll to it.
 */
export function PrimerBibliography({ entries }: { entries: BibliographyEntry[] }) {
  if (!entries || entries.length === 0) return null;

  return (
    <section className="primer-bibliography mx-auto max-w-3xl border-t border-border/60 px-4 pb-16 pt-8 sm:px-6">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">References</h2>
      <ol className="flex flex-col gap-3">
        {entries.map((entry) => {
          const link = entry.ref.doi ? `https://doi.org/${entry.ref.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : entry.ref.url;
          return (
            <li
              key={entry.anchorId}
              id={entry.anchorId}
              className="citation-ref scroll-mt-24 rounded-md px-2 py-1 text-sm leading-relaxed text-muted-foreground"
            >
              <span className="mr-1 font-semibold text-foreground">{entry.num}.</span>
              <span className="text-foreground/90">{formatApa(entry.ref)}</span>
              {link ? (
                <>
                  {' '}
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {entry.ref.doi ? 'DOI' : 'Link'}
                  </a>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
