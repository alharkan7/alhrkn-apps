import Link from 'next/link';
import { ChevronRight, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toTitleCase } from '../lib/title-case';

export interface PrimerBreadcrumbItem {
  id: string;
  title: string;
  isCurrent?: boolean;
}

export function PrimerBreadcrumbs({ items }: { items: PrimerBreadcrumbItem[] }) {
  return (
    <nav aria-label="Learning path" className="mb-5 flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground">
      <Link href="/primer" className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
        <GraduationCap className="h-3.5 w-3.5" />
        <span>Primer</span>
      </Link>
      {items.map((item) => {
        const title = toTitleCase(item.title);
        return (
          <span key={item.id} className="inline-flex min-w-0 shrink-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {item.isCurrent ? (
              <span className={cn('max-w-64 truncate px-1.5 py-1 font-medium text-foreground')} aria-current="page">
                {title}
              </span>
            ) : (
              <Link href={`/primer/${item.id}`} className="max-w-64 truncate rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
                {title}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
