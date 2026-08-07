'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, Loader2, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AppsFooter from '@/components/apps-footer';

export function TopicInputForm() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [language, setLanguage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (topicText: string) => {
    const trimmed = topicText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/primer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmed,
          options: {
            audience: audience.trim() || undefined,
            language: language.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        throw new Error(data?.error || 'Failed to start lesson');
      }
      router.push(`/primer/${data.id}`);
    } catch (e: any) {
      setSubmitting(false);
      toast.error(e?.message || 'Something went wrong');
    }
  };

  return (
    <div className="relative m-0 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden bg-background px-4 pb-16 font-sans text-foreground">
      {/* Ambient background: soft gradient orbs + subtle grid, matching the other apps. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[50%] w-[50%] animate-pulse rounded-full bg-indigo-500/10 mix-blend-screen blur-[120px] dark:bg-indigo-900/20" style={{ animationDuration: '8s' }} />
        <div className="absolute right-[-10%] bottom-[-20%] h-[60%] w-[60%] animate-pulse rounded-full bg-blue-500/10 mix-blend-screen blur-[150px] dark:bg-blue-900/20" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute right-[10%] top-[20%] h-[30%] w-[30%] animate-pulse rounded-full bg-cyan-500/10 mix-blend-screen blur-[100px] dark:bg-cyan-900/10" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
        <div className="w-full space-y-6 py-8 text-center">
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            <span className="animate-gradient-x whitespace-nowrap bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">Primer</span>
          </h1>
          <p className="mx-auto max-w-3xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
            What do you want to learn?
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(topic);
          }}
          className="w-full"
        >
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Einstein's General Relativity"
            className="min-h-[120px] resize-y rounded-2xl border-border/60 bg-background/60 text-base shadow-sm backdrop-blur-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit(topic);
              }
            }}
          />

          {/* Collapsible audience + language row. The grid 0fr -> 1fr trick
              animates height without knowing the content size; the inner block
              adds a fade and a small upward slide. */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              showOptions ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  'flex items-center gap-2 pt-3 transition-[opacity,transform] duration-300 ease-out',
                  showOptions ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
                )}
              >
                <OptionInput icon={User} value={audience} onChange={setAudience} placeholder="e.g. a curious student" />
                <OptionInput icon={Languages} value={language} onChange={setLanguage} placeholder="e.g. English" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', showOptions && 'bg-muted text-foreground')}
              onClick={() => setShowOptions((visible) => !visible)}
              aria-expanded={showOptions}
              aria-label="More options"
              title="More options"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button type="submit" disabled={!topic.trim() || submitting} className="h-9 px-5">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Learning…
                </>
              ) : (
                'Learn'
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/60 px-0 py-1 text-center text-xs text-gray-600 backdrop-blur-md">
        <div className="flex-none">
          <AppsFooter />
        </div>
      </div>
    </div>
  );
}

function OptionInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl bg-background/60 pl-9"
      />
    </div>
  );
}
