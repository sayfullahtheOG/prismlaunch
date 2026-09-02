"use client";

import { Maximize2, Play, SkipBack, SkipForward } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  elapsed: string;
  total: string;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function Transport({ elapsed, total, onPlay, onPrev, onNext }: Props) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-t border-line-soft bg-surface px-4">
      <span className="tabular flex flex-1 items-baseline gap-1 font-mono text-xs">
        <span className="text-ink">{elapsed}</span>
        <span className="text-subtle">/ {total}</span>
      </span>

      <div className="flex items-center gap-1">
        <IconButton
          label="Previous scene"
          onClick={onPrev}
          icon={<SkipBack size={16} strokeWidth={1.8} aria-hidden />}
        />
        <IconButton
          label="Play from the start of this scene"
          onClick={onPlay}
          tone="raised"
          icon={<Play size={16} strokeWidth={2} fill="currentColor" aria-hidden />}
        />
        <IconButton
          label="Next scene"
          onClick={onNext}
          icon={<SkipForward size={16} strokeWidth={1.8} aria-hidden />}
        />
      </div>

      <div className="flex flex-1 justify-end">
        <IconButton
          label="Fit to screen"
          icon={<Maximize2 size={16} strokeWidth={1.7} aria-hidden />}
        />
      </div>
    </div>
  );
}
