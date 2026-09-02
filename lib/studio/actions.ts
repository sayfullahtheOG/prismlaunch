import {
  addClip,
  addTrack,
  duplicateClip,
  findClip,
  findTrack,
  fitDuration,
  mintId,
  moveClip,
  moveTrack,
  referencedAssets,
  removeClip,
  removeTrack,
  splitClip,
  trimClip,
  trimToContent,
  updateClip,
  updateTrack,
} from "./edits";
import {
  agentMayPlaceClips,
  currentStage,
  fitsLockedBeats,
  nextInstruction,
  previousApproved,
  snapshotBeats,
  STAGE_LABELS,
  timingLocked,
} from "./process";
import {
  ClipSchema,
  DEFAULT_FPS,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  EMPTY_PROCESS,
  explainZodError,
  FilmProjectSchema,
  MAX_FRAMES,
  PROJECT_FILE_VERSION,
  ProcessSchema,
  ProjectFileSchema,
  SlugSchema,
  STAGES,
  WORKSPACE_DIR,
} from "./schema";
import { slugForName } from "./slug";
import { nowTimecode, useStudioStore } from "./store";
import {
  linkWorkspace,
  listProjects,
  loadAssets,
  modifiedAt,
  projectExists,
  readProjectFile,
  renameProjectFolder,
  resolveWorkspace,
  writeProjectFile,
  type Workspace,
} from "@/lib/workspace/fs";
import {
  canLinkFolder,
  checkPermission,
  forgetWorkspace,
  recallWorkspace,
  requestPermission,
} from "@/lib/workspace/handle-store";
import type { RenderSnapshot } from "@/lib/render/job";
import type {
  ActivityEvent,
  Background,
  Clip,
  FilmProject,
  Process,
  ProjectFile,
  StageId,
  StoryboardPanel,
  Track,
  TrackKind,
} from "@/types/prism";

/**
 * THE mutation path.
 *
 * Every state change in the product — a click handler, a timeline drag, or a
 * WebMCP tool executor — calls a function in this file. Nothing here imports
 * React, so an executor can call it with no component context
 * (context/architecture.md invariant 1, context/code-standards.md §State).
 *
 * Three things hold throughout:
 *
 * 1. **Every commit reaches disk.** The store is a view of
 *    `.prismlaunch/<slug>/project.json`; if the two disagree the file wins.
 *    Writes are debounced so a timeline drag does not thrash a file the agent
 *    may have open, and `flushWrites()` forces the queue for callers that must
 *    not return before the bytes land — every tool executor does.
 *
 * 2. **The app writes no content.** It has no model. The agent decides what
 *    the film says and how it is arranged; what is enforced here is structure,
 *    and the approval boundary.
 *
 * 3. **The edits themselves are pure.** `edits.ts` holds the real logic as
 *    functions from one composition to another. This file is the shell that
 *    validates, records who did it, and persists.
 *
 * On the approval boundary: `acceptClip`, `revertClip` and `acceptAllDrafts`
 * are the only actions that clear a draft, and they are deliberately never
 * wrapped as WebMCP tools. That is structural, not a rule in a description —
 * the agent has no function to call (invariant 2).
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "no-workspace"
  | "no-project"
  | "not-found"
  | "invalid-input"
  | "no-draft"
  | "locked"
  | "stage-gated"
  | "timing-locked"
  | "graph-invalid"
  | "disk-error";

function ok(message: string): ActionResult {
  return { ok: true, message };
}

function fail(code: ActionErrorCode, message: string): ActionResult {
  return { ok: false, code, message };
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

type Guard<T> = { ok: true; value: T } | { ok: false; result: ActionResult };

/**
 * Every filesystem action needs a linked folder. The message names the gesture
 * that fixes it, because an agent cannot open the picker itself: that call
 * requires a user activation, and a tool call is not one.
 */
function requireWorkspace(): Guard<Workspace> {
  const { workspace } = useStudioStore.getState();
  if (workspace.kind !== "linked") {
    return {
      ok: false,
      result: fail(
        "no-workspace",
        "No folder is linked yet. Ask the person to click “Link project folder” in PrismLaunch and choose the folder you are working in — the browser only opens that picker for a real click, so you cannot do it for them.",
      ),
    };
  }
  return { ok: true, value: workspace.workspace };
}

function requireProject(): Guard<FilmProject> {
  const { project } = useStudioStore.getState();
  if (!project) {
    return {
      ok: false,
      result: fail(
        "no-project",
        `No composition is open. Create one with prism.create_project, or write ${WORKSPACE_DIR}/<slug>/project.json yourself and open it with prism.open_project.`,
      ),
    };
  }
  return { ok: true, value: project };
}

/**
 * The stage gate, for agents only.
 *
 * Clips exist from the animatic onward; before an approved script there are
 * no beats and a clip is a guess. The person can always place clips — they own
 * the process — so this checks `origin` and lets a human through untouched.
 */
function requireStageForClips(
  project: FilmProject,
  origin: "human" | "agent",
): ActionResult | null {
  if (origin === "human") return null;
  if (agentMayPlaceClips(project.file.process)) return null;

  const stage = currentStage(project.file.process);
  return fail(
    "stage-gated",
    `Clips come after the storyboard is approved. The process is at ${stage ? STAGE_LABELS[stage] : "the end"}${stage ? ` — ${nextInstruction(project.file.process).instruction}` : ""}`,
  );
}

/**
 * The timing lock, for agents only.
 *
 * Once the animatic is approved, a visual clip an agent places or moves must
 * sit inside one locked beat. Filling a slot is the build; moving a slot is a
 * decision the person makes, in the Process panel, by reopening the animatic.
 */
function requireInsideBeats(
  project: FilmProject,
  clip: Clip,
  origin: "human" | "agent",
): ActionResult | null {
  if (origin === "human") return null;
  if (fitsLockedBeats(project.file.process, clip)) return null;

  const beats = project.file.process.animatic.beats
    .map((beat) => `${beat.label || beat.id} ${beat.from}–${beat.from + beat.durationInFrames}`)
    .join(", ");
  return fail(
    "timing-locked",
    `Timing is locked: the animatic was approved, and a visual clip has to sit inside one of its beats. Frames ${clip.from}–${clip.from + clip.durationInFrames} do not. Beats: ${beats}. To change the timing itself, ask the person to reopen the animatic.`,
  );
}

/**
 * A locked track refuses edits.
 *
 * The lock exists so a person can protect work while an agent is rearranging
 * things around it, which only means anything if the agent's tools respect it
 * too. Refusing with the track named is more useful than silently skipping.
 */
function requireUnlocked(track: Track): ActionResult | null {
  if (!track.locked) return null;
  return fail(
    "locked",
    `Track “${track.name}” is locked. The person has to unlock it before anything on it can change.`,
  );
}

