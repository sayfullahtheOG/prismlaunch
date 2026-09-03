"use client";

import { useEffect, useRef } from "react";
import { Layers, Lock, Music, Palette, Plus } from "lucide-react";
import { createTrack, seek, select, selectBackground } from "@/lib/studio/actions";
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
 * Pointer capture, tolerant of a pointer that is not there: a synthetic
 * event, or a pen lifted between down and the handler, would otherwise
 * throw and leave the drag half-wired.
 */
function capture(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // No active pointer with that id. The drag still works without capture.
  }
}
function release(element: Element, pointerId: number): void {
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Already released, or never captured.
  }
}

/**
 * The timeline.
 *
 * Reads top to bottom exactly as the picture stacks: visual layers first, the
 * background in the middle, audio underneath. The background row is not a
 * track — it always exists, always spans the whole composition, and cannot be
 * moved or deleted — so it is drawn as a fixed row rather than pretending to be
 * one and then disabling half its controls.
 *
 * ONE scroll container holds everything: the ruler, the layer column, every
 * lane and the playhead. The ruler is sticky to the top, the layer cells are
 * sticky to the left, and the corner is sticky to both. Two scrollers — one
 * for the layer column, one for the lanes — was the first version, and with
 * more rows than fit they drifted apart on the first trackpad fling; a layer
 * name beside the wrong clips is worse than no name at all.
 */

const HEADER_WIDTH = 176;
const RULER_HEIGHT = 28;
const ROW_HEIGHT = 56;
const BACKGROUND_ROW_HEIGHT = 34;
/** The locked-beat bands, shown only once the animatic is approved. */
const BEATS_ROW_HEIGHT = 22;
/** Empty space past the end, so the last clip is not flush against the wall. */
const TAIL_PADDING = 240;
/** Keep the playhead this far from the left edge when the view has to follow it. */
const FOLLOW_MARGIN = 0.25;

export function Timeline({ file }: { file: ProjectFile }) {
  const pixelsPerSecond = useStudioStore((state) => state.pixelsPerSecond);
  const playhead = useStudioStore((state) => state.playhead);
  const height = useStudioStore((state) => state.timelineHeight);
  const scroller = useRef<HTMLDivElement>(null);

  const { visual, audio } = splitTracks(file);
  // What the film currently runs to, and how much timeline to draw. They are
  // different numbers for an empty composition — see `workingWidth`.
  const width = laneWidth(file, pixelsPerSecond);
  const content = workingWidth(file, pixelsPerSecond, TAIL_PADDING);
  const last = Math.max(0, file.durationInFrames - 1);

  /**
   * Keep the playhead on screen.
   *
   * Playback carries it off the right edge, a zoom can leave it anywhere, and
   * an agent's `prism.seek` can put it out of view entirely. Whenever it
   * leaves the visible span of the lanes, scroll so it sits a quarter of the
   * way in — far enough from the edge to see what is coming.
   */
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const x = frameToX(playhead, pixelsPerSecond, file.fps);
    const visibleWidth = element.clientWidth - HEADER_WIDTH;
    if (visibleWidth <= 0) return;
    const left = element.scrollLeft;
    if (x >= left && x <= left + visibleWidth) return;
    element.scrollLeft = Math.max(0, x - visibleWidth * FOLLOW_MARGIN);
  }, [playhead, pixelsPerSecond, file.fps]);

  /**
   * Pointer x within the scrolling content, in frames.
   *
   * Clamped to the film's last frame, not to the drawn width: the playhead
   * has no meaning past the end, even though there is timeline there to drop
   * clips into.
   */
  function frameAt(clientX: number): number {
    const element = scroller.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left + element.scrollLeft - HEADER_WIDTH;
    return Math.max(0, Math.min(last, xToFrame(x, pixelsPerSecond, file.fps)));
  }

  /** Scrub: pointerdown anywhere on the ruler, then drag. */
  function onRulerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const element = event.currentTarget;
    capture(element, event.pointerId);
    seek(frameAt(event.clientX));

    function move(moveEvent: PointerEvent) {
      seek(frameAt(moveEvent.clientX));
    }
    function up() {
      release(element, event.pointerId);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
    }
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
  }

  const beats = timingLocked(file.process);
  const rowsHeight =
    RULER_HEIGHT +
    (beats ? BEATS_ROW_HEIGHT : 0) +
    (visual.length + audio.length) * ROW_HEIGHT +
    BACKGROUND_ROW_HEIGHT;

  return (
    <section
      aria-label="Timeline"
      className="relative flex min-h-0 shrink-0 flex-col border-t border-line-soft bg-canvas"
      style={{ height }}
    >
      <ResizeHandle />
      <TimelineToolbar file={file} />

      <div ref={scroller} className="thin-scroll relative min-h-0 flex-1 overflow-auto">
        <div style={{ width: HEADER_WIDTH + content, position: "relative" }}>
          {/* The ruler row: sticky to the top, its corner sticky to both. */}
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_HEIGHT }}>
            <HeaderCell className="z-40 flex items-center border-b border-line-soft px-2.5">
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
            </HeaderCell>
            <Ruler
              file={file}
              pixelsPerSecond={pixelsPerSecond}
              width={width}
              content={content}
              playhead={playhead}
              last={last}
              onPointerDown={onRulerDown}
            />
          </div>

          {beats ? (
            <Row height={BEATS_ROW_HEIGHT}>
              <HeaderCell className="flex items-center gap-1.5 border-b border-line-soft bg-sunken px-2.5">
                <Lock size={11} strokeWidth={2.2} className="text-subtle" aria-hidden />
                <span className="text-2xs font-medium text-subtle">Beats · locked</span>
              </HeaderCell>
              <BeatBands file={file} pixelsPerSecond={pixelsPerSecond} />
            </Row>
          ) : null}

          {visual.map((track, index) => (
            <Row key={track.id} height={ROW_HEIGHT}>
              <HeaderCell>
                <TrackHeader
                  track={track}
                  canMoveForward={index > 0}
                  canMoveBack={index < visual.length - 1}
                />
              </HeaderCell>
              <Lane track={track} file={file} width={width} />
            </Row>
          ))}

          <Row height={BACKGROUND_ROW_HEIGHT}>
            <HeaderCell>
              <BackgroundHeader />
            </HeaderCell>
            <BackgroundLane file={file} width={width} />
          </Row>

          {audio.map((track, index) => (
            <Row key={track.id} height={ROW_HEIGHT}>
              <HeaderCell>
                <TrackHeader
                  track={track}
                  canMoveForward={index > 0}
                  canMoveBack={index < audio.length - 1}
                />
              </HeaderCell>
              <Lane track={track} file={file} width={width} />
            </Row>
          ))}

          <Row>
            <HeaderCell className="border-b-0">
              <AddTrackRow />
            </HeaderCell>
            <div className="flex-1" onClick={() => select(null)} />
          </Row>

          {/* Over the lanes, under the sticky layer column. */}
          <Playhead
            x={HEADER_WIDTH + frameToX(playhead, pixelsPerSecond, file.fps)}
            height={rowsHeight}
          />
        </div>
      </div>
    </section>
  );
}

