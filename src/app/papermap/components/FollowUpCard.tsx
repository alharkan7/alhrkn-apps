'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FollowUpCardProps {
  parentId: string;
  onSave: (parentId: string, question: string) => Promise<string>;
  onCancel: () => void;
  loading: boolean;
}

const QUICK_SUGGESTIONS = ['Give an example', 'Add more details'];

const FollowUpCard: React.FC<FollowUpCardProps> = ({
  parentId,
  onSave,
  onCancel,
  loading
}) => {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Radix focuses the first focusable element on open, but the built-in close
  // button can win that race, so explicitly focus the input shortly after mount.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const handleSave = () => {
    if (question.trim() && !loading) {
      onSave(parentId, question);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && question.trim() && !loading) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    if (!loading) onSave(parentId, suggestion);
  };

  const canAsk = question.trim().length > 0 && !loading;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-[400px] gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">Ask a Question</DialogTitle>
          <DialogDescription>The answer is added as a connected node.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading}
                onClick={() => handleSuggestion(suggestion)}
                className="rounded-full border border-black/[0.08] bg-white/60 px-2.5 py-1 text-xs text-black/70 transition-colors hover:bg-black/[0.05] hover:text-black disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              disabled={!canAsk}
              onClick={handleSave}
              className="min-w-[84px]"
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Processing
                </>
              ) : (
                'Ask'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpCard;
