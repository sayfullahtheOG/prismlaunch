"use client";

import { useRef } from "react";
import { Layers, Lock, Music, Palette, Plus } from "lucide-react";
import { createTrack, seek, selectBackground } from "@/lib/studio/actions";
import { timingLocked } from "@/lib/studio/process";
import { backgroundSelected } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import { shortTimecode } from "@/lib/studio/timing";
import type { ProjectFile, Track } from "@/types/prism";
import { ClipChip } from "./ClipChip";
import { TimelineToolbar } from "./TimelineToolbar";
import { TrackHeader } from "./TrackHeader";
import {
  frameToX,
  laneWidth,
  splitTracks,
  tickSeconds,
  workingWidth,
  xToFrame,
} from "./geometry";

/**
 * The timeline.
 *
 * Reads top to bottom exactly as the picture stacks: visual layers first, the
 * background in the middle, audio underneath. The background row is not a
 * track — it always exists, always spans the whole composition, and cannot be
 * moved or deleted — so it is drawn as a fixed row rather than pretending to be
 * one and then disabling half its controls.
 *
 * One horizontal scroller wraps the ruler, every lane and the playhead, so they
 * cannot drift apart. Doing it any other way means syncing three scroll offsets
 * and getting it wrong on the first trackpad fling.
 */

const HEADER_WIDTH = 176;
const ROW_HEIGHT = 56;
const BACKGROUND_ROW_HEIGHT = 34;
/** The locked-beat bands, shown only once the animatic is approved. */
const BEATS_ROW_HEIGHT = 22;
/** Empty space past the end, so the last clip is not flush against the wall. */
const TAIL_PADDING = 240;

