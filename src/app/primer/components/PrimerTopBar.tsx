'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, Menu, Network, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppsHeader } from '@/components/apps-header';

export function PrimerTopBar() {
  const pathname = usePathname();
  const isInputPage = pathname === '/primer';

  return (
    <AppsHeader
      className="z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      leftButton={
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-toggle h-9 w-9"
          onClick={() => window.dispatchEvent(new CustomEvent('togglePrimerHistorySidebar'))}
          title="History"
        >
          <Menu className="h-4 w-4" />
        </Button>
      }
      title={
        <Link href="/primer" className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span>Primer</span>
        </Link>
      }
      rightContent={!isInputPage ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="View learning network"
            aria-label="View learning network"
            onClick={() => window.dispatchEvent(new CustomEvent('openPrimerNetworkMap'))}
          >
            <Network className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/primer">
              <Plus className="mr-1 h-4 w-4" />
              New
            </Link>
          </Button>
        </div>
      ) : null}
    />
  );
}
