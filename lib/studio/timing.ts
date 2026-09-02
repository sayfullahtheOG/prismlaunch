import type { ProjectFile, Track } from "@/types/prism";

/** Pure timing helpers shared by the editor chrome, the timeline and the renderer. */

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * `00:07.4` — the timeline shows tenths, because a clip boundary half a second
 * out is visible in an eighteen-second film and "00:07" would hide it.
 */
export function timecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60);
  const ss = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${tenths}`;
}

/** `00:07` — whole seconds, for the ruler where tenths would be noise. */
export function shortTimecode(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

/** The last frame any clip touches. Drives "trim composition to content". */
export function contentEnd(tracks: readonly Track[]): number {
  let end = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.from + clip.durationInFrames);
    }
  }
  return end;
}

export function clipCount(tracks: readonly Track[]): number {
  return tracks.reduce((total, track) => total + track.clips.length, 0);
}

export function draftCount(tracks: readonly Track[]): number {
  return tracks.reduce(
    (total, track) =>
      total + track.clips.filter((clip) => clip.approval === "draft").length,
    0,
  );
}

export function durationSeconds(file: ProjectFile): number {
  return framesToSeconds(file.durationInFrames, file.fps);
}