export function Timeline({ file }: { file: ProjectFile }) {
  const pixelsPerSecond = useStudioStore((state) => state.pixelsPerSecond);
  const playhead = useStudioStore((state) => state.playhead);
  const scroller = useRef<HTMLDivElement>(null);

  const { visual, audio } = splitTracks(file);
  // What the film currently runs to, and how much timeline to draw. They are
  // different numbers for an empty composition — see `workingWidth`.
  const width = laneWidth(file, pixelsPerSecond);
  const content = workingWidth(file, pixelsPerSecond, TAIL_PADDING);

  /**
   * Pointer x within the scrolling content, in frames.
   *
   * Clamped to the composition, not to the drawn width: the playhead has no
   * meaning past the end of the film, even though there is timeline there to
   * drop clips into.
   */
  function frameAt(clientX: number): number {
    const element = scroller.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left + element.scrollLeft;
    return Math.max(
      0,
      Math.min(file.durationInFrames, xToFrame(x, pixelsPerSecond, file.fps)),
    );
  }

  /** Scrub: pointerdown anywhere on the ruler, then drag. */
  function onRulerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    seek(frameAt(event.clientX));

    function move(moveEvent: PointerEvent) {
      seek(frameAt(moveEvent.clientX));
    }
    function up() {
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
    }
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
  }

  return (
    <section
      aria-label="Timeline"
      className="flex min-h-0 shrink-0 flex-col border-t border-line-soft bg-canvas"
      style={{ height: 300 }}
    >
      <TimelineToolbar file={file} />

      <div className="flex min-h-0 flex-1">
        {/* The header column does not scroll horizontally with the lanes. */}
        <div
          className="thin-scroll shrink-0 overflow-y-auto border-r border-line-soft bg-surface"
          style={{ width: HEADER_WIDTH }}
        >
          <div
            className="flex items-center border-b border-line-soft px-2.5"
            style={{ height: 28 }}
          >
            <span className="text-xs font-medium text-muted">Layers</span>
            <button
              type="button"
              onClick={() => createTrack("visual")}
              aria-label="Add visual layer"
              title="Add visual layer"
              className="ds-focus ml-auto grid size-6 place-items-center rounded-xs text-subtle hover:bg-sunken hover:text-ink"
            >
              <Plus size={12} strokeWidth={2.4} aria-hidden />
            </button>
          </div>

          {timingLocked(file.process) ? (
            <div
              className="flex items-center gap-1.5 border-b border-line-soft bg-sunken px-2.5"
              style={{ height: BEATS_ROW_HEIGHT }}
            >
              <Lock size={11} strokeWidth={2.2} className="text-subtle" aria-hidden />
              <span className="text-2xs font-semibold text-subtle">
                Beats · locked
              </span>
            </div>
          ) : null}

          {visual.map((track, index) => (
            <div key={track.id} style={{ height: ROW_HEIGHT }}>
              <TrackHeader
                track={track}
                canMoveForward={index > 0}
                canMoveBack={index < visual.length - 1}
              />
            </div>
          ))}

          <BackgroundHeader />

          {audio.map((track, index) => (
            <div key={track.id} style={{ height: ROW_HEIGHT }}>
              <TrackHeader
                track={track}
                canMoveForward={index > 0}
                canMoveBack={index < audio.length - 1}
              />
            </div>
          ))}

          <AddTrackRow />
        </div>

        {/* One scroller for the ruler, every lane and the playhead. */}
        <div ref={scroller} className="thin-scroll min-w-0 flex-1 overflow-auto">
          <div style={{ width: content, position: "relative" }}>
            <Ruler
              file={file}
              pixelsPerSecond={pixelsPerSecond}
              width={width}
              content={content}
              playhead={playhead}
              onPointerDown={onRulerDown}
            />

            {timingLocked(file.process) ? (
              <BeatBands file={file} pixelsPerSecond={pixelsPerSecond} />
            ) : null}

            {visual.map((track) => (
              <Lane key={track.id} track={track} file={file} width={width} />
            ))}

            <BackgroundLane file={file} width={width} />

            {audio.map((track) => (
              <Lane key={track.id} track={track} file={file} width={width} />
            ))}

            <Playhead
              x={frameToX(playhead, pixelsPerSecond, file.fps)}
              onPointerDown={onRulerDown}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Ruler({
  file,
  pixelsPerSecond,
  width,
  content,
  playhead,
  onPointerDown,
}: {
  file: ProjectFile;
  pixelsPerSecond: number;
  width: number;
  content: number;
  playhead: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const step = tickSeconds(pixelsPerSecond);
  // Ticks span the drawn timeline, not the film — an empty composition still
  // needs a readable scale over the space you are about to build in.
  const total = content / pixelsPerSecond;
  const ticks: number[] = [];
  for (let second = 0; second <= total; second += step) {
    ticks.push(second);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={file.durationInFrames}
      aria-valuenow={playhead}
      className="sticky top-0 z-20 cursor-ew-resize border-b border-line-soft bg-surface select-none"
      style={{ height: 28 }}
    >
      {ticks.map((second) => (
        <div
          key={second}
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: second * pixelsPerSecond }}
        >
          <span className="absolute top-0 h-2 w-px bg-line" />
          <span className="tabular pl-1.5 font-mono text-2xs text-subtle">
            {shortTimecode(second)}
          </span>
        </div>
      ))}

      {/* Where the composition actually ends, if the lane runs on past it. */}
      <span
        className="absolute top-0 bottom-0 w-px bg-line"
        style={{ left: width }}
        aria-hidden
      />
    </div>
  );
}

function Lane({
  track,
  file,
  width,
}: {
  track: Track;
  file: ProjectFile;
  width: number;
}) {
  return (
    <div
      data-track-id={track.id}
      className={`relative border-b border-line-soft ${
        track.hidden ? "opacity-45" : ""
      } ${track.locked ? "bg-sunken" : ""}`}
      style={{ height: ROW_HEIGHT }}
    >
      {/* The composition's extent, so the tail past the end reads as outside. */}
      <span
        className="absolute inset-y-0 left-0 bg-surface/50"
        style={{ width }}
        aria-hidden
      />
      {track.clips.map((clip) => (
        <ClipChip
          key={clip.id}
          clip={clip}
          file={file}
          trackId={track.id}
          locked={track.locked}
        />
      ))}
    </div>
  );
}

/**
 * The locked beats, drawn as bands above the lanes.
 *
 * This is the timing lock made visible: once the animatic is approved, these
 * are the windows an agent may build inside, and they do not move unless the
 * person reopens the stage. Drawn as a row of their own rather than on the
 * ruler so the ruler stays a ruler.
 */
