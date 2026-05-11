'use client';

/**
 * AI Generate Content — button to add more exercises to a lesson via AI.
 * Stub returns sample exercises for now. Prompt template ready for Claude API wiring.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiGenerateExercises } from '@/actions/ai-generate';

type Props = {
  workspaceSlug: string;
  lessonId: string;
  count?: number;
};

export function AiGenerateButton({ workspaceSlug, lessonId, count = 2 }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const res = await aiGenerateExercises({ workspaceSlug, lessonId, count });
      toast.success(`Generated ${res.generated} exercise${res.generated > 1 ? 's' : ''}`, {
        description: 'Reload the lesson to see them. (Stub — wire Claude API in production.)',
      });
      router.refresh();
    } catch (e) {
      toast.error('Generation failed', { description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handle} variant="outline" size="sm" disabled={busy}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-violet-400" />}
      Generate more exercises (AI)
    </Button>
  );
}
