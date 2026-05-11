'use client';

import { Heart, ArrowLeft, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPracticeMode: () => void;
  onQuit: () => void;
  /** ISO timestamp when 1 heart refills next */
  nextRefillAt?: string | Date | null;
};

export function OutOfHeartsModal({ open, onOpenChange, onPracticeMode, onQuit, nextRefillAt }: Props) {
  const refillIn = nextRefillAt ? formatDelta(new Date(nextRefillAt)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-red-500/15">
            <Heart className="size-7 text-red-400" fill="currentColor" />
          </div>
          <DialogTitle className="text-center text-2xl">Out of hearts!</DialogTitle>
          <DialogDescription className="text-center">
            Hearts refill 1 every 4 hours. You can keep practicing — without earning XP.
          </DialogDescription>
        </DialogHeader>

        {refillIn && (
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm">
            <Clock className="size-4 text-muted-foreground" />
            <span className="tabular-nums">Next heart in {refillIn}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onPracticeMode} variant="outline" className="w-full">
            Continue in practice mode (no XP)
          </Button>
          <Button onClick={onQuit} variant="ghost" className="w-full">
            <ArrowLeft className="size-4" />
            Back to map
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDelta(date: Date): string {
  const diff = Math.max(0, date.getTime() - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
