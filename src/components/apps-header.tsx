'use client';

import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react'
import { AppsGrid } from '@/components/ui/apps-grid';
import { cn } from '@/lib/utils';

interface AppsHeaderProps {
  title?: React.ReactNode;
  leftButton?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function AppsHeader({ title, leftButton, centerContent, rightContent, className }: AppsHeaderProps) {

  return (
    <header className={cn('sticky top-0 bg-transparent py-1 px-2 md:px-4', className)}>
      <div className="relative flex items-center max-w-6xl mx-auto min-h-[48px]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {leftButton && (
            <div className="shrink-0">
              {leftButton}
            </div>
          )}
          {title && (
            <div className="text-sm font-semibold tracking-[-0.01em] min-w-0">
              {title}
            </div>
          )}
        </div>
        {centerContent && (
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1.5 lg:flex">
            {centerContent}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {rightContent}
          <AppsGrid
            trigger={
              <Button
                variant="default"
                size="sm"
                aria-label="Browse apps"
              >
                <LayoutGrid size={14} /> Apps
              </Button>
            }
            useHardReload={false}
          />
        </div>
      </div>
    </header>
  );
}