function withActivity(
  project: FilmProject,
  event: Omit<ActivityEvent, "id" | "at">,
): FilmProject {
  return {
    ...project,
    activity: [
      ...project.activity,
      { ...event, id: `ev-${project.activity.length + 1}`, at: nowTimecode() },
    ].slice(-200),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Only what the film IS reaches the file. Selection and history stay in the tab. */
export function toProjectFile(project: FilmProject): ProjectFile {
  return project.file;
}

const WRITE_DEBOUNCE_MS = 350;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writePending: Promise<void> | null = null;

/**
 * Queue a write of the current project.
 *
 * Debounced because dragging a clip emits a commit per pointer move, and that
 * file may be open in the agent's editor. The trailing write always carries the
 * latest state, so coalescing loses nothing.
 */
function schedulePersist(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writePending = persistNow();
  }, WRITE_DEBOUNCE_MS);
}

async function persistNow(): Promise<void> {
  const { project, workspace } = useStudioStore.getState();
  if (!project || workspace.kind !== "linked") return;

  const written = await writeProjectFile(
    workspace.workspace,
    project.slug,
    project.file,
  );

  if (!written.ok) {
    useStudioStore.getState().setLoadError(written.message);
    return;
  }

  // Our own write moves the mtime. Record it, or the next poll reads the file
  // back as an external change and announces the person's own edit to them.
  useStudioStore.setState({
    loadedAt: await modifiedAt(workspace.workspace, project.slug),
  });
}

/**
 * Force the queue and wait for it. Every tool executor awaits this before
 * returning, so an agent told a change landed can immediately read the file
 * back and find it there (invariant 3, extended to disk).
 */
export async function flushWrites(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    writePending = persistNow();
  }
  await writePending;
}

/**
 * Apply a pure edit, validate the whole composition, commit and persist.
 *
 * Rejecting here means a bad drag or a bad tool call leaves the board untouched
 * rather than writing a file the app could not read back. `fitDuration` runs
 * first so placing a clip past the end lengthens the film instead of failing a
 * bounds check the caller never asked about.
 */
function commit(
  project: FilmProject,
  next: ProjectFile,
  event: Omit<ActivityEvent, "id" | "at">,
): ActionResult | null {
  const grown = fitDuration(next);
  const parsed = ProjectFileSchema.safeParse(grown);
  if (!parsed.success) {
    return fail("graph-invalid", explainZodError(parsed.error));
  }

  const updated = FilmProjectSchema.safeParse(
    withActivity({ ...project, file: parsed.data }, event),
  );
  if (!updated.success) {
    return fail("graph-invalid", explainZodError(updated.error));
  }

  useStudioStore
    .getState()
    .setProject(updated.data, useStudioStore.getState().loadedAt);
  schedulePersist();
  return null;
}

// ---------------------------------------------------------------------------
// The workspace
// ---------------------------------------------------------------------------

export async function restoreWorkspace(): Promise<void> {
  const { setWorkspace } = useStudioStore.getState();

  if (!canLinkFolder()) {
    setWorkspace({ kind: "unsupported" });
    return;
  }

  const root = await recallWorkspace();
  if (!root) {
    setWorkspace({ kind: "unlinked" });
    return;
  }

  if ((await checkPermission(root)) !== "granted") {
    setWorkspace({ kind: "needs-permission", root });
    return;
  }

  const resolved = await resolveWorkspace(root);
  if (!resolved.ok) {
    setWorkspace({ kind: "unlinked" });
    return;
  }

  setWorkspace({
    kind: "linked",
    workspace: resolved.value,
    projects: await listProjects(resolved.value),
  });
}

/** The picker. HUMAN ONLY — `showDirectoryPicker` requires a user gesture. */
export async function linkFolder(): Promise<ActionResult> {
  const linked = await linkWorkspace();
  if (!linked.ok) {
    if (linked.code === "cancelled") return ok("No folder chosen.");
    return fail("disk-error", linked.message);
  }

  const projects = await listProjects(linked.value);
  useStudioStore
    .getState()
    .setWorkspace({ kind: "linked", workspace: linked.value, projects });

  /*
   * Land somewhere useful rather than on a menu.
   *
   * An empty folder gets a blank composition made for it: there is nothing to
   * choose between and nothing we need to ask, so asking is pure friction.
   * A folder with exactly one gets that one opened, for the same reason. Only
   * a folder with several actually poses a question worth putting to someone.
   */
  if (projects.length === 0) {
    await createBlankProject();
    return ok(`Linked ${WORKSPACE_DIR}/ and started a blank composition.`);
  }

  const only = projects.length === 1 ? projects[0] : undefined;
  if (only && only.problem === null && only.name !== null) {
    await openProject(only.slug);
  }

  return ok(
    `Linked. Found ${projects.length} composition${projects.length === 1 ? "" : "s"}.`,
  );
}

/** Re-grant permission on a folder we remember. HUMAN ONLY, same reason. */
export async function regrantWorkspace(): Promise<ActionResult> {
  const { workspace } = useStudioStore.getState();
  if (workspace.kind !== "needs-permission") {
    return fail("no-workspace", "Nothing to re-open.");
  }

  if ((await requestPermission(workspace.root)) !== "granted") {
    return fail("disk-error", "Permission refused.");
  }

  await restoreWorkspace();
  return ok("Folder re-opened.");
}

export async function unlinkFolder(): Promise<ActionResult> {
  await forgetWorkspace();
  useStudioStore.getState().closeProject();
  useStudioStore.getState().setWorkspace({ kind: "unlinked" });
  return ok("Folder unlinked. Nothing on disk was touched.");
}

export async function refreshProjects(): Promise<ActionResult> {
  const guard = requireWorkspace();
  if (!guard.ok) return guard.result;

  const projects = await listProjects(guard.value);
  useStudioStore.getState().setProjects(projects);
  return ok(
    `${projects.length} composition${projects.length === 1 ? "" : "s"} in ${WORKSPACE_DIR}/.`,
  );
}

// ---------------------------------------------------------------------------
// Opening, creating, syncing
// ---------------------------------------------------------------------------

/**
 * Turn the paths clips refer to into object URLs the renderer can use.
 *
 * Re-run after every load and every reload from disk, because a clip may now
 * point at a file that has appeared or vanished. Missing paths are reported
 * rather than thrown: a renamed image should leave a hole in one frame, not
 * take the whole composition down.
 */
async function refreshAssets(workspace: Workspace, slug: string, file: ProjectFile) {
  const wanted = referencedAssets(file);
  const { urls, missing } = await loadAssets(workspace, slug, wanted);
  useStudioStore.getState().setAssets(urls, missing);
}

export async function openProject(slug: string): Promise<ActionResult> {
  const guard = requireWorkspace();
  if (!guard.ok) return guard.result;

  const parsedSlug = SlugSchema.safeParse(slug);
  if (!parsedSlug.success) {
    return fail("invalid-input", explainZodError(parsedSlug.error));
  }

  const read = await readProjectFile(guard.value, parsedSlug.data);
  if (!read.ok) {
    useStudioStore.getState().setLoadError(read.message);
    return fail("disk-error", read.message);
  }

  const project: FilmProject = {
    file: read.value.file,
    slug: parsedSlug.data,
    selectedId: null,
    activity: [
      {
        id: "ev-1",
        origin: "disk",
        label: "Opened from folder",
        detail: `${WORKSPACE_DIR}/${parsedSlug.data}/project.json`,
        at: nowTimecode(),
      },
    ],
  };

  useStudioStore.getState().setProject(project, read.value.modifiedAt);
  useStudioStore.getState().setPendingRender(null);
  useStudioStore.getState().setPlayhead(0);
  await refreshAssets(guard.value, parsedSlug.data, read.value.file);

  const clips = read.value.file.tracks.reduce(
    (total, track) => total + track.clips.length,
    0,
  );
  return ok(
    `Opened “${read.value.file.name}”: ${read.value.file.tracks.length} tracks, ${clips} clips, ${(read.value.file.durationInFrames / read.value.file.fps).toFixed(1)}s.`,
  );
}

