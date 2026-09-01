import { create } from "zustand";
import { demoProject } from "@/lib/source/demo-project";
import type { FilmProject, SceneId } from "@/types/prism";

/**
 * The studio store: state and setters ONLY.
 *
 * All meaningful logic lives in lib/studio/actions.ts. Components and WebMCP
 * tool executors import actions — never these setters directly, and never
 * `setState` from outside this module. Two mutation paths would let the agent
 * and the UI drift apart, which is the one thing that would break the
 * shared-canvas premise (context/architecture.md invariant 1).
 */

export type PlaybackMode =
  | { kind: "scene"; sceneId: SceneId }
  | { kind: "film" };

export type StudioState = {
  project: FilmProject;
  /** Bumped to restart the preview from the top of the current scene. */
  playToken: number;
  playback: PlaybackMode;

  setProject: (project: FilmProject) => void;
  updateProject: (recipe: (previous: FilmProject) => FilmProject) => void;
  setPlayback: (playback: PlaybackMode) => void;
  bumpPlayToken: () => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  project: demoProject,
  playToken: 0,
  playback: { kind: "scene", sceneId: demoProject.activeSceneId },

  setProject: (project) => set({ project }),
  updateProject: (recipe) =>
    set((state) => ({ project: recipe(state.project) })),
  setPlayback: (playback) => set({ playback }),
  bumpPlayToken: () => set((state) => ({ playToken: state.playToken + 1 })),
}));

/**
 * Read the current project outside React — this is how a WebMCP executor sees
 * the same state the user is looking at.
 */
export function readProject(): FilmProject {
  return useStudioStore.getState().project;
}

/**
 * Restore the built-in demo film. Backs the P1 "reset to demo" control and
 * gives tests a clean slate without reaching for `setState` directly.
 */
export function resetStudio(): void {
  useStudioStore.setState({
    project: demoProject,
    playToken: 0,
    playback: { kind: "scene", sceneId: demoProject.activeSceneId },
  });
}

/** `14:04:09` — activity timestamps are wall-clock and display-only. */
export function nowTimecode(): string {
  return new Date().toTimeString().slice(0, 8);
}
