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

/** A render an agent proposed, waiting on a human decision. */
export type PendingRender = {
  confirmationId: string;
  summary: string;
  reason?: string;
  /** False when the environment cannot render — the sheet says so honestly. */
  available: boolean;
};

export type StudioState = {
  project: FilmProject;
  pendingRender: PendingRender | null;
  /** Last render outcome, shown under the Export button. */
  renderNote: string | null;
  /** Bumped to restart the preview from the top of the current scene. */
  playToken: number;
  playback: PlaybackMode;

  setProject: (project: FilmProject) => void;
  setPendingRender: (pending: PendingRender | null) => void;
  setRenderNote: (note: string | null) => void;
  updateProject: (recipe: (previous: FilmProject) => FilmProject) => void;
  setPlayback: (playback: PlaybackMode) => void;
  bumpPlayToken: () => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  project: demoProject,
  pendingRender: null,
  renderNote: null,
  playToken: 0,
  playback: { kind: "scene", sceneId: demoProject.activeSceneId },

  setProject: (project) => set({ project }),
  setPendingRender: (pendingRender) => set({ pendingRender }),
  setRenderNote: (renderNote) => set({ renderNote }),
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
    pendingRender: null,
    renderNote: null,
    playToken: 0,
    playback: { kind: "scene", sceneId: demoProject.activeSceneId },
  });
}

/** `14:04:09` — activity timestamps are wall-clock and display-only. */
export function nowTimecode(): string {
  return new Date().toTimeString().slice(0, 8);
}