export type CreateProjectInputs = {
  slug: string;
  name: string;
  durationInFrames?: number;
  width?: number;
  height?: number;
  fps?: number;
  background?: Background;
};

/**
 * Create the folder and write an empty composition.
 *
 * Empty means empty: a background, one visual track, one audio track, no clips
 * and no runtime. The app has no model and writes no content — the two tracks
 * exist only so there is somewhere obvious to drop the first thing.
 */
export async function createProject(
  inputs: CreateProjectInputs,
): Promise<ActionResult> {
  const guard = requireWorkspace();
  if (!guard.ok) return guard.result;

  const parsedSlug = SlugSchema.safeParse(inputs.slug);
  if (!parsedSlug.success) {
    return fail("invalid-input", explainZodError(parsedSlug.error));
  }
  const slug = parsedSlug.data;

  if (await projectExists(guard.value, slug)) {
    return fail(
      "invalid-input",
      `${WORKSPACE_DIR}/${slug}/ already exists. Open it with prism.open_project, or choose another name.`,
    );
  }

  const fps = inputs.fps ?? DEFAULT_FPS;
  const draft: ProjectFile = {
    version: PROJECT_FILE_VERSION,
    name: inputs.name,
    width: inputs.width ?? DEFAULT_WIDTH,
    height: inputs.height ?? DEFAULT_HEIGHT,
    fps,
    /*
     * One frame — as close to zero as a composition can be.
     *
     * Not a default length someone has to trim back afterwards: `fitDuration`
     * grows the film whenever a clip lands past the end, so the duration is
     * always exactly as long as what is in it unless somebody sets it
     * deliberately. Asking a person to guess how long their video will be
     * before they have made any of it is a question with no good answer.
     */
    durationInFrames: inputs.durationInFrames ?? 1,
    background: inputs.background ?? { kind: "solid", color: "#0A0A0C" },
    process: structuredClone(EMPTY_PROCESS),
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

  const checked = ProjectFileSchema.safeParse(draft);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const written = await writeProjectFile(guard.value, slug, checked.data);
  if (!written.ok) return fail("disk-error", written.message);

  await refreshProjects();
  await openProject(slug);

  return ok(
    `Created ${WORKSPACE_DIR}/${slug}/project.json — an empty canvas with one visual track and one audio track, ${checked.data.width}×${checked.data.height} at ${fps}fps. It has no runtime yet; it grows as you place clips. Add them with prism.add_text and friends, or edit the file directly — the app is watching it.`,
  );
}

/** Folder names already in use, so a new one does not collide. */
function takenSlugs(): string[] {
  const { workspace } = useStudioStore.getState();
  return workspace.kind === "linked"
    ? workspace.projects.map((entry) => entry.slug)
    : [];
}

const UNTITLED = "Untitled composition";

/**
 * A new composition, with nothing asked of anyone.
 *
 * Naming a thing before making it is the wrong order — you find out what it is
 * by building it. So this creates and opens straight away, and the name is
 * changed in the title bar afterwards; the folder follows when it is.
 */
export async function createBlankProject(): Promise<ActionResult> {
  const guard = requireWorkspace();
  if (!guard.ok) return guard.result;

  return createProject({
    slug: slugForName(UNTITLED, takenSlugs()) ?? "untitled",
    name: UNTITLED,
  });
}

/**
 * Re-read the file and adopt it if it changed underneath us.
 *
 * This is what makes the agent's own editor a first-class way to work: it
 * writes project.json, and the timeline updates without anyone calling a tool.
 * Selection, playhead and the session log survive, because those describe the
 * tab rather than the film.
 */
export async function reloadFromDisk(): Promise<ActionResult> {
  const workspaceGuard = requireWorkspace();
  if (!workspaceGuard.ok) return workspaceGuard.result;
  const projectGuard = requireProject();
  if (!projectGuard.ok) return projectGuard.result;

  const current = projectGuard.value;
  const read = await readProjectFile(workspaceGuard.value, current.slug);

  if (!read.ok) {
    useStudioStore.getState().setLoadError(read.message);
    return fail("disk-error", read.message);
  }

  const next = withActivity(
    { ...current, file: read.value.file },
    {
      origin: "disk",
      label: "Reloaded from folder",
      detail: "project.json changed outside the app",
    },
  );

  const parsed = FilmProjectSchema.safeParse(next);
  if (!parsed.success) {
    const message = explainZodError(parsed.error);
    useStudioStore.getState().setLoadError(message);
    return fail("graph-invalid", message);
  }

  useStudioStore.getState().setProject(parsed.data, read.value.modifiedAt);
  useStudioStore.getState().setLoadError(null);
  await refreshAssets(workspaceGuard.value, current.slug, read.value.file);
  return ok("Reloaded from the folder.");
}

/**
 * Poll for an external edit. Cheap — one `getFile()` and an mtime compare, with
 * no read of the contents unless something moved.
 */
export async function checkForDiskChanges(): Promise<boolean> {
  const { workspace, project, loadedAt } = useStudioStore.getState();
  if (workspace.kind !== "linked" || !project) return false;

  const at = await modifiedAt(workspace.workspace, project.slug);
  if (at === 0 || at === loadedAt) return false;

  await reloadFromDisk();
  return true;
}

export function closeProject(): ActionResult {
  useStudioStore.getState().closeProject();
  return ok("Closed the composition. The folder is untouched.");
}

/**
 * Delete a composition's folder, permanently.
 *
 * HUMAN ONLY, and deliberately never registered as a WebMCP tool. This is the
 * one action here that destroys work that cannot be recovered — there is no
 * trash to move it to, `removeEntry` is final, and the folder may hold renders
 * that took minutes to encode. An agent that misread an instruction should not
 * be able to reach it, for the same structural reason it cannot accept its own
 * drafts: the function exists, and nothing exposes it.
 *
 * Afterwards, open whatever else is there rather than leaving a dead editor
 * on screen. If nothing is left the start screen takes over, which is right —
 * a person who just deleted their only composition should see the folder's
 * real state, not have another one silently made for them.
 */
export async function deleteProject(slug: string): Promise<ActionResult> {
  const guard = requireWorkspace();
  if (!guard.ok) return guard.result;

  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  // Nothing queued may land in a folder that is about to stop existing.
  await flushWrites();

  try {
    await guard.value.dir.removeEntry(parsed.data, { recursive: true });
  } catch {
    return fail(
      "disk-error",
      `Could not delete ${WORKSPACE_DIR}/${parsed.data}/. It may be open in another program.`,
    );
  }

  const open = useStudioStore.getState().project;
  if (open?.slug === parsed.data) useStudioStore.getState().closeProject();

  await refreshProjects();

  const remaining = takenSlugs();
  const next = remaining[0];
  if (open?.slug === parsed.data && next) await openProject(next);

  return ok(`Deleted ${WORKSPACE_DIR}/${parsed.data}/ and everything in it.`);
}

// ---------------------------------------------------------------------------
// Selection, playhead, zoom — tab state, safe for agents
// ---------------------------------------------------------------------------

export function select(id: string | null): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  useStudioStore
    .getState()
    .setProject({ ...guard.value, selectedId: id }, useStudioStore.getState().loadedAt);
  return ok(id ? `Selected ${id}.` : "Cleared the selection.");
}

