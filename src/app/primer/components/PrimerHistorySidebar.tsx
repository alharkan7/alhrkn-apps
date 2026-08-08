'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toTitleCase } from '../lib/title-case';

interface TreeNode {
  id: string;
  parentId: string | null;
  title: string | null;
  topic: string;
  status: string;
  createdAt: string;
  childCount: number;
  hasChildren: boolean;
}

interface BranchState {
  items: TreeNode[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

const PAGE_SIZE = 20;

function branchKey(parentId: string | null): string {
  return parentId || 'root';
}

function emptyBranch(): BranchState {
  return { items: [], hasMore: true, loading: false, loaded: false };
}

export function PrimerHistorySidebar() {
  const pathname = usePathname();
  const params = useParams();
  const currentId = params?.id as string | undefined;
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Record<string, BranchState>>({ root: emptyBranch() });

  const fetchBranch = useCallback(async (parentId: string | null, offset = 0, append = false) => {
    const key = branchKey(parentId);
    setBranches((previous) => ({
      ...previous,
      [key]: { ...(previous[key] || emptyBranch()), loading: true },
    }));

    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (parentId) query.set('parentId', parentId);
      const response = await fetch(`/api/primer/tree?${query.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load Primer tree');
      const data = await response.json();
      setBranches((previous) => {
        const existing = previous[key] || emptyBranch();
        return {
          ...previous,
          [key]: {
            items: append ? [...existing.items, ...(data.items || [])] : (data.items || []),
            hasMore: Boolean(data.hasMore),
            loading: false,
            loaded: true,
          },
        };
      });
    } catch (error) {
      console.error('Failed to load Primer tree branch', error);
      setBranches((previous) => ({
        ...previous,
        [key]: { ...(previous[key] || emptyBranch()), loading: false, loaded: true },
      }));
    }
  }, []);

  useEffect(() => {
    fetchBranch(null);
  }, [fetchBranch, pathname]);

  // Bring the active lesson's path into view when possible. Only direct child
  // branches are fetched, so a deep tree never causes an unbounded request.
  useEffect(() => {
    if (!currentId) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/primer/tree?ancestorsFor=${encodeURIComponent(currentId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const ancestors: TreeNode[] = data.ancestors || [];
        if (!active || ancestors.length < 2) return;
        setExpanded(new Set(ancestors.slice(0, -1).map((node) => node.id)));
        for (const ancestor of ancestors.slice(0, -1)) {
          if (!active) return;
          await fetchBranch(ancestor.id);
        }
      } catch (error) {
        console.error('Failed to load active Primer path', error);
      }
    })();
    return () => { active = false; };
  }, [currentId, fetchBranch]);

  useEffect(() => {
    const handleToggle = () => setIsOpen((open) => !open);
    window.addEventListener('togglePrimerHistorySidebar', handleToggle);
    return () => window.removeEventListener('togglePrimerHistorySidebar', handleToggle);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.sidebar-toggle')) return;
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleBranch = async (node: TreeNode) => {
    const isExpanded = expanded.has(node.id);
    if (isExpanded) {
      setExpanded((previous) => {
        const next = new Set(previous);
        next.delete(node.id);
        return next;
      });
      return;
    }

    setExpanded((previous) => new Set(previous).add(node.id));
    const branch = branches[branchKey(node.id)];
    if (!branch?.loaded) await fetchBranch(node.id);
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const childBranch = branches[branchKey(node.id)] || emptyBranch();
    const isExpanded = expanded.has(node.id);
    const title = toTitleCase(node.title || node.topic) || 'Untitled lesson';
    let relativeTime = '';
    try {
      relativeTime = formatDistanceToNow(new Date(node.createdAt), { addSuffix: true });
    } catch {}

    return (
      <React.Fragment key={node.id}>
        <div className="group flex w-full items-start gap-1 rounded-xl py-1 pr-2 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.045]" style={{ paddingLeft: 8 + depth * 16 }}>
          <Link
            href={`/primer/${node.id}`}
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-1.5 py-1.5 text-sm',
              currentId === node.id
                ? 'bg-black/[0.075] font-medium text-black dark:bg-white/[0.1] dark:text-white'
                : 'text-black/52 hover:text-black dark:text-white/52 dark:hover:text-white',
            )}
          >
            <GraduationCap className="mt-0.5 size-4 shrink-0 text-black/35 dark:text-white/35" />
            <span className="min-w-0">
              <span className="block max-w-[230px] truncate leading-tight">{title}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">{relativeTime}{node.childCount > 0 ? ` · ${node.childCount} ${node.childCount === 1 ? 'child' : 'children'}` : ''}</span>
            </span>
          </Link>
          {node.hasChildren && (
            <button
              type="button"
              className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-lg text-black/38 hover:bg-black/[0.06] hover:text-black dark:text-white/38 dark:hover:bg-white/[0.07] dark:hover:text-white"
              onClick={() => toggleBranch(node)}
              aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              {childBranch.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')} />}
            </button>
          )}
        </div>
        {isExpanded && childBranch.items.map((child) => renderNode(child, depth + 1))}
        {isExpanded && childBranch.hasMore && !childBranch.loading && (
          <button
            type="button"
            className="block whitespace-nowrap px-2 py-1 text-xs text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white"
            style={{ marginLeft: 16 + (depth + 1) * 16 }}
            onClick={() => fetchBranch(node.id, childBranch.items.length, true)}
          >
            Load more children
          </button>
        )}
      </React.Fragment>
    );
  };

  const rootBranch = branches.root || emptyBranch();

  return (
    <>
      <div
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-[55] flex h-full w-72 -translate-x-full flex-col border-r border-black/[0.07] bg-[#f7f7f5]/95 shadow-[8px_0_32px_rgba(25,25,24,0.08)] backdrop-blur-xl transition-transform duration-300 dark:border-white/[0.08] dark:bg-[#141413]/95 dark:shadow-[8px_0_36px_rgba(0,0,0,0.32)]',
          isOpen && 'translate-x-0',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.06] px-4 dark:border-white/[0.07]">
          <h2 className="text-sm font-semibold tracking-[-0.01em]">Recent lessons</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="size-8 rounded-lg text-black/45 hover:bg-black/[0.06] dark:text-white/45 dark:hover:bg-white/[0.07]" title="Close">
            <ChevronLeft size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-2 scrollbar-thin">
          <div className="w-full">
            {rootBranch.loading && rootBranch.items.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : rootBranch.items.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No lessons yet. Enter a topic to start learning.</div>
            ) : (
              rootBranch.items.map((node) => renderNode(node, 0))
            )}
            {rootBranch.hasMore && !rootBranch.loading && rootBranch.items.length > 0 && (
              <button type="button" className="px-2 py-2 text-xs text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white" onClick={() => fetchBranch(null, rootBranch.items.length, true)}>
                Load more root lessons
              </button>
            )}
            {rootBranch.loading && rootBranch.items.length > 0 && <div className="flex justify-center p-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
          </div>
        </div>
      </div>
      {isOpen && <div className="fixed inset-0 z-[50] bg-black/18 backdrop-blur-[2px] md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  );
}
