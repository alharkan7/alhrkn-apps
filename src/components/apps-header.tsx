'use client';

import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react'
import { AppsGrid } from '@/components/ui/apps-grid';
import { cn } from '@/lib/utils';

interface AppsHeaderProps {
  title?: React.ReactNode;
  leftButton?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function AppsHeader({ title, leftButton, rightContent, className }: AppsHeaderProps) {

  return (
    <header className={cn('sticky top-0 bg-transparent py-1 px-2 md:px-4', className)}>
      <div className="relative flex items-center max-w-6xl mx-auto min-h-[48px]">
        <div className="flex items-center gap-3">
          {leftButton && (
            <div>
              {leftButton}
            </div>
          )}
          {title && (
            <div className="text-xl font-semibold">
              {title}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {rightContent}
          <AppsGrid
            trigger={
              <Button
                variant="default"
                className="flex items-center px-3 h-fit"
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