/** Move the playhead, which is also what the preview shows. */
export function seek(frame: number): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  const clamped = Math.min(
    Math.max(0, Math.round(frame)),
    guard.value.file.durationInFrames,
  );
  useStudioStore.getState().setPlayhead(clamped);
  return ok(
    `Playhead at ${(clamped / guard.value.file.fps).toFixed(2)}s (frame ${clamped}).`,
  );
}

export function setPlaying(playing: boolean): ActionResult {
  useStudioStore.getState().setPlaying(playing);
  return ok(playing ? "Playing." : "Paused.");
}

export function setZoom(pixelsPerSecond: number): void {
  useStudioStore.getState().setZoom(pixelsPerSecond);
}

export function toggleSnap(): void {
  const { snap, setSnap } = useStudioStore.getState();
  setSnap(!snap);
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export function createTrack(kind: TrackKind, name?: string): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const existing = project.file.tracks.filter(
    (track) => track.kind === kind,
  ).length;
  const label =
    name ?? (kind === "audio" ? `Audio ${existing + 1}` : `Layer ${existing + 1}`);

  const { file, track } = addTrack(project.file, kind, label);
  const rejected = commit(project, file, {
    origin: "human",
    label: "Added track",
    detail: label,
  });
  if (rejected) return rejected;

  select(track.id);
  return ok(`Added ${kind} track “${label}” (${track.id}).`);
}

export function deleteTrack(trackId: string): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const track = findTrack(project.file, trackId);
  if (!track) return fail("not-found", `No track "${trackId}".`);

  const locked = requireUnlocked(track);
  if (locked) return locked;

  const rejected = commit(project, removeTrack(project.file, trackId), {
    origin: "human",
    label: "Deleted track",
    detail: `${track.name} · ${track.clips.length} clips`,
  });
  if (rejected) return rejected;

  if (project.selectedId === trackId) select(null);
  return ok(`Deleted “${track.name}” and its ${track.clips.length} clips.`);
}

export function patchTrack(
  trackId: string,
  patch: Partial<Omit<Track, "id" | "kind" | "clips">>,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const track = findTrack(project.file, trackId);
  if (!track) return fail("not-found", `No track "${trackId}".`);

  // The lock itself is always changeable — otherwise locking a track would be
  // a one-way door.
  if (track.locked && !("locked" in patch)) {
    const locked = requireUnlocked(track);
    if (locked) return locked;
  }

  const rejected = commit(project, updateTrack(project.file, trackId, patch), {
    origin: "human",
    label: "Changed track",
    detail: `${track.name} · ${Object.keys(patch).join(", ")}`,
  });
  if (rejected) return rejected;

  return ok(`Updated “${track.name}”.`);
}

export function shiftTrack(trackId: string, direction: -1 | 1): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const next = moveTrack(project.file, trackId, direction);
  if (next === project.file) {
    return ok("Already at the end of its group.");
  }

  const rejected = commit(project, next, {
    origin: "human",
    label: direction === -1 ? "Moved track forward" : "Moved track back",
    detail: findTrack(project.file, trackId)?.name ?? trackId,
  });
  if (rejected) return rejected;

  return ok("Reordered.");
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

/**
 * Put a clip on a track.
 *
 * The id is minted here rather than taken from the caller, so an agent cannot
 * collide with something already in the file, and the id it gets back is the
 * one to use for every later edit.
 */
export function createClip(
  trackId: string,
  clip: Omit<Clip, "id">,
  origin: "human" | "agent" = "human",
  note?: string,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const track = findTrack(project.file, trackId);
  if (!track) return fail("not-found", `No track "${trackId}".`);

  const locked = requireUnlocked(track);
  if (locked) return locked;

  const gated = requireStageForClips(project, origin);
  if (gated) return gated;

  const parsed = ClipSchema.safeParse({
    ...clip,
    id: mintId(clip.kind),
    // Agent work always arrives as a draft. There is no argument that makes
    // this accept.
    approval: origin === "agent" ? "draft" : "accepted",
    ...(origin === "agent" && note ? { revisionNote: note } : {}),
  });
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  const outside = requireInsideBeats(project, parsed.data, origin);
  if (outside) return outside;

  const rejected = commit(project, addClip(project.file, trackId, parsed.data), {
    origin,
    label: origin === "agent" ? "prism.add_clip" : "Added clip",
    detail: note ?? `${parsed.data.kind} on ${track.name}`,
  });
  if (rejected) return rejected;

  select(parsed.data.id);
  return ok(
    `Added ${parsed.data.kind} clip ${parsed.data.id} to “${track.name}” at frame ${parsed.data.from}${origin === "agent" ? " — it is a draft for the person to accept" : ""}.`,
  );
}

export function deleteClip(clipId: string): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const found = findClip(project.file, clipId);
  if (!found) return fail("not-found", `No clip "${clipId}".`);

  const locked = requireUnlocked(found.track);
  if (locked) return locked;

  const rejected = commit(project, removeClip(project.file, clipId), {
    origin: "human",
    label: "Deleted clip",
    detail: `${found.clip.kind} on ${found.track.name}`,
  });
  if (rejected) return rejected;

  if (project.selectedId === clipId) select(null);
  return ok("Deleted.");
}

export function patchClip(
  clipId: string,
  patch: Partial<Clip>,
  origin: "human" | "agent" = "human",
  note?: string,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const found = findClip(project.file, clipId);
  if (!found) return fail("not-found", `No clip "${clipId}".`);

  const locked = requireUnlocked(found.track);
  if (locked) return locked;

  const merged = {
    ...found.clip,
    ...patch,
    ...(origin === "agent"
      ? { approval: "draft" as const, revisionNote: note ?? "Changed by your agent" }
      : {}),
  };

  const parsed = ClipSchema.safeParse(merged);
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  // Only a timing change can break the lock; a colour change never does.
  if ("from" in patch || "durationInFrames" in patch) {
    const outside = requireInsideBeats(project, parsed.data, origin);
    if (outside) return outside;
  }

  const rejected = commit(
    project,
    updateClip(project.file, clipId, parsed.data),
    {
      origin,
      label: origin === "agent" ? "prism.update_clip" : "Edited clip",
      detail: note ?? Object.keys(patch).join(", "),
    },
  );
  if (rejected) return rejected;

  return ok(origin === "agent" ? "Proposed a change — it is a draft." : "Updated.");
}

