import { create } from "zustand";
import type { FilmProject, SceneId } from "@/types/prism";

/**
 * The studio store: state and setters ONLY.
 *
 * All meaningful logic lives in lib/studio/actions.ts. Components and WebMCP
 * tool executors import actions — never these setters directly, and never
 * `setState` from outside this module. Two mutation paths would let the agent
 * and the UI drift apart, which is the one thing that would break the
 * shared-canvas premise (context/architecture.md invariant 1).
 *
 * `project` starts as `null`, deliberately.
 *
 * A first-time visitor should arrive at their own empty studio, not somebody
 * else's finished film. And "empty" cannot be an empty project: the schema
 * requires exactly four scenes in fixed slots, so a board with nothing in it
 * is not a representable value. The honest representation of "no film yet" is
 * the absence of one.
 */

export type PlaybackMode =
  | { kind: "scene"; sceneId: SceneId }
  | { kind: "film" };

/** A render an agent proposed, waiting on a human decision. */
export type PendingRender = {
  confirmationId: string;
  summary: string;
  reason?: string;
  available: boolean;
};

export type StudioState = {
  project: FilmProject | null;
  pendingRender: PendingRender | null;
  /** Last render outcome, shown under the Export button. */
  renderNote: string | null;
  /** Bumped to restart the preview from the top of the current scene. */
  playToken: number;
  playback: PlaybackMode;

  setProject: (project: FilmProject) => void;
  clearProject: () => void;
  setPendingRender: (pending: PendingRender | null) => void;
  setRenderNote: (note: string | null) => void;
  setPlayback: (playback: PlaybackMode) => void;
  bumpPlayToken: () => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  project: null,
  pendingRender: null,
  renderNote: null,
  playToken: 0,
  playback: { kind: "film" },

  setProject: (project) => set({ project }),
  clearProject: () =>
    set({
      project: null,
      pendingRender: null,
      renderNote: null,
      playback: { kind: "film" },
    }),
  setPendingRender: (pendingRender) => set({ pendingRender }),
  setRenderNote: (renderNote) => set({ renderNote }),
  setPlayback: (playback) => set({ playback }),
  bumpPlayToken: () => set((state) => ({ playToken: state.playToken + 1 })),
}));

/**
 * Read the current project outside React — this is how a WebMCP executor sees
 * the same state the user is looking at. Null until a source is inspected.
 */
export function readProject(): FilmProject | null {
  return useStudioStore.getState().project;
}

/** Back to the empty studio. Backs a "start over" control and gives tests a clean slate. */
export function resetStudio(): void {
  useStudioStore.getState().clearProject();
  useStudioStore.setState({ playToken: 0 });
}

/** `14:04:09` — activity timestamps are wall-clock and display-only. */
export function nowTimecode(): string {
  return new Date().toTimeString().slice(0, 8);
}
