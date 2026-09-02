import { create } from "zustand";
import type { ProjectEntry, Workspace } from "@/lib/workspace/fs";
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
 * Everything here is a *view of a folder*. The film lives in
 * `.prismlaunch/<slug>/project.json` on the person's disk; this store holds
 * what was last read from it plus the things that are true only of this tab —
 * which scene is selected, what is playing, what the agent has proposed. None
 * of that is written back.
 */

export type PlaybackMode =
  | { kind: "scene"; sceneId: SceneId }
  | { kind: "film" };

/**
 * How the app stands in relation to a folder.
 *
 * `restoring` and `needs-permission` are separate states because a handle
 * survives a reload but its permission does not: on the second visit we know
 * which folder without being allowed to read it yet, and the difference is
 * something the person has to see and act on.
 */
export type WorkspaceState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "unlinked" }
  | { kind: "needs-permission"; root: FileSystemDirectoryHandle }
  | { kind: "linked"; workspace: Workspace; projects: ProjectEntry[] };

/** A render an agent proposed, waiting on a human decision. */
export type PendingRender = {
  confirmationId: string;
  summary: string;
  reason?: string;
  available: boolean;
};

export type StudioState = {
  workspace: WorkspaceState;
  project: FilmProject | null;
  /** `project.json`'s mtime when we last read it, for change detection. */
  loadedAt: number;
  /** A file on disk that will not parse. Shown instead of the board. */
  loadError: string | null;

  pendingRender: PendingRender | null;
  /** Last render outcome, shown under the Export button. */
  renderNote: string | null;
  /** Bumped to restart the preview from the top of the current scene. */
  playToken: number;
  playback: PlaybackMode;

  setWorkspace: (workspace: WorkspaceState) => void;
  setProjects: (projects: ProjectEntry[]) => void;
  setProject: (project: FilmProject | null, loadedAt: number) => void;
  setLoadError: (message: string | null) => void;
  closeProject: () => void;
  setPendingRender: (pending: PendingRender | null) => void;
  setRenderNote: (note: string | null) => void;
  setPlayback: (playback: PlaybackMode) => void;
  bumpPlayToken: () => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  workspace: { kind: "checking" },
  project: null,
  loadedAt: 0,
  loadError: null,
  pendingRender: null,
  renderNote: null,
  playToken: 0,
  playback: { kind: "film" },

  setWorkspace: (workspace) => set({ workspace }),
  setProjects: (projects) =>
    set((state) =>
      state.workspace.kind === "linked"
        ? { workspace: { ...state.workspace, projects } }
        : {},
    ),
  setProject: (project, loadedAt) =>
    set({ project, loadedAt, ...(project ? { loadError: null } : {}) }),
  setLoadError: (loadError) => set({ loadError }),
  closeProject: () =>
    set({
      project: null,
      loadedAt: 0,
      loadError: null,
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
 * the same state the user is looking at. Null until a project is opened.
 */
export function readProject(): FilmProject | null {
  return useStudioStore.getState().project;
}

/** The linked workspace, or null. Every filesystem action starts here. */
export function readWorkspace(): Workspace | null {
  const { workspace } = useStudioStore.getState();
  return workspace.kind === "linked" ? workspace.workspace : null;
}

/** Back to a blank studio. Backs "close project" and gives tests a clean slate. */
export function resetStudio(): void {
  useStudioStore.getState().closeProject();
  useStudioStore.setState({
    workspace: { kind: "checking" },
    playToken: 0,
  });
}

/** `14:04:09` — activity timestamps are wall-clock and display-only. */
export function nowTimecode(): string {
  return new Date().toTimeString().slice(0, 8);
}