/** Drag along the timeline, or across to another track. */
export function dragClip(
  clipId: string,
  toTrackId: string,
  from: number,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const found = findClip(project.file, clipId);
  if (!found) return fail("not-found", `No clip "${clipId}".`);

  const locked = requireUnlocked(found.track);
  if (locked) return locked;

  const rejected = commit(
    project,
    moveClip(project.file, clipId, toTrackId, from),
    { origin: "human", label: "Moved clip", detail: `${found.clip.kind}` },
  );
  if (rejected) return rejected;

  return ok("Moved.");
}

export function dragClipEdge(
  clipId: string,
  edge: "start" | "end",
  frame: number,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const found = findClip(project.file, clipId);
  if (!found) return fail("not-found", `No clip "${clipId}".`);

  const locked = requireUnlocked(found.track);
  if (locked) return locked;

  const rejected = commit(
    project,
    trimClip(project.file, clipId, edge, frame),
    { origin: "human", label: "Trimmed clip", detail: edge },
  );
  if (rejected) return rejected;

  return ok("Trimmed.");
}

/** Cut the selected clip at the playhead. The classic timeline verb. */
export function splitAtPlayhead(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const { playhead } = useStudioStore.getState();
  const id = project.selectedId;
  if (!id) return fail("not-found", "Select a clip to split.");

  const found = findClip(project.file, id);
  if (!found) return fail("not-found", "Select a clip to split.");

  const locked = requireUnlocked(found.track);
  if (locked) return locked;

  const result = splitClip(project.file, id, playhead);
  if (!result) {
    return fail(
      "invalid-input",
      "The playhead is not inside the clip, or one half would be too short.",
    );
  }

  const rejected = commit(project, result.file, {
    origin: "human",
    label: "Split clip",
    detail: `at frame ${playhead}`,
  });
  if (rejected) return rejected;

  select(result.newClipId);
  return ok("Split.");
}

export function duplicateSelected(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const id = project.selectedId;
  if (!id) return fail("not-found", "Select a clip to duplicate.");

  const result = duplicateClip(project.file, id);
  if (!result) {
    return fail("invalid-input", "No room after that clip on its track.");
  }

  const rejected = commit(project, result.file, {
    origin: "human",
    label: "Duplicated clip",
    detail: id,
  });
  if (rejected) return rejected;

  select(result.newClipId);
  return ok("Duplicated.");
}

// ---------------------------------------------------------------------------
// The process — the agent submits, the person decides
// ---------------------------------------------------------------------------

type StagePatch<S extends StageId> = Partial<Omit<Process[S], "status" | "note">>;

/**
 * An agent submitting a stage's artifact.
 *
 * Refuses unless every earlier stage is approved — that is the whole point.
 * Resubmitting a stage the person sent back is allowed, and clears their note
 * so the panel does not keep showing feedback that has been acted on.
 */
async function submitStage<S extends StageId>(
  stage: S,
  artifact: StagePatch<S>,
  summary: string | undefined,
): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;
  const process = project.file.process;

  if (!previousApproved(process, stage)) {
    const current = currentStage(process) ?? stage;
    return fail(
      "stage-gated",
      `${STAGE_LABELS[stage]} comes after ${STAGE_LABELS[current]}, which is not approved yet. ${nextInstruction(process).instruction}`,
    );
  }

  if (process[stage].status === "approved") {
    return fail(
      "stage-gated",
      `${STAGE_LABELS[stage]} is already approved. To change it, ask the person to reopen it in the Process panel.`,
    );
  }

  const next: Process = {
    ...process,
    [stage]: {
      ...process[stage],
      ...artifact,
      status: "submitted" as const,
      ...(summary ? { summary } : {}),
      note: undefined,
    },
  };

  const checked = ProcessSchema.safeParse(next);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const rejected = commit(
    project,
    { ...project.file, process: checked.data },
    {
      origin: "agent",
      label: `prism.submit_${stage}`,
      detail: summary ?? `Submitted ${STAGE_LABELS[stage].toLowerCase()}`,
    },
  );
  if (rejected) return rejected;

  await flushWrites();
  return ok(
    `${STAGE_LABELS[stage]} submitted. It is waiting for the person in the Process panel — do not move on until they approve it.`,
  );
}

export function submitBrief(
  artifact: StagePatch<"brief">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("brief", artifact, summary);
}

export function submitConcepts(
  artifact: StagePatch<"concept">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("concept", artifact, summary);
}

export function submitScript(
  artifact: StagePatch<"script">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("script", artifact, summary);
}

export function submitStoryboard(
  artifact: StagePatch<"storyboard">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("storyboard", artifact, summary);
}

/** The track `layAnimatic` writes to, found or made. */
const BOARDS_TRACK = "Boards";

/**
 * Put the approved storyboard on the timeline as placeholders.
 *
 * One text clip per panel, at cumulative frames from the panels' durations,
 * carrying the panel's words and transitions, labelled by its beat. The
 * agent wrote every one of those values; what this adds is the arithmetic —
 * which is exactly the part an agent hand-computing frame offsets across nine
 * panels gets wrong, and the reason the method says the animatic is free in
 * this tool.
 *
 * The clips land `accepted`, not `draft`. They are a transcription of an
 * artifact the person already approved, and making them click through nine
 * accept buttons to reach the animatic they are about to review would be the
 * process getting in its own way. The animatic approval is the decision.
 *
 * Re-running replaces the Boards track's clips, so a storyboard sent back and
 * resubmitted can be re-laid without hand-deleting the old placeholders.
 */
export async function layAnimatic(): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;
  const { process } = project.file;

  if (!isApprovedStage(process, "storyboard")) {
    return fail(
      "stage-gated",
      `The storyboard is not approved yet — there is nothing to lay. ${nextInstruction(process).instruction}`,
    );
  }
  if (timingLocked(process)) {
    return fail(
      "timing-locked",
      "The animatic is already approved and the timing is locked. Ask the person to reopen it before re-laying the boards.",
    );
  }

  const panels = process.storyboard.panels;
  if (panels.length === 0) {
    return fail("invalid-input", "The storyboard has no panels.");
  }

  let cursor = 0;
  const clips: Clip[] = panels.map((panel) => {
    const clip = boardClip(panel, cursor);
    cursor += panel.durationInFrames;
    return clip;
  });

  let file = project.file;
  let track = file.tracks.find(
    (candidate) => candidate.kind === "visual" && candidate.name === BOARDS_TRACK,
  );
  if (!track) {
    const added = addTrack(file, "visual", BOARDS_TRACK);
    file = added.file;
    track = added.track;
  }

  const boardsId = track.id;
  file = {
    ...file,
    tracks: file.tracks.map((candidate) =>
      candidate.id === boardsId ? { ...candidate, clips } : candidate,
    ),
  };

  // The boards are the film's extent now. A blank composition may have been
  // created longer than the storyboard runs, and thirty frames of dead tail
  // behind the last board is not a beat anyone approved. Trimming considers
  // every track, so a music bed already placed keeps the length it needs.
  file = trimToContent(file);

  const rejected = commit(project, file, {
    origin: "agent",
    label: "prism.lay_animatic",
    detail: `${clips.length} boards on the timeline · ${(cursor / project.file.fps).toFixed(1)}s`,
  });
  if (rejected) return rejected;

  await flushWrites();
  return ok(
    `Laid ${clips.length} boards on the “${BOARDS_TRACK}” track, ${(cursor / project.file.fps).toFixed(1)}s end to end. Now add the music with prism.add_audio — startFrom on a downbeat — adjust any board to the beat grid, and call prism.submit_animatic.`,
  );
}

