import { DEFAULT_FPS, DEFAULT_HEIGHT, DEFAULT_WIDTH, EMPTY_PROCESS, PROJECT_FILE_VERSION } from "./schema";
import type { ProjectFile } from "@/types/prism";

/**
 * A blank composition.
 *
 * Used twice, and the two uses have to agree: it is what `createProject`
 * writes to disk, and it is what the editor renders behind the setup dialog
 * before anything is open — so what a person sees through the dialog is
 * exactly what they will get when they click through it.
 *
 * Blank means blank: a background, one visual track, one audio track, no
 * clips, and a runtime of one frame that grows as clips are placed.
 */
export function blankProjectFile(
  name: string,
  overrides: Partial<Pick<ProjectFile, "width" | "height" | "fps" | "durationInFrames" | "background">> = {},
): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    name,
    width: overrides.width ?? DEFAULT_WIDTH,
    height: overrides.height ?? DEFAULT_HEIGHT,
    fps: overrides.fps ?? DEFAULT_FPS,
    durationInFrames: overrides.durationInFrames ?? 1,
    background: overrides.background ?? { kind: "solid", color: "#0A0A0C" },
    process: structuredClone(EMPTY_PROCESS),
    elements: [],
    camera: [],
    tracks: [
      {
        id: "track-main",
        kind: "visual",
        name: "Layer 1",
        hidden: false,
        locked: false,
        volume: 1,
        clips: [],
      },
      {
        id: "audio-main",
        kind: "audio",
        name: "Audio 1",
        hidden: false,
        locked: false,
        volume: 1,
        clips: [],
      },
    ],
  };
}

/** The composition the editor shows while nothing is open. Never written. */
export const BLANK_FILE: ProjectFile = blankProjectFile("Untitled composition");
