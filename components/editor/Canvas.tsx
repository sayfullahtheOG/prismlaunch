"use client";

import type { Palette, Scene } from "@/types/prism";
import { FilmFrame } from "./FilmFrame";

type Props = {
  scene: Scene;
  palette: Palette;
  playToken: number;
};

export function Canvas({ scene, palette, playToken }: Props) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-6">
      <div className="relative w-full max-w-[880px]">
        <span className="absolute -top-7 left-0 flex items-center gap-2 rounded-ctl bg-surface px-2 py-1 text-[11px] font-medium text-muted shadow-xs">
          16:9
          <span className="font-mono text-faint">960×540</span>
        </span>

        <div
          className="relative aspect-video w-full overflow-hidden rounded-card shadow-lg"
          style={{ background: palette.background }}
        >
          {/* Ambient wash keyed to the art direction, so the frame reads as a
              lit stage rather than a flat rectangle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120% 90% at 50% 0%, ${palette.accent}14, transparent 60%)`,
            }}
          />
          <FilmFrame scene={scene} palette={palette} playToken={playToken} />
        </div>
      </div>
    </div>
  );
}
