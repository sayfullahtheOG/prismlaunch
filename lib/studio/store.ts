import { create } from "zustand";
import type { ProjectEntry, Workspace } from "@/lib/workspace/fs";
import type { FilmProject, StageId } from "@/types/prism";

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
 * selection, the playhead, timeline zoom, what the agent has proposed. None of
 * that is written back.
 */

/**
 * Timeline view state.
 *
 * `pixelsPerSecond` is the zoom, and it lives here rather than in the timeline
 * component because the ruler, the tracks, the clips and the playhead all have
 * to agree about it — a local `useState` would mean four components computing
 * the same number and one of them being wrong after a resize.
 */
export const MIN_ZOOM = 12;
export const MAX_ZOOM = 320;
export const DEFAULT_ZOOM = 60;
export const DEFAULT_TIMELINE_HEIGHT = 300;
export const MIN_TIMELINE_HEIGHT = 160;
export const MAX_TIMELINE_HEIGHT = 720;

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

/**
 * The rail's sections. Named here rather than in the component because the
 * Process panel opens the storyboard and the elements from a link, and an
 * action has to be able to say which.
 */
export type RailTab = "process" | "storyboard" | "elements" | "library" | "agent";

export type StudioState = {
  workspace: WorkspaceState;
  /** Which section the rail is showing. The process is where a film starts. */
  tab: RailTab;
  /**
   * The stage the person has opened to review, or null for "wherever the
   * film is". Lives here rather than in the Process panel because the middle
   * of the editor follows it: a document stage opens as a page there.
   */
  openStage: StageId | null;
  /**
   * Whether the middle shows the stage under review or the editor. Opening a
   * stage sets it; "Back to editor" clears it. Without this there would be
   * no way to reach the canvas while the film's current stage is a document.
   */
  reviewing: boolean;
  project: FilmProject | null;
  /** `project.json`'s mtime when we last read it, for change detection. */
  loadedAt: number;
  /** A file on disk that will not parse. Shown instead of the board. */
  loadError: string | null;

  pendingRender: PendingRender | null;
  /** Last render outcome, shown under the Export button. */
  renderNote: string | null;
  /**
   * The contact sheet the agent most recently captured, so the person can
   * see what it saw. A film made by two parties should not have one of them
   * looking at something the other cannot.
   */
  lastCapture: { pages: string[]; label: string; at: string } | null;

  /** Object URLs for `assets/*` files, keyed by the path a clip refers to. */
  assets: Readonly<Record<string, string>>;
  /** Paths a clip refers to that are not in the folder. Reported, not fatal. */
  missingAssets: readonly string[];
  /** Every file in the project's `assets/`, referenced or not. For the library. */
  assetFiles: readonly string[];

  /** The frame the playhead is on. Shared by the timeline and the player. */
  playhead: number;
  playing: boolean;
  /** Timeline zoom, in pixels per second of film. */
  pixelsPerSecond: number;
  /** Snap clip edges to other clips and the playhead while dragging. */
  snap: boolean;
  /** Height of the timeline in pixels; the person drags the seam to change it. */
  timelineHeight: number;
  /**
   * One line of feedback for something that could not be done — a split
   * with the playhead outside the clip, a duplicate with no room. Shown
   * briefly where the action was taken, then cleared.
   */
  notice: string | null;

  setTab: (tab: RailTab) => void;
  setOpenStage: (stage: StageId | null) => void;
  setReviewing: (reviewing: boolean) => void;
  setWorkspace: (workspace: WorkspaceState) => void;
  setProjects: (projects: ProjectEntry[]) => void;
  setProject: (project: FilmProject | null, loadedAt: number) => void;
  setLoadError: (message: string | null) => void;
  closeProject: () => void;
  setPendingRender: (pending: PendingRender | null) => void;
  setRenderNote: (note: string | null) => void;
  setLastCapture: (capture: StudioState["lastCapture"]) => void;
  setAssets: (
    assets: Readonly<Record<string, string>>,
    missing: readonly string[],
    files: readonly string[],
  ) => void;
  setPlayhead: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (pixelsPerSecond: number) => void;
  setSnap: (snap: boolean) => void;
  setTimelineHeight: (height: number) => void;
  setNotice: (notice: string | null) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  workspace: { kind: "checking" },
  tab: "process",
  openStage: null,
  reviewing: true,
  project: null,
  loadedAt: 0,
  loadError: null,
  pendingRender: null,
  renderNote: null,
  lastCapture: null,
  assets: {},
  missingAssets: [],
  assetFiles: [],
  playhead: 0,
  playing: false,
  pixelsPerSecond: DEFAULT_ZOOM,
  snap: true,
  timelineHeight: DEFAULT_TIMELINE_HEIGHT,
  notice: null,

  setTab: (tab) => set({ tab }),
  setOpenStage: (openStage) => set({ openStage, reviewing: true }),
  setReviewing: (reviewing) => set({ reviewing }),
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
      lastCapture: null,
      assets: {},
      missingAssets: [],
      assetFiles: [],
      playhead: 0,
      playing: false,
    }),
  setPendingRender: (pendingRender) => set({ pendingRender }),
  setRenderNote: (renderNote) => set({ renderNote }),
  setLastCapture: (lastCapture) => set({ lastCapture }),
  setAssets: (assets, missingAssets, assetFiles) =>
    set({ assets, missingAssets, assetFiles }),
  setPlayhead: (playhead) => set({ playhead: Math.max(0, Math.round(playhead)) }),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pixelsPerSecond) =>
    set({
      pixelsPerSecond: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pixelsPerSecond)),
    }),
  setSnap: (snap) => set({ snap }),
  setTimelineHeight: (height) =>
    set({
      timelineHeight: Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, Math.round(height))),
    }),
  setNotice: (notice) => set({ notice }),
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
    tab: "process",
    openStage: null,
    reviewing: true,
    pixelsPerSecond: DEFAULT_ZOOM,
    snap: true,
  });
}

/** `14:04:09` — activity timestamps are wall-clock and display-only. */
export function nowTimecode(): string {
  return new Date().toTimeString().slice(0, 8);
}
