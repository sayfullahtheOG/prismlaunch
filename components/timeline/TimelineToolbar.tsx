"use client";

import {
  Copy,
  Magnet,
  Maximize2,
  Pause,
  Play,
  Scissors,
  SkipBack,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  deleteClip,
  duplicateSelected,
  fitDurationToContent,
  seek,
  setPlaying,
  setZoom,
  splitAtPlayhead,
  toggleSnap,
} from "@/lib/studio/actions";
import { selectedClipId } from "@/lib/studio/selection";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useStudioStore,
} from "@/lib/studio/store";
import { timecode } from "@/lib/studio/timing";
import type { ProjectFile } from "@/types/prism";

/**
 * The strip above the tracks.
 *
 * Left is what you do to the selected clip, centre is transport, right is how
 * you look at the timeline. That split matters because the three groups have
 * different failure modes: the left ones are destructive and disable when
 * nothing is selected, the middle ones are always safe, and the right ones
 * change nothing about the film at all.
 */

export function TimelineToolbar({ file }: { file: ProjectFile }) {
  const playing = useStudioStore((state) => state.playing);
  const playhead = useStudioStore((state) => state.playhead);
  const snap = useStudioStore((state) => state.snap);
  const zoom = useStudioStore((state) => state.pixelsPerSecond);
  const selectedId = useStudioStore((state) => selectedClipId(state.project));

  // Only a *clip* can be split or duplicated; a selected track cannot.
  const selectedClip = file.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === selectedId);

  const seconds = playhead / file.fps;
  const total = file.durationInFrames / file.fps;

  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line-soft bg-surface px-2">
      <IconButton
        label="Split at playhead"
        icon={<Scissors size={15} strokeWidth={1.9} />}
        onClick={() => splitAtPlayhead()}
        disabled={!selectedClip}
      />
      <IconButton
        label="Duplicate clip"
        icon={<Copy size={15} strokeWidth={1.9} />}
        onClick={() => duplicateSelected()}
        disabled={!selectedClip}
      />
      <IconButton
        label="Delete clip"
        icon={<Trash2 size={15} strokeWidth={1.9} />}
        onClick={() => selectedClip && deleteClip(selectedClip.id)}
        disabled={!selectedClip}
      />

      <span className="mx-1 h-5 w-px bg-line-soft" aria-hidden />

      <div className="flex flex-1 items-center justify-center gap-1">
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
          icon={
            playing ? (
              <Pause size={15} strokeWidth={2} />
            ) : (
              <Play size={15} strokeWidth={2} />
            )
          }
          onClick={() => setPlaying(!playing)}
        />
        <span className="tabular ml-2 font-mono text-xs text-ink">
          {timecode(seconds)}
          <span className="text-subtle"> / {timecode(total)}</span>
        </span>
      </div>

      {/* The film's size and rate: facts, kept with the other numbers. */}
      <span className="tabular mr-2 hidden font-mono text-2xs text-subtle lg:inline">
        {file.width}×{file.height} · {file.fps}fps
      </span>

      <IconButton
        label={snap ? "Snapping on" : "Snapping off"}
        icon={<Magnet size={15} strokeWidth={1.9} />}
        pressed={snap}
        onClick={() => toggleSnap()}
      />
      <IconButton
        label="Zoom out"
        icon={<ZoomOut size={15} strokeWidth={1.9} />}
        onClick={() => setZoom(zoom / 1.4)}
        disabled={zoom <= MIN_ZOOM}
      />
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        value={zoom}
        aria-label="Timeline zoom"
        onChange={(event) => setZoom(Number(event.target.value))}
        className="ds-focus mx-1 h-1 w-20 shrink-0 cursor-pointer appearance-none rounded-pill bg-strong accent-accent"
      />
      <IconButton
        label="Zoom in"
        icon={<ZoomIn size={15} strokeWidth={1.9} />}
        onClick={() => setZoom(zoom * 1.4)}
        disabled={zoom >= MAX_ZOOM}
      />
      <IconButton
        label="Trim composition to content"
        icon={<Maximize2 size={15} strokeWidth={1.9} />}
        onClick={() => fitDurationToContent()}
      />
    </div>
  );
}
