'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, GraduationCap, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const EXAMPLES = [
  'Entropy and the Second Law of Thermodynamics',
  'How transformers work (attention in deep learning)',
  'The causes of World War I',
  'Photosynthesis',
  'Compound interest and the exponential function',
];

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
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What do you want to learn?</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(topic);
        }}
        className="w-full space-y-3"
      >
        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Entropy and the Second Law of Thermodynamics"
          className="min-h-[120px] resize-y rounded-2xl border-border/60 bg-background/60 text-base shadow-sm backdrop-blur-md"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit(topic);
            }
          }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={() => setShowOptions((visible) => !visible)}
            aria-expanded={showOptions}
          >
            More options
            {showOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {showOptions && (
          <div className="grid gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Audience (optional)</label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. a curious first-year physics student"
                className="rounded-xl bg-background/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Language (optional)</label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English"
                className="rounded-xl bg-background/60"
              />
            </div>
          </div>
        )}
        <Button
          type="submit"
          disabled={!topic.trim() || submitting}
          className="w-full rounded-2xl"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing lesson...
            </>
          ) : (
            <>
              <Lightbulb className="mr-2 h-4 w-4" />
              Prepare Lesson
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 w-full">
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground">Try one</p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={submitting}
              onClick={() => setTopic(ex)}
              className="rounded-full border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