/** A placeholder clip from a panel: its words, its transitions, its slot. */
function boardClip(panel: StoryboardPanel, from: number): Clip {
  return {
    kind: "text",
    id: mintId("board"),
    from,
    durationInFrames: panel.durationInFrames,
    approval: "accepted",
    label: panel.label,
    revisionNote: `Board: ${panel.frame}`,
    text: panel.words?.trim() || panel.label,
    fontSize: 0.07,
    fontFamily: "mono",
    fontWeight: 400,
    color: "#F7F8F899",
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    box: { x: 0.5, y: 0.47, width: 0.8, height: 0.3, rotation: 0, opacity: 1 },
    animation: {
      enter: panel.transitionIn,
      exit: panel.transitionOut,
      enterFrames: 10,
      exitFrames: 6,
    },
  };
}

function isApprovedStage(process: Process, stage: StageId): boolean {
  return process[stage].status === "approved";
}

/**
 * The animatic's artifact is the timeline itself, so this checks that there
 * is one: at least one visual clip per storyboard panel, and music underneath.
 */
export async function submitAnimatic(summary?: string): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { file } = guard.value;

  const visual = file.tracks
    .filter((track) => track.kind === "visual")
    .reduce((n, track) => n + track.clips.length, 0);
  const audio = file.tracks
    .filter((track) => track.kind === "audio")
    .reduce((n, track) => n + track.clips.length, 0);
  const panels = file.process.storyboard.panels.length;

  if (visual === 0) {
    return fail(
      "invalid-input",
      "The animatic is the timeline, and the timeline is empty. Call prism.lay_animatic to put the approved boards on it first.",
    );
  }
  if (panels > 0 && visual < panels) {
    return fail(
      "invalid-input",
      `The storyboard has ${panels} panels but the timeline has ${visual} visual clip${visual === 1 ? "" : "s"}. prism.lay_animatic puts one placeholder per panel; then submit.`,
    );
  }

  const note =
    audio === 0
      ? " There is no music on the timeline — the method locks timing to the music, so the person may send this back."
      : "";

  const result = await submitStage("animatic", {}, summary);
  return result.ok ? ok(result.message + note) : result;
}

export function submitStyleFrames(
  artifact: StagePatch<"style">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("style", artifact, summary);
}

export function submitBuild(summary?: string): Promise<ActionResult> {
  return submitStage("build", {}, summary);
}

export function submitSound(
  artifact: StagePatch<"sound">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("sound", artifact, summary);
}

export function submitPolish(
  artifact: StagePatch<"polish">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("polish", artifact, summary);
}

/**
 * HUMAN ONLY. Approve a stage — and for the animatic, lock the timing.
 *
 * Never a tool, for the same reason accepting a clip is not: the whole process
 * is the agent proposing and a person deciding. A person can approve anything
 * in any order; skipping a stage is their call.
 */
export function approveStage(
  stage: StageId,
  extra: { chosen?: string } = {},
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;
  const process = project.file.process;

  const next: Process = {
    ...process,
    [stage]: {
      ...process[stage],
      status: "approved" as const,
      note: undefined,
      ...(stage === "animatic" ? { beats: snapshotBeats(project.file) } : {}),
      ...(stage === "concept" && extra.chosen ? { chosen: extra.chosen } : {}),
    },
  };

  const checked = ProcessSchema.safeParse(next);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const rejected = commit(
    project,
    { ...project.file, process: checked.data },
    {
      origin: "human",
      label: `Approved ${STAGE_LABELS[stage].toLowerCase()}`,
      detail:
        stage === "animatic"
          ? `Timing locked: ${checked.data.animatic.beats.length} beats`
          : (extra.chosen ?? ""),
    },
  );
  if (rejected) return rejected;

  return ok(
    stage === "animatic"
      ? `Animatic approved. Timing is locked across ${checked.data.animatic.beats.length} beats.`
      : `${STAGE_LABELS[stage]} approved.`,
  );
}

/** HUMAN ONLY. Send a stage back with a note the agent will read. */
export function requestChanges(stage: StageId, note: string): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const trimmed = note.trim();
  if (!trimmed) return fail("invalid-input", "Say what should change.");

  const next: Process = {
    ...project.file.process,
    [stage]: {
      ...project.file.process[stage],
      status: "changes-requested" as const,
      note: trimmed,
      // Reopening the animatic unlocks the timing; the beats are re-snapshotted
      // on the next approval.
      ...(stage === "animatic" ? { beats: [] } : {}),
    },
  };

  const checked = ProcessSchema.safeParse(next);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const rejected = commit(
    project,
    { ...project.file, process: checked.data },
    {
      origin: "human",
      label: `Sent ${STAGE_LABELS[stage].toLowerCase()} back`,
      detail: trimmed,
    },
  );
  if (rejected) return rejected;

  return ok(`${STAGE_LABELS[stage]} sent back.`);
}

/**
 * HUMAN ONLY. Reopen an approved stage.
 *
 * The escape hatch the method calls "surface it as a decision": timing is
 * locked, and the only way to move a beat is for the person to say so here.
 * Later stages are left as they are — the person decides what else to redo.
 */
export function reopenStage(stage: StageId): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const next: Process = {
    ...project.file.process,
    [stage]: {
      ...project.file.process[stage],
      status: "pending" as const,
      note: undefined,
      ...(stage === "animatic" ? { beats: [] } : {}),
    },
  };

  const checked = ProcessSchema.safeParse(next);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const rejected = commit(
    project,
    { ...project.file, process: checked.data },
    {
      origin: "human",
      label: `Reopened ${STAGE_LABELS[stage].toLowerCase()}`,
      detail: stage === "animatic" ? "Timing unlocked" : "",
    },
  );
  if (rejected) return rejected;

  return ok(
    stage === "animatic"
      ? "Animatic reopened. Timing is unlocked until it is approved again."
      : `${STAGE_LABELS[stage]} reopened.`,
  );
}

// ---------------------------------------------------------------------------
// Composition settings
// ---------------------------------------------------------------------------

export function setBackground(background: Background): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const rejected = commit(
    project,
    { ...project.file, background },
    { origin: "human", label: "Changed background", detail: background.kind },
  );
  if (rejected) return rejected;

  return ok(`Background is now a ${background.kind}.`);
}

export function setDuration(frames: number): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const clamped = Math.min(MAX_FRAMES, Math.max(1, Math.round(frames)));
  const rejected = commit(
    project,
    { ...project.file, durationInFrames: clamped },
    {
      origin: "human",
      label: "Changed duration",
      detail: `${(clamped / project.file.fps).toFixed(1)}s`,
    },
  );
  if (rejected) return rejected;

  return ok(`Composition is ${(clamped / project.file.fps).toFixed(1)}s.`);
}

