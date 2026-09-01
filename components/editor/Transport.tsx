"use client";

import { Maximize2, Play, SkipBack, SkipForward } from "lucide-react";

type Props = {
  elapsed: string;
  total: string;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function Transport({ elapsed, total, onPlay, onPrev, onNext }: Props) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-line bg-surface px-4">
      <div className="flex flex-1 items-center gap-1">
        <span className="font-mono text-xs text-muted tabular-nums">
          {elapsed}
        </span>
        <span className="font-mono text-xs text-faint"> / {total}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous scene"
          onClick={onPrev}
          className="grid size-8 place-items-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <SkipBack size={15} strokeWidth={1.8} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Play from start of scene"
          onClick={onPlay}
          className="grid size-9 place-items-center rounded-full bg-ink text-surface transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Play size={15} strokeWidth={2} fill="currentColor" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next scene"
          onClick={onNext}
          className="grid size-8 place-items-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <SkipForward size={15} strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 justify-end">
        <button
          type="button"
          aria-label="Fit to screen"
          className="grid size-8 place-items-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <Maximize2 size={15} strokeWidth={1.7} aria-hidden />
        </button>
      </div>
    </div>
  );
}