/** One row of the grid: a sticky header cell, then whatever spans the lanes. */
function Row({ height, children }: { height?: number; children: React.ReactNode }) {
  return (
    <div className="flex" style={height ? { height } : undefined}>
      {children}
    </div>
  );
}

/**
 * The layer-column cell of a row, sticky to the left edge so it stays put as
 * the lanes scroll under it. Opaque, because the lanes pass underneath.
 */
function HeaderCell({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`sticky left-0 z-20 shrink-0 border-r border-line-soft bg-surface ${className}`}
      style={{ width: HEADER_WIDTH }}
    >
      {children}
    </div>
  );
}

/**
 * The seam between the picture and the timeline. Drag it to give the
 * timeline more rows or the picture more room; the store remembers.
 */
function ResizeHandle() {
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget;
    const startY = event.clientY;
    const startHeight = useStudioStore.getState().timelineHeight;
    capture(element, event.pointerId);

    function move(moveEvent: PointerEvent) {
      useStudioStore.getState().setTimelineHeight(startHeight + (startY - moveEvent.clientY));
    }
    function up() {
      release(element, event.pointerId);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    }
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline"
      title="Drag to resize the timeline"
      onPointerDown={onPointerDown}
      className="absolute inset-x-0 -top-1 z-40 h-2 cursor-row-resize transition-[background-color] duration-140 hover:bg-accent/40"
    />
  );
}

function Ruler({
  file,
  pixelsPerSecond,
  width,
  content,
  playhead,
  last,
  onPointerDown,
}: {
  file: ProjectFile;
  pixelsPerSecond: number;
  width: number;
  content: number;
  playhead: number;
  last: number;
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
      aria-valuemax={last}
      aria-valuenow={playhead}
      aria-valuetext={`${(playhead / file.fps).toFixed(2)} seconds`}
      className="relative h-full flex-1 cursor-ew-resize border-b border-line-soft bg-surface select-none"
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

/**
 * A track's lane. Clicking empty space in it clears the selection, the way
 * clicking the desk beside a thing puts it down.
 */
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
      onClick={(event) => {
        if (event.target === event.currentTarget) select(null);
      }}
      className={`relative flex-1 border-b border-line-soft ${
        track.hidden ? "opacity-45" : ""
      } ${track.locked ? "bg-sunken" : ""}`}
    >
      {/* The composition's extent, so the tail past the end reads as outside. */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-surface/50"
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
    <div className="relative flex-1 border-b border-line-soft bg-sunken" aria-label="Locked beats">
      {file.process.animatic.beats.map((beat) => (
        <span
          key={beat.id}
          title={`${beat.label || beat.id} · ${beat.from} to ${beat.from + beat.durationInFrames}`}
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
 * the duration and the size.
 */
function BackgroundHeader() {
  const selected = useStudioStore((state) => backgroundSelected(state.project));
  return (
    <button
      type="button"
      onClick={() => selectBackground()}
      aria-current={selected ? "true" : undefined}
      className={`ds-focus flex h-full w-full items-center gap-1.5 border-b border-line-soft px-2.5 text-left transition-[background-color] duration-140 ${
        selected ? "bg-accent-soft" : "bg-sunken hover:bg-raised"
      }`}
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
      className="relative flex-1 cursor-pointer border-b border-line-soft bg-sunken"
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

/**
 * The playhead: a line down every lane and a head on the ruler.
 *
 * Above the lanes and below the sticky layer column, so it disappears under
 * the layer names as it passes them rather than drawing over them. It takes
 * no pointer events; the ruler is what you grab.
 */
function Playhead({ x, height }: { x: number; height: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: x, height }}
      aria-hidden
    >
      <span className="absolute top-0 bottom-0 -left-px w-0.5 bg-accent" />
      <span className="absolute top-0 -left-1.5 size-3 rounded-xs bg-accent" />
    </div>
  );
}
