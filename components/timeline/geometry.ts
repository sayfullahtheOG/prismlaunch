import type { ProjectFile, Track } from "@/types/prism";

/**
 * Frames to pixels, and back.
 *
 * One module so the ruler, the lanes, the clips and the playhead cannot
 * disagree about where frame 240 is. Every one of them was computing this
 * itself in the first draft, and three of them were right.
 */

export function frameToX(frame: number, pixelsPerSecond: number, fps: number): number {
  return (frame / fps) * pixelsPerSecond;
}

export function xToFrame(x: number, pixelsPerSecond: number, fps: number): number {
  return Math.round((x / pixelsPerSecond) * fps);
}

export function laneWidth(file: ProjectFile, pixelsPerSecond: number): number {
  return frameToX(file.durationInFrames, pixelsPerSecond, file.fps);
}

/**
 * How much timeline to draw, which is not the same as how long the film is.
 *
 * A new composition has a runtime of one frame — it grows as clips are placed,
 * rather than starting at some length somebody then has to trim back. That
 * makes the composition's own extent a useless width for the scrollable area:
 * it would be two pixels wide, with nowhere to drop the first clip.
 *
 * So the working area is always at least half a minute, and the composition's
 * real extent is drawn inside it as shading. Empty reads as empty, and there is
 * still a canvas to work on.
 */
export const MIN_WORKING_SECONDS = 30;

export function workingWidth(
  file: ProjectFile,
  pixelsPerSecond: number,
  tailPadding: number,
): number {
  return Math.max(
    laneWidth(file, pixelsPerSecond) + tailPadding,
    MIN_WORKING_SECONDS * pixelsPerSecond,
  );
}

/**
 * How far apart to draw ruler ticks, in seconds.
 *
 * Picked from a fixed ladder rather than computed, because the alternative
 * produces labels at 2.5 second intervals and nobody reads a timeline that way.
 * The ladder is the one every NLE uses.
 */
const LADDER = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300] as const;

export function tickSeconds(pixelsPerSecond: number): number {
  const wanted = 90 / pixelsPerSecond;
  return LADDER.find((step) => step >= wanted) ?? LADDER[LADDER.length - 1]!;
}

/** Snap within this many pixels of a target. Six is about a fingertip of slop. */
export const SNAP_PIXELS = 6;

/**
 * Every frame worth snapping to: the ends of the composition, the playhead, and
 * both edges of every clip on every track.
 *
 * Deliberately includes clips on *other* tracks, because aligning a title with
 * a cut on the layer below is the single most common thing anyone does in a
 * timeline, and it is the thing that is impossible to hit by eye.
 */
export function snapTargets(
  file: ProjectFile,
  playhead: number,
  exceptClipId: string | null,
): number[] {
  const targets = new Set<number>([0, file.durationInFrames, playhead]);

  for (const track of file.tracks) {
    for (const clip of track.clips) {
      if (clip.id === exceptClipId) continue;
      targets.add(clip.from);
      targets.add(clip.from + clip.durationInFrames);
    }
  }

  return [...targets];
}

/**
 * Pull a frame onto the nearest target, if one is close enough on screen.
 *
 * The threshold is in *pixels*, not frames, so snapping feels the same at every
 * zoom level — at 12px/s a six-frame tolerance would be invisible, and at 320
 * it would fight you.
 */
export function snapFrame(
  frame: number,
  targets: readonly number[],
  pixelsPerSecond: number,
  fps: number,
): number {
  const tolerance = (SNAP_PIXELS / pixelsPerSecond) * fps;

  let best = frame;
  let bestDistance = tolerance;

  for (const target of targets) {
    const distance = Math.abs(target - frame);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return Math.round(best);
}

/** The row order the timeline draws: visual tracks, the background, then audio. */
export function splitTracks(file: ProjectFile): {
  visual: Track[];
  audio: Track[];
} {
  return {
    visual: file.tracks.filter((track) => track.kind === "visual"),
    audio: file.tracks.filter((track) => track.kind === "audio"),
  };
}

/** Which track lane the pointer is over, or null if it is off the rows. */
export function trackAtPoint(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  const lane = element?.closest<HTMLElement>("[data-track-id]");
  return lane?.dataset.trackId ?? null;
}
