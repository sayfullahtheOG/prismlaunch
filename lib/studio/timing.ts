import type { Scene } from "@/types/prism";
import { FPS } from "./schema";

/** Pure timing helpers shared by the editor chrome and the renderer. */

export function framesToSeconds(frames: number): number {
  return frames / FPS;
}

export function totalFrames(scenes: readonly Scene[]): number {
  return scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
}

export function totalSeconds(scenes: readonly Scene[]): number {
  return framesToSeconds(totalFrames(scenes));
}

/** `00:07` — the editor shows whole seconds, never frames. */
export function timecode(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const mm = Math.floor(whole / 60);
  const ss = whole % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Seconds elapsed at the end of the given scene — drives the transport readout. */
export function elapsedThrough(
  scenes: readonly Scene[],
  sceneId: Scene["id"],
): number {
  let frames = 0;
  for (const scene of scenes) {
    frames += scene.durationFrames;
    if (scene.id === sceneId) break;
  }
  return framesToSeconds(frames);
}