function BeatBands({
  file,
  pixelsPerSecond,
}: {
  file: ProjectFile;
  pixelsPerSecond: number;
}) {
  return (
    <div
      className="relative border-b border-line-soft bg-sunken"
      style={{ height: BEATS_ROW_HEIGHT }}
      aria-label="Locked beats"
    >
      {file.process.animatic.beats.map((beat) => (
        <span
          key={beat.id}
          title={`${beat.label || beat.id} · ${beat.from}–${beat.from + beat.durationInFrames}`}
          className="absolute inset-y-1 flex items-center overflow-hidden rounded-xs border border-line px-1.5 font-mono text-2xs text-subtle"
          style={{
            left: frameToX(beat.from, pixelsPerSecond, file.fps),
            width: Math.max(2, frameToX(beat.durationInFrames, pixelsPerSecond, file.fps)),
          }}
        >
          <span className="truncate">{beat.label || beat.id}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The background's row.
 *
 * Shorter than a track and with no controls of its own, because there is
 * nothing to arrange: it is one thing, it is always there, and it always spans
 * everything. Showing it in the stack anyway is what makes the stack legible —
 * you can see that visual layers are above it and audio below.
 *
 * Clicking it selects the composition, and the inspector shows the ground,
 * the duration and the size. That is the whole of what used to be a Canvas
 * section: properties of one row, reached from the row.
 */
function BackgroundHeader() {
  const selected = useStudioStore((state) => backgroundSelected(state.project));
  return (
    <button
      type="button"
      onClick={() => selectBackground()}
      aria-current={selected ? "true" : undefined}
      className={`ds-focus flex w-full items-center gap-1.5 border-b border-line-soft px-2.5 text-left transition-[background-color] duration-140 ${
        selected ? "bg-accent-soft" : "bg-sunken hover:bg-raised"
      }`}
      style={{ height: BACKGROUND_ROW_HEIGHT }}
    >
      <Palette
        size={12}
        strokeWidth={1.9}
        className={selected ? "text-accent" : "text-subtle"}
        aria-hidden
      />
      <span className={`text-xs font-medium ${selected ? "text-accent" : "text-muted"}`}>
        Background
      </span>
    </button>
  );
}

function BackgroundLane({ file, width }: { file: ProjectFile; width: number }) {
  const selected = useStudioStore((state) => backgroundSelected(state.project));
  const background = file.background;
  const fill =
    background.kind === "solid"
      ? background.color
      : `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;

  return (
    <div
      onClick={() => selectBackground()}
      className="relative cursor-pointer border-b border-line-soft bg-sunken"
      style={{ height: BACKGROUND_ROW_HEIGHT }}
    >
      <div
        className={`absolute inset-y-1.5 left-0 rounded-xs ${selected ? "ring-2 ring-accent" : ""}`}
        style={{ width, background: fill }}
        aria-hidden
      />
    </div>
  );
}

function AddTrackRow() {
  return (
    <div className="flex flex-col gap-1 p-2">
      <button
        type="button"
        onClick={() => createTrack("visual")}
        className="ds-focus flex h-7 items-center gap-1.5 rounded-xs px-1.5 text-xs text-muted hover:bg-sunken hover:text-ink"
      >
        <Layers size={12} strokeWidth={1.9} aria-hidden />
        Add visual layer
      </button>
      <button
        type="button"
        onClick={() => createTrack("audio")}
        className="ds-focus flex h-7 items-center gap-1.5 rounded-xs px-1.5 text-xs text-muted hover:bg-sunken hover:text-ink"
      >
        <Music size={12} strokeWidth={1.9} aria-hidden />
        Add audio layer
      </button>
    </div>
  );
}

function Playhead({
  x,
  onPointerDown,
}: {
  x: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="pointer-events-none absolute top-0 bottom-0 z-30"
      style={{ left: x }}
      aria-hidden
    >
      <span className="absolute top-0 bottom-0 -left-px w-0.5 bg-accent" />
      <span className="absolute -top-0.5 -left-1.5 size-3 rounded-xs bg-accent" />
    </div>
  );
}
