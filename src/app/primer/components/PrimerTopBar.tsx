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
      className="z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      leftButton={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle h-9 w-9"
            onClick={() => window.dispatchEvent(new CustomEvent('togglePrimerHistorySidebar'))}
            title="History"
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
