'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Languages, Loader2, Settings, User } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AppsFooter from '@/components/apps-footer';

export function TopicInputForm() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [language, setLanguage] = useState('');
  const [length, setLength] = useState('moderate');
  const [tone, setTone] = useState('general');
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
            length,
            tone,
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
    <div className="relative m-0 flex min-h-screen flex-col overflow-hidden bg-[#f7f7f5] px-4 pb-20 pt-14 font-sans text-[#191918] dark:bg-[#10100f] dark:text-[#f2f2ef] sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.98),rgba(247,247,245,0.72)_44%,rgba(238,239,235,0.82)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(37,37,34,0.72),rgba(16,16,15,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(rgba(25,25,24,0.18)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] dark:opacity-[0.13] dark:[background-image:radial-gradient(rgba(255,255,255,0.35)_0.7px,transparent_0.7px)]" />
        <motion.div
          className="absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 rounded-full bg-violet-400/[0.055] blur-3xl dark:bg-violet-500/[0.065]"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={prefersReducedMotion ? undefined : { duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.section
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
        className="relative z-10 mx-auto my-auto w-full max-w-5xl py-8"
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-6 max-w-3xl text-center sm:mb-7"
        >
          <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.2] tracking-[-0.05em] sm:text-5xl sm:leading-[1]">
            Build Interactive Lesson
          </h1>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 18, scale: 0.985 }, visible: { opacity: 1, y: 0, scale: 1 } }}
          transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-2xl"
        >
          <div className="absolute -inset-px rounded-[25px] bg-gradient-to-b from-black/[0.09] to-black/[0.03] dark:from-white/[0.13] dark:to-white/[0.04]" />
          <div className="absolute inset-x-8 -bottom-5 h-14 rounded-full bg-black/[0.08] blur-2xl dark:bg-black/40" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(topic);
            }}
            className="relative flex w-full flex-col rounded-[24px] bg-white p-3 shadow-[0_14px_44px_rgba(25,25,24,0.09),0_2px_8px_rgba(25,25,24,0.04)] transition-shadow duration-300 focus-within:shadow-[0_18px_54px_rgba(25,25,24,0.13),0_0_0_3px_rgba(124,58,237,0.08)] dark:bg-[#1b1b19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)] dark:focus-within:shadow-[0_22px_60px_rgba(0,0,0,0.45),0_0_0_3px_rgba(167,139,250,0.1)] sm:p-4"
          >
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic you want to understand…"
              className="min-h-[112px] resize-none rounded-none border-0 bg-transparent px-2 py-3 text-[17px] leading-7 text-[#191918] shadow-none placeholder:text-black/27 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f2f2ef] dark:placeholder:text-white/25 sm:px-3 sm:text-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit(topic);
                }
              }}
            />

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                showOptions ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    'grid gap-2 px-1 pb-3 pt-1 transition-[opacity,transform] duration-300 ease-out sm:grid-cols-3',
                    showOptions ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
                  )}
                >
                  <div className="relative min-w-0 flex-1">
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-black/[0.025] text-sm shadow-none focus:ring-0 dark:border-white/[0.08] dark:bg-white/[0.035]">
                        <SelectValue placeholder="Tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">📝 General</SelectItem>
                        <SelectItem value="academic">🔬 Academic / Formal</SelectItem>
                        <SelectItem value="casual">☕️ Casual / Friendly</SelectItem>
                        <SelectItem value="eli5">🧸 Explain Like I'm 5</SelectItem>
                        <SelectItem value="gen_alpha">💀 Gen Alpha Slang</SelectItem>
                        <SelectItem value="pirate">🏴‍☠️ Pirate</SelectItem>
                        <SelectItem value="shakespeare">🎭 Shakespearean</SelectItem>
                        <SelectItem value="sarcastic">😒 Sarcastic & Snarky</SelectItem>
                        <SelectItem value="hype_bro">💪 Hype Bro</SelectItem>
                        <SelectItem value="noir">🕵🏻‍♂️ Noir Detective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <OptionInput icon={User} value={audience} onChange={setAudience} placeholder="Audience, e.g. curious student" />
                  <OptionInput icon={Languages} value={language} onChange={setLanguage} placeholder="Language, e.g. English" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-black/[0.055] px-1 pt-3 dark:border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-9 rounded-xl border border-black/[0.065] bg-black/[0.025] px-3 text-xs font-medium text-black/50 shadow-none hover:bg-black/[0.055] hover:text-black dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/48 dark:hover:bg-white/[0.07] dark:hover:text-white',
                    showOptions && 'bg-black/[0.07] text-black dark:bg-white/[0.1] dark:text-white',
                  )}
                  onClick={() => setShowOptions((visible) => !visible)}
                  aria-expanded={showOptions}
                >
                  <Settings className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="h-10 w-[130px] rounded-xl border-black/[0.07] bg-black/[0.025] shadow-none focus:ring-0 dark:border-white/[0.08] dark:bg-white/[0.035]">
                    <SelectValue placeholder="Length" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  disabled={!topic.trim() || submitting}
                  className="group h-10 shrink-0 rounded-xl bg-[#191918] px-4 font-semibold text-white shadow-[0_2px_8px_rgba(25,25,24,0.16)] transition-all hover:-translate-y-px hover:bg-black hover:shadow-[0_5px_14px_rgba(25,25,24,0.2)] disabled:translate-y-0 disabled:opacity-30 dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Building…
                    </>
                  ) : (
                    <>
                      Build
                      <ArrowUp className="ml-1 size-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.25} />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.section>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.045] bg-[#f7f7f5]/70 py-1 text-center text-xs text-black/45 backdrop-blur-lg dark:border-white/[0.06] dark:bg-[#10100f]/70 dark:text-white/40">
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
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35 dark:text-white/35" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-black/[0.07] bg-black/[0.025] pl-9 text-sm shadow-none placeholder:text-black/30 focus-visible:border-black/15 focus-visible:ring-0 dark:border-white/[0.08] dark:bg-white/[0.035] dark:placeholder:text-white/28 dark:focus-visible:border-white/15"
      />
    </div>
  );
}
