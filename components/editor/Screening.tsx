"use client";

import { Maximize2, Pause, Play, SkipBack } from "lucide-react";
import { useRef } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { seek, setPlaying } from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";
import { timecode } from "@/lib/studio/timing";
import type { ProjectFile } from "@/types/prism";
import { Canvas } from "./Canvas";

/**
 * The animatic, watched.
 *
 * An animatic is judged by watching it against the music, not by reading
 * its layers — the cut either breathes or it does not. So its review is a
 * screening: the film large, a transport underneath, and nothing else. The
 * decision sits in the Process panel beside it, and the layers are one
 * click away in the Editor for anyone who wants to see the seams.
 */
export function Screening({ file }: { file: ProjectFile }) {
  const playhead = useStudioStore((state) => state.playhead);
  const playing = useStudioStore((state) => state.playing);
  const room = useRef<HTMLDivElement>(null);

  function fullscreen() {
    const frame = room.current?.querySelector("[data-film-frame]");
    if (frame instanceof HTMLElement) void frame.requestFullscreen?.();
  }

  return (
    <section aria-label="Animatic screening" className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div ref={room} className="flex min-h-0 flex-1">
        <Canvas file={file} />
      </div>

      <div className="flex h-12 shrink-0 items-center justify-center gap-1 border-t border-line-soft bg-surface px-4">
        <IconButton
          label="Back to start"
          icon={<SkipBack size={15} strokeWidth={1.9} />}
          onClick={() => {
            setPlaying(false);
            seek(0);
          }}
        />
        <IconButton
          label={playing ? "Pause" : "Play"}
          tone="raised"
          icon={playing ? <Pause size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
          onClick={() => setPlaying(!playing)}
        />
        <span className="tabular mx-2 font-mono text-xs whitespace-nowrap text-ink">
          {timecode(playhead / file.fps)}
          <span className="text-subtle"> / {timecode(file.durationInFrames / file.fps)}</span>
        </span>
        <IconButton
          label="Fullscreen"
          icon={<Maximize2 size={15} strokeWidth={1.9} />}
          onClick={fullscreen}
        />
      </div>
    </section>
  );
}
