'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Waypoints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppsHeader } from '@/components/apps-header';
import { PrimerFontButton } from './PrimerFontButton';

export function PrimerTopBar() {
  const pathname = usePathname();
  const isInputPage = pathname === '/primer';

  return (
    <AppsHeader
      className="z-40 border-b border-black/[0.06] bg-[#f7f7f5]/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10100f]/80"
      leftButton={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle size-9 rounded-xl text-black/60 hover:bg-black/[0.06] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
            onClick={() => window.dispatchEvent(new CustomEvent('togglePrimerHistorySidebar'))}
            title="History"
            aria-label="Open lesson history"
          >
            <Menu className="h-4 w-4" />
          </Button>
          {!isInputPage && (
            <>
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href="/primer">
                  <Plus className="mr-1 h-4 w-4" />
                  New
                </Link>
              </Button>
              <PrimerFontButton />
            </>
          )}
        </div>
      }
      title={<span className="text-sm font-semibold tracking-[-0.01em]">Primer</span>}
      rightContent={!isInputPage ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="View learning map"
          aria-label="View learning map"
          onClick={() => window.dispatchEvent(new CustomEvent('openPrimerNetworkMap'))}
        >
          <Waypoints className="h-4 w-4" />
        </Button>
      ) : null}
    />
  );
}
