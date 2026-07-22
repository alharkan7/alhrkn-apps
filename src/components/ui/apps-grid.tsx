'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { apps } from '@/config/apps';
import { useRouter } from 'next/navigation';
import { Mail, Home } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { getInitials, getAvatarColor } from '@/lib/utils';

interface AppsGridProps {
  trigger: React.ReactNode;
  useHardReload?: boolean;
}

export function AppsGrid({ trigger, useHardReload = false }: AppsGridProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showTooltips, setShowTooltips] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [user, setUser] = React.useState<User | null>(null);

  // Add Home item to the apps array
  const allApps = React.useMemo(() => [
    {
      name: 'Home',
      icon: Home,
      slug: 'home',
      description: 'Go back to homepage'
    },
    ...apps
  ], []);

  const handleAppClick = (slug: string) => {
    if (slug.startsWith('http')) {
      window.open(slug, '_blank', 'noopener,noreferrer');
      setIsOpen(false);
      return;
    }

    if (slug === 'home') {
      if (useHardReload) {
        window.location.href = '/';
      } else {
        router.push('/', { scroll: false });
      }
      setIsOpen(false);
      return;
    }

    const appUrl = `/${slug}`;
    if (useHardReload) {
      window.location.href = appUrl;
    } else {
      router.push(appUrl, { scroll: false });
    }
    setIsOpen(false);
  };

  React.useEffect(() => {
    if (isOpen) {
      // Reduced delay for better responsiveness
      const timer = setTimeout(() => setShowTooltips(true), 0);
      return () => clearTimeout(timer);
    } else {
      setShowTooltips(false);
    }
  }, [isOpen]);

  // Mark as loaded on mount and fetch user
  React.useEffect(() => {
    setIsLoaded(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
    
    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    // <TooltipProvider>
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-3 bg-background/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl"
        align="end"
        onPointerDownOutside={(e: Event) => {
          if (e.target instanceof Element && e.target.closest('.apps-grid-content')) {
            e.preventDefault();
          }
        }}
        // Add a fade-in animation
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.15s ease-in-out'
        }}
      >
        <div className="apps-grid-content gap-3 grid grid-cols-2 max-h-[310px] pb-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          {allApps.map((app) => {
            const Icon = app.icon;
            return (
              // <Tooltip key={app.slug}>
              //   <TooltipTrigger asChild disabled={!showTooltips}>
              <Button
                key={app.slug}
                variant="ghost"
                className="relative h-[90px] w-full flex flex-col items-center justify-center gap-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300 group"
                onClick={() => handleAppClick(app.slug)}
              >
                <Icon className="size-6 text-muted-foreground group-hover:text-primary transition-colors group-hover:scale-110 duration-300" />
                <div className="w-full flex">
                  <span className="text-xs font-medium line-clamp-2 text-center whitespace-normal break-words w-full">{app.name}</span>
                </div>
              </Button>
              // </TooltipTrigger>
              //   <TooltipContent>
              //     {app.name}
              //   </TooltipContent>
              // </Tooltip>
            );
          })}
        </div>
        <div className="mt-2 pt-3 border-t border-border flex flex-col gap-1">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-start gap-2 text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => {
              e.preventDefault();
              window.open('https://mail.google.com/mail/?view=cm&fs=1&to=alharkan7@gmail.com', '_blank');
              setIsOpen(false);
            }}
          >
            <Mail className='mr-1 ml-2' size={16} />
            Contact / Email
          </Button>
          
          {user && (
            <Button
              variant="ghost"
              className="w-full flex items-center justify-start gap-2 text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors h-auto py-2"
              onClick={() => {
                router.push('/profile');
                setIsOpen(false);
              }}
            >
              <div className="ml-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-[10px] font-medium text-white" 
                    style={{ backgroundColor: getAvatarColor(user.email) }}
                  >
                    {getInitials(user.user_metadata?.full_name, user.email)}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start overflow-hidden ml-1">
                <span className="truncate w-[170px] text-left">{user.user_metadata?.full_name || 'Profile'}</span>
                <span className="text-[10px] opacity-70 truncate w-[170px] text-left">{user.email}</span>
              </div>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
    // </TooltipProvider>
  );
}