export function fitDurationToContent(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const next = trimToContent(project.file);
  const rejected = commit(project, next, {
    origin: "human",
    label: "Trimmed composition",
    detail: `${(next.durationInFrames / project.file.fps).toFixed(1)}s`,
  });
  if (rejected) return rejected;

  return ok(`Trimmed to ${(next.durationInFrames / project.file.fps).toFixed(1)}s.`);
}

/**
 * Rename the composition, and its folder with it.
 *
 * The folder is what someone sees in Finder, so it has to say what the thing
 * is — a composition called "First video" sitting in `untitled/` is a filing
 * system that lies to you.
 *
 * The name always changes; the folder follows when it can. If the move fails —
 * a permission dropped, a name already taken — the composition keeps working
 * under its old folder and the person is told the folder did not follow. The
 * two are allowed to disagree, because refusing the rename over a filesystem
 * problem would be the wrong thing to protect.
 */
export async function renameProject(name: string): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const trimmed = name.trim();
  if (!trimmed) return fail("invalid-input", "A composition needs a name.");
  if (trimmed === project.file.name) return ok("Unchanged.");

  const rejected = commit(
    project,
    { ...project.file, name: trimmed },
    { origin: "human", label: "Renamed", detail: trimmed },
  );
  if (rejected) return rejected;

  const workspaceGuard = requireWorkspace();
  const wanted = slugForName(
    trimmed,
    takenSlugs().filter((slug) => slug !== project.slug),
  );

  if (!workspaceGuard.ok || wanted === null || wanted === project.slug) {
    return ok(`Renamed to “${trimmed}”.`);
  }

  // Everything pending has to be on disk before the files move out from under
  // it, or the trailing write lands in a folder that no longer exists.
  await flushWrites();

  const moved = await renameProjectFolder(
    workspaceGuard.value,
    project.slug,
    wanted,
  );

  if (!moved.ok) {
    useStudioStore.getState().setLoadError(moved.message);
    return ok(
      `Renamed to “${trimmed}”, but the folder is still ${WORKSPACE_DIR}/${project.slug}/ — ${moved.message}`,
    );
  }

  const current = useStudioStore.getState().project;
  if (current) {
    useStudioStore
      .getState()
      .setProject(
        withActivity(
          { ...current, slug: wanted },
          {
            origin: "human",
            label: "Renamed folder",
            detail: `${WORKSPACE_DIR}/${wanted}/`,
          },
        ),
        0,
      );
  }

  // The move preserved the file's mtime but changed its path, so the poller's
  // baseline has to be re-read from the new location or the next tick sees a
  // change that never happened.
  useStudioStore.setState({
    loadedAt: await modifiedAt(workspaceGuard.value, wanted),
  });
  await refreshProjects();

  return ok(`Renamed to “${trimmed}” — now at ${WORKSPACE_DIR}/${wanted}/.`);
}

// ---------------------------------------------------------------------------
// The approval boundary — human only, never registered as a tool
// ---------------------------------------------------------------------------

function resolveDraft(clipId: string, accepted: boolean): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const found = findClip(project.file, clipId);
  if (!found) return fail("not-found", `No clip "${clipId}".`);
  if (found.clip.approval !== "draft") {
    return fail("no-draft", "That clip has no pending draft.");
  }

  // Rejecting removes it. There is no "previous version" to restore, because a
  // draft clip is either something the agent added — in which case undoing is
  // deletion — or something it changed, and the file on disk before the change
  // is the person's own git history. Pretending otherwise would need a second
  // copy of every clip.
  const next = accepted
    ? updateClip(project.file, clipId, {
        approval: "accepted",
        revisionNote: undefined,
      } as Partial<Clip>)
    : removeClip(project.file, clipId);

  const rejected = commit(project, next, {
    origin: "human",
    label: accepted ? "Accepted clip" : "Rejected clip",
    detail: found.clip.kind,
  });
  if (rejected) return rejected;

  return ok(accepted ? "Accepted." : "Removed the agent's clip.");
}

export function acceptClip(clipId: string): ActionResult {
  return resolveDraft(clipId, true);
}

export function rejectClip(clipId: string): ActionResult {
  return resolveDraft(clipId, false);
}

/**
 * Accept every pending draft at once.
 *
 * Reviewing clip by clip is the right default — that is the whole approval
 * boundary — but a person who has watched the film and likes it should not have
 * to click thirty times to say so. Still human-only, and still never a tool.
 */
export function acceptAllDrafts(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const drafts = project.file.tracks.flatMap((track) =>
    track.clips.filter((clip) => clip.approval === "draft"),
  );
  if (drafts.length === 0) return ok("Nothing is waiting for review.");

  let file = project.file;
  for (const clip of drafts) {
    file = updateClip(file, clip.id, {
      approval: "accepted",
      revisionNote: undefined,
    } as Partial<Clip>);
  }

  const rejected = commit(project, file, {
    origin: "human",
    label: "Accepted all drafts",
    detail: `${drafts.length} clips`,
  });
  if (rejected) return rejected;

  return ok(`Accepted ${drafts.length} clip${drafts.length === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------------
// Read model — what a WebMCP read tool returns
// ---------------------------------------------------------------------------

/** A stage's artifact without its bookkeeping, for the context dump. */
function strip<T extends { status: unknown; summary?: unknown; note?: unknown }>(
  stage: T,
): Omit<T, "status" | "summary" | "note"> {
  const { status, summary, note, ...artifact } = stage;
  void status;
  void summary;
  void note;
  return artifact;
}

export function getProjectContext() {
  const { workspace, project, loadError, playhead, missingAssets } =
    useStudioStore.getState();

  const workspaceSummary =
    workspace.kind === "linked"
      ? {
          linked: true as const,
          directory: WORKSPACE_DIR,
          compositions: workspace.projects.map((entry) => ({
            slug: entry.slug,
            name: entry.name,
            ...(entry.problem ? { problem: entry.problem } : {}),
          })),
        }
      : {
          linked: false as const,
          reason:
            workspace.kind === "unsupported"
              ? "This browser has no File System Access API. PrismLaunch needs Chrome or Edge."
              : workspace.kind === "needs-permission"
                ? "A folder is remembered but the browser dropped its permission. The person needs to click “Re-open folder”."
                : "Nobody has linked a folder yet. The person must click “Link project folder” — the browser only opens that picker for a real click.",
        };

  if (!project) {
    return {
      workspace: workspaceSummary,
      composition: null,
      ...(loadError ? { fileError: loadError } : {}),
    };
  }

  const { file } = project;
  const next = nextInstruction(file.process);

  return {
    workspace: workspaceSummary,
    /*
     * First, because it is what the agent should read first: where the
     * process is, what the person said, and what to do now. Everything below
     * is the material; this is the instruction.
     */
    process: {
      stage: next.stage,
      status: next.status,
      instruction: next.instruction,
      timingLocked: timingLocked(file.process),
      stages: Object.fromEntries(
        STAGES.map((stage) => {
          const state = file.process[stage];
          return [
            stage,
            {
              status: state.status,
              ...(state.summary ? { summary: state.summary } : {}),
              ...(state.note ? { personSaid: state.note } : {}),
            },
          ];
        }),
      ),
      artifacts: {
        brief: strip(file.process.brief),
        concept: strip(file.process.concept),
        script: strip(file.process.script),
        storyboard: strip(file.process.storyboard),
        animatic: { beats: file.process.animatic.beats },
        style: strip(file.process.style),
        sound: strip(file.process.sound),
        polish: strip(file.process.polish),
      },
    },
    composition: {
      slug: project.slug,
      path: `${WORKSPACE_DIR}/${project.slug}/project.json`,
      name: file.name,
      width: file.width,
      height: file.height,
      fps: file.fps,
      durationInFrames: file.durationInFrames,
      durationSeconds: Number((file.durationInFrames / file.fps).toFixed(2)),
      background: file.background,
      playheadFrame: playhead,
      selectedId: project.selectedId,
      ...(missingAssets.length > 0 ? { missingAssets } : {}),
      pendingDraftClipIds: file.tracks.flatMap((track) =>
        track.clips
          .filter((clip) => clip.approval === "draft")
          .map((clip) => clip.id),
      ),
      // Front to back, matching the timeline read top to bottom.
      tracks: file.tracks.map((track) => ({
        id: track.id,
        kind: track.kind,
        name: track.name,
        hidden: track.hidden,
        locked: track.locked,
        volume: track.volume,
        clips: track.clips.map((clip) => ({
          ...clip,
          endsAtFrame: clip.from + clip.durationInFrames,
        })),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// The render gate — two phases, and the agent can only take the first
// ---------------------------------------------------------------------------

type Proposal =
  | { ok: true; confirmationId: string; summary: string }
  | { ok: false; result: ActionResult };

async function proposeRenderOnServer(reason?: string): Promise<Proposal> {
  const guard = requireProject();
  if (!guard.ok) return { ok: false, result: guard.result };
  const project = guard.value;

  const drafts = project.file.tracks.flatMap((track) =>
    track.clips.filter((clip) => clip.approval === "draft"),
  );
  if (drafts.length > 0) {
    return {
      ok: false,
      result: fail(
        "invalid-input",
        `${drafts.length} clip${drafts.length === 1 ? " is" : "s are"} still an unreviewed draft. The person needs to accept or reject ${drafts.length === 1 ? "it" : "them"} first.`,
      ),
    };
  }

  let body: {
    ok: boolean;
    confirmationId?: string;
    summary?: string;
    message?: string;
  };
  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "propose", file: project.file, reason }),
    });
    body = await response.json();
  } catch {
    return {
      ok: false,
      result: fail("disk-error", "Could not reach the render service."),
    };
  }

  if (!body.ok || !body.confirmationId) {
    return {
      ok: false,
      result: fail("invalid-input", body.message ?? "Could not propose a render."),
    };
  }

  return {
    ok: true,
    confirmationId: body.confirmationId,
    summary: body.summary ?? "Render the composition.",
  };
}

export async function requestRender(reason?: string): Promise<ActionResult> {
  const proposal = await proposeRenderOnServer(reason);
  if (!proposal.ok) return proposal.result;

  const guard = requireProject();
  if (!guard.ok) return guard.result;

  useStudioStore.getState().setPendingRender({
    confirmationId: proposal.confirmationId,
    summary: proposal.summary,
    ...(reason ? { reason } : {}),
    available: true,
  });

  commit(guard.value, guard.value.file, {
    origin: "agent",
    label: "prism.request_render",
    detail: "Proposed a render — needs your confirmation",
    blocked: true,
  });

  return ok(
    `Nothing has been rendered. ${proposal.summary} A confirmation is now waiting in PrismLaunch — ask the person to approve it, then call prism.confirm_render with confirmationId "${proposal.confirmationId}".`,
  );
}

export async function confirmRender(
  confirmationId: string,
  onProgress?: (fraction: number) => void,
): Promise<ActionResult> {
  let response: Response;
  try {
    response = await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", confirmationId }),
    });
  } catch {
    return fail("disk-error", "Could not reach the render service.");
  }

  const body: { ok: boolean; message?: string; snapshot?: RenderSnapshot } =
    await response.json().catch(() => ({ ok: false }));

  if (!body.ok || !body.snapshot) {
    return fail("invalid-input", body.message ?? "The render could not start.");
  }

  const { renderFilmInBrowser, downloadBlob } = await import(
    "@/lib/render/web-render"
  );

  const { assets } = useStudioStore.getState();
  const outcome = await renderFilmInBrowser(body.snapshot, assets, (progress) =>
    onProgress?.(progress.progress),
  );

  if (!outcome.ok) return fail("invalid-input", outcome.message);

  useStudioStore.getState().setPendingRender(null);
  const megabytes = (outcome.blob.size / 1_000_000).toFixed(1);

  // Into the project's own folder, beside the file that describes it. The
  // downloads directory is where a video goes to be lost.
  const { workspace, project } = useStudioStore.getState();
  if (workspace.kind === "linked" && project) {
    const { writeRender } = await import("@/lib/workspace/fs");
    const saved = await writeRender(
      workspace.workspace,
      project.slug,
      outcome.filename,
      outcome.blob,
    );
    if (saved.ok) return ok(`Rendered ${megabytes} MB to ${saved.value}.`);
  }

  downloadBlob(outcome.blob, outcome.filename);
  return ok(
    `Rendered ${outcome.filename} (${megabytes} MB). The download has started.`,
  );
}

/**
 * Phase 2 — HUMAN ONLY, wired to the confirm sheet's button.
 *
 * Deliberately not exported through any tool. This is the click the whole gate
 * turns on.
 */
export async function approveRender(
  confirmationId: string,
): Promise<ActionResult> {
  try {
    await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve", confirmationId }),
    });
  } catch {
    return fail("disk-error", "Could not reach the render service.");
  }
  return ok("Render approved.");
}

export function dismissRenderRequest(): ActionResult {
  useStudioStore.getState().setPendingRender(null);
  return ok("Render request dismissed.");
}

/**
 * The human's own Export button.
 *
 * A person clicking Export *is* the approval, so this walks all three phases in
 * one go. It still goes through the same server gate rather than a shortcut
 * path — the snapshot is recorded, approved, and consumed exactly as it would
 * be for an agent-initiated render, so there is only one way a render can start.
 */
export async function startRenderAsHuman(
  onProgress?: (fraction: number) => void,
): Promise<ActionResult> {
  // Deliberately does NOT go through requestRender(): that raises the agent's
  // confirm sheet, and asking a person to confirm the button they just pressed
  // is a dialog that answers itself. The click is the approval.
  const proposal = await proposeRenderOnServer();
  if (!proposal.ok) return proposal.result;

  const approved = await approveRender(proposal.confirmationId);
  if (!approved.ok) return approved;

  return confirmRender(proposal.confirmationId, onProgress);
}
