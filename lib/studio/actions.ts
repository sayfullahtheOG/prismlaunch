import {
  addClip,
  addElement,
  addTrack,
  clipFromElement,
  duplicateClip,
  elementUses,
  findClip,
  findElement,
  findTrack,
  fitDuration,
  mintId,
  moveClip,
  moveTrack,
  referencedAssets,
  removeClip,
  removeElement,
  removeTrack,
  splitClip,
  trimClip,
  trimToContent,
  updateClip,
  updateElement,
  updateTrack,
  type Placement,
} from "./edits";
import { blankProjectFile } from "./blank";
import { roughInk } from "./color";
import { boardAssetPaths } from "./storyboard";
import { pickLanding } from "./landing";
import {
  agentMayPlaceClips,
  agentMayShapeElements,
  beatFor,
  currentStage,
  fitsLockedBeats,
  lockedEnd,
  nextInstruction,
  previousApproved,
  snapshotBeats,
  STAGE_LABELS,
  timingLocked,
} from "./process";
import {
  ClipSchema,
  DEFAULT_FPS,
  DEFAULT_MOTION,
  ElementSchema,
  explainZodError,
  FilmProjectSchema,
  MAX_FRAMES,
  ProcessSchema,
  ProjectFileSchema,
  SlugSchema,
  STAGES,
  StoryboardClipSchema,
  WORKSPACE_DIR,
} from "./schema";
import { selectedClipId } from "./selection";
import { slugForName } from "./slug";
import { activityEvent, mergeActivity, recoverActivity } from "./activity";
import { nowTimecode, useStudioStore, type RailTab } from "./store";
import {
  boardNumber,
  defaultCellWidth,
  FRAMES_PER_SHEET,
  MAX_CAPTURE_FRAMES,
  planCapture,
  timecode,
  type CaptureLayout,
} from "@/lib/render/capture-plan";
import { elementForFile } from "@/lib/studio/files";
import {
  addAssetFile,
  browserWorkspace,
  deleteProjectFolder,
  linkWorkspace,
  listAssets,
  listProjects,
  loadAssets,
  locationOf,
  modifiedAt,
  projectExists,
  readProjectFile,
  removeAssetFile,
  renameProjectFolder,
  resolveWorkspace,
  type ProjectEntry,
  type Workspace,
  writeFrameSheet,
  writeProjectFile,
} from "@/lib/workspace/fs";
import {
  browserModeRemembered,
  forgetBrowserMode,
  rememberBrowserMode,
} from "@/lib/workspace/browser-store";
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
  CameraMove,
  Clip,
  ClipDraft,
  Element,
  ElementDraft,
  FilmProject,
  Process,
  ProjectFile,
  Selection,
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
  | "guide-unavailable"
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
        "Nothing is linked yet. Ask the person to click “Link project folder” in PrismLaunch and choose the folder you are working in, or “Start in the browser” if this browser cannot link a folder (ChatGPT's built-in browser, Safari, Firefox). The page only does either for a real click, so you cannot do it for them.",
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
 * The elements gate, for agents only.
 *
 * Elements are the style stage's artifact, and the style stage comes after
 * the animatic. The person can define an element whenever they like.
 */
function requireStageForElements(
  project: FilmProject,
  origin: "human" | "agent",
): ActionResult | null {
  if (origin === "human") return null;
  if (agentMayShapeElements(project.file.process)) return null;

  const stage = currentStage(project.file.process);
  return fail(
    "stage-gated",
    `Elements come with the style frames, after the storyboard is approved. The process is at ${stage ? STAGE_LABELS[stage] : "the end"}${stage ? `. ${nextInstruction(project.file.process).instruction}` : ""}`,
  );
}

/**
 * The timing lock, for agents only.
 *
 * Once the animatic is approved, the film's length is fixed: a visual clip
 * an agent places or moves may cross the sections freely — that is what a
 * cut carried by an object is — but may not run past the end. Lengthening
 * the film is a decision the person makes, in the Process panel, by
 * reopening the animatic.
 */
function requireInsideBeats(
  project: FilmProject,
  clip: Clip,
  origin: "human" | "agent",
): ActionResult | null {
  if (origin === "human") return null;
  if (fitsLockedBeats(project.file.process, clip)) return null;

  const end = lockedEnd(project.file.process);
  const beats = project.file.process.animatic.beats
    .map((beat) => `${beat.label || beat.id} ${beat.from}–${beat.from + beat.durationInFrames}`)
    .join(", ");
  return fail(
    "timing-locked",
    `Timing is locked: the animatic was approved, and the film ends at frame ${end}. A clip from ${clip.from} to ${clip.from + clip.durationInFrames} runs past it. Clips may cross the sections (${beats}); they may not run past the end. To lengthen the film, ask the person to reopen the animatic.`,
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
      activityEvent(event),
    ].slice(-200),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Assemble the film for rendering; activity is saved in its own file. */
export function toProjectFile(project: FilmProject): ProjectFile {
  return project.file;
}

const WRITE_DEBOUNCE_MS = 350;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writePending: Promise<void> | null = null;
let queuedSave: { project: FilmProject; workspace: Workspace } | null = null;

/** Capture the save target now, so closing or switching projects cannot redirect it. */
function schedulePersist(): void {
  const { project, workspace } = useStudioStore.getState();
  if (!project || workspace.kind !== "linked") return;
  queuedSave = { project, workspace: workspace.workspace };
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { void flushWrites(); }, WRITE_DEBOUNCE_MS);
}

async function persistNow({ project, workspace }: NonNullable<typeof queuedSave>): Promise<void> {
  const written = await writeProjectFile(workspace, project.slug, project.file, project.activity);
  const state = useStudioStore.getState();
  if (state.workspace.kind !== "linked" || state.workspace.workspace !== workspace || state.project?.slug !== project.slug) return;
  if (!written.ok) {
    state.setLoadError(written.message);
    return;
  }
  const at = await modifiedAt(workspace, project.slug);
  // Never apply an older save's baseline to a project opened while it awaited I/O.
  if (useStudioStore.getState().project === state.project) useStudioStore.setState({ loadedAt: at });
}

/** Serialize saves. Every tool waits until its parts and its activity are durable. */
export async function flushWrites(): Promise<void> {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  if (queuedSave) {
    const save = queuedSave;
    queuedSave = null;
    const pending = writePending ? writePending.then(() => persistNow(save)) : persistNow(save);
    writePending = pending;
    try { await pending; }
    finally { if (writePending === pending) writePending = null; }
  } else await writePending;
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

  const store = useStudioStore.getState();
  store.pushHistory(project.file);
  store.setProject(updated.data, store.loadedAt);
  schedulePersist();
  ensureAssets(parsed.data);
  return null;
}

/**
 * Resolve any path the film now refers to that the asset map has not met.
 *
 * Assets were loaded when a composition opened and again on reload, which
 * left a piece added from the Library with a file of its own, the cursor,
 * as a hole in the frame until the next reload. This runs after every
 * commit and costs nothing when there is nothing new; a path already known
 * to be missing is not asked for again, so a broken reference does not
 * become a fetch per keystroke.
 */
function ensureAssets(file: ProjectFile): void {
  const store = useStudioStore.getState();
  const workspace = requireWorkspace();
  if (!workspace.ok || !store.project) return;
  const unseen = referencedAssets(file).some(
    (path) => !(path in store.assets) && !store.missingAssets.includes(path),
  );
  if (!unseen) return;
  void refreshAssets(workspace.value, store.project.slug, file).catch(() => {
    // A failed load leaves the hole it would have left anyway.
  });
}

/**
 * Undo and redo.
 *
 * Every change to the film goes through `commit`, which remembers the file
 * as it was; these walk that memory. The activity log gets a line, because
 * an undo is something that happened. The file is written back, so what is
 * on disk is what is on screen, which is the rule everything else keeps.
 */
export function undo(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const store = useStudioStore.getState();
  const previous = store.history.past[store.history.past.length - 1];
  if (!previous) return fail("not-found", "Nothing to undo.");

  store.setHistory({
    past: store.history.past.slice(0, -1),
    future: [...store.history.future, guard.value.file],
  });
  store.setProject(
    withActivity({ ...guard.value, file: previous }, {
      origin: "human",
      label: "Undo",
      detail: "Put the film back as it was",
    }),
    store.loadedAt,
  );
  schedulePersist();
  ensureAssets(previous);
  return ok("Undone.");
}

export function redo(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const store = useStudioStore.getState();
  const next = store.history.future[store.history.future.length - 1];
  if (!next) return fail("not-found", "Nothing to redo.");

  store.setHistory({
    past: [...store.history.past, guard.value.file],
    future: store.history.future.slice(0, -1),
  });
  store.setProject(
    withActivity({ ...guard.value, file: next }, {
      origin: "human",
      label: "Redo",
      detail: "Did it again",
    }),
    store.loadedAt,
  );
  schedulePersist();
  ensureAssets(next);
  return ok("Redone.");
}

// ---------------------------------------------------------------------------
// The workspace
// ---------------------------------------------------------------------------

export async function restoreWorkspace(): Promise<void> {
  const { setWorkspace } = useStudioStore.getState();

  // A browser workspace, once chosen, is the one that comes back — no
  // permission to re-grant, nothing to ask. Linking a folder clears it.
  if (browserModeRemembered()) {
    const workspace = browserWorkspace();
    const projects = await listProjects(workspace);
    setWorkspace({ kind: "linked", workspace, projects });
    await land(projects);
    return;
  }

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

  const projects = await listProjects(resolved.value);
  setWorkspace({ kind: "linked", workspace: resolved.value, projects });
  await land(projects);
}

/**
 * End every successful link or re-grant with a composition open.
 *
 * The setup dialog closes on an open composition and on nothing else, so
 * this is what turns "the folder is linked" into "the setup is done". See
 * `pickLanding` for which one. Skipped when something is already open: a
 * re-grant after a reload should not switch films under someone.
 */
async function land(projects: readonly ProjectEntry[]): Promise<void> {
  if (useStudioStore.getState().project) return;

  const landing = pickLanding(projects);
  if (landing.kind === "open") await openProject(landing.slug);
  else await createBlankProject();
}

/** The picker. HUMAN ONLY — `showDirectoryPicker` requires a user gesture. */
export async function linkFolder(): Promise<ActionResult> {
  const linked = await linkWorkspace();
  if (!linked.ok) {
    if (linked.code === "cancelled") return ok("No folder chosen.");
    return fail("disk-error", linked.message);
  }

  // A folder beats the browser. Whatever was kept in the page stays there
  // for later; the folder is where the work is now.
  forgetBrowserMode();
  const projects = await listProjects(linked.value);
  useStudioStore
    .getState()
    .setWorkspace({ kind: "linked", workspace: linked.value, projects });

  /*
   * Land in the editor, not on a menu.
   *
   * The click that opened the picker was the whole setup; nothing after it
   * should need another. An empty folder gets a blank composition, a folder
   * with compositions gets the one most recently worked on, and the title
   * bar's menu is where you switch. The first version stopped at a list
   * whenever there were several, and a person who had just picked a folder
   * saw the modal still up and read it as not having worked.
   */
  await land(projects);

  const open = useStudioStore.getState().project;
  return ok(
    projects.length === 0
      ? `Linked ${WORKSPACE_DIR}/ and started a blank composition.`
      : `Linked. Found ${projects.length} composition${projects.length === 1 ? "" : "s"}${open ? `; opened “${open.file.name}”` : ""}.`,
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

/**
 * Keep compositions in this browser instead of a folder. HUMAN ONLY, like
 * linking — it is a choice about where someone's work lives.
 *
 * The way in for browsers that cannot hand over a folder: ChatGPT's built-in
 * browser opens the picker and then refuses the handle, Safari and Firefox
 * have no picker. Nothing is lost by choosing it: the agent's tools work the
 * same, `get_project_context` returns the whole composition, and a person
 * with Chrome can link a folder later.
 */
export async function startInBrowser(): Promise<ActionResult> {
  rememberBrowserMode();
  const workspace = browserWorkspace();
  const projects = await listProjects(workspace);
  useStudioStore.getState().setWorkspace({ kind: "linked", workspace, projects });
  await land(projects);

  const open = useStudioStore.getState().project;
  return ok(
    open
      ? `Working in this browser. Opened “${open.file.name}”.`
      : "Working in this browser, but nothing could be opened.",
  );
}

export async function unlinkFolder(): Promise<ActionResult> {
  await flushWrites();
  await forgetWorkspace();
  forgetBrowserMode();
  useStudioStore.getState().closeProject();
  useStudioStore.getState().setWorkspace(canLinkFolder() ? { kind: "unlinked" } : { kind: "unsupported" });
  return ok("Unlinked. Nothing on disk was touched.");
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
  const files = await listAssets(workspace, slug);
  useStudioStore.getState().setAssets(urls, missing, files);
}

/**
 * Files the person dropped or picked: into the project's assets, and each
 * one an element ready to place. HUMAN ONLY — an agent with file tools puts
 * files in the folder itself, and one without has no file to give.
 */
export async function importFiles(files: readonly File[]): Promise<ActionResult> {
  const workspaceGuard = requireWorkspace();
  if (!workspaceGuard.ok) return workspaceGuard.result;
  const projectGuard = requireProject();
  if (!projectGuard.ok) return projectGuard.result;
  if (files.length === 0) return fail("invalid-input", "No files to add.");

  const slug = projectGuard.value.slug;
  const added: string[] = [];
  const failed: string[] = [];
  for (const file of files) {
    const written = await addAssetFile(workspaceGuard.value, slug, file);
    if (!written.ok) {
      failed.push(file.name);
      continue;
    }
    const created = createElement(elementForFile(written.value));
    if (created.ok) added.push(written.value);
    else failed.push(file.name);
  }

  const current = useStudioStore.getState().project;
  if (current) await refreshAssets(workspaceGuard.value, slug, current.file);

  if (added.length === 0) {
    return fail("disk-error", `Could not add ${failed.join(", ")}.`);
  }
  return ok(
    `Added ${added.length} file${added.length === 1 ? "" : "s"} as element${added.length === 1 ? "" : "s"}${
      failed.length > 0 ? `; could not add ${failed.join(", ")}` : ""
    }.`,
  );
}

/**
 * Delete a file from the project's `assets/`. HUMAN ONLY, and confirmed
 * in the panel first: a file is not a clip, and there is no undo for it.
 * Refuses while anything in the film still refers to the file, because a
 * hole in the frame is not what "delete this file" meant.
 */
export async function removeAsset(path: string): Promise<ActionResult> {
  const workspaceGuard = requireWorkspace();
  if (!workspaceGuard.ok) return workspaceGuard.result;
  const projectGuard = requireProject();
  if (!projectGuard.ok) return projectGuard.result;
  const { slug, file } = projectGuard.value;

  if (referencedAssets(file).includes(path)) {
    return fail(
      "invalid-input",
      `${path} is still used by a clip or an element. Remove that first.`,
    );
  }
  if (!useStudioStore.getState().assetFiles.includes(path)) {
    return fail("not-found", `There is no ${path} in this project.`);
  }

  const removed = await removeAssetFile(workspaceGuard.value, slug, path);
  if (!removed.ok) return fail("disk-error", removed.message);

  await refreshAssets(workspaceGuard.value, slug, file);
  return ok(`Deleted ${path}.`);
}

export async function openProject(slug: string): Promise<ActionResult> {
  await flushWrites();
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

  const project = withActivity({
    file: read.value.file,
    slug: parsedSlug.data,
    selection: null,
    activity: read.value.activity ?? recoverActivity(read.value.file),
  }, {
    origin: "disk",
    label: guard.value.kind === "disk" ? "Opened from folder" : "Opened from this browser",
    detail: locationOf(guard.value, parsedSlug.data),
  });

  useStudioStore.getState().setProject(project, read.value.modifiedAt);
  useStudioStore.getState().setPendingRender(null);
  useStudioStore.getState().setPlayhead(0);
  // Also migrates a valid legacy composition into the shared parts layout.
  schedulePersist();
  await flushWrites();
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
  /*
   * One frame of runtime — as close to zero as a composition can be.
   *
   * Not a default length someone has to trim back afterwards: `fitDuration`
   * grows the film whenever a clip lands past the end, so the duration is
   * always exactly as long as what is in it unless somebody sets it
   * deliberately. Asking a person to guess how long their video will be before
   * they have made any of it is a question with no good answer.
   */
  const draft: ProjectFile = blankProjectFile(inputs.name, {
    fps,
    ...(inputs.width !== undefined ? { width: inputs.width } : {}),
    ...(inputs.height !== undefined ? { height: inputs.height } : {}),
    ...(inputs.durationInFrames !== undefined
      ? { durationInFrames: inputs.durationInFrames }
      : {}),
    ...(inputs.background !== undefined ? { background: inputs.background } : {}),
  });

  const checked = ProjectFileSchema.safeParse(draft);
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const written = await writeProjectFile(guard.value, slug, checked.data);
  if (!written.ok) return fail("disk-error", written.message);

  await refreshProjects();
  await openProject(slug);

  return ok(
    guard.value.kind === "disk"
      ? `Created ${WORKSPACE_DIR}/${slug}/project.json — an empty canvas with one visual track and one audio track, ${checked.data.width}×${checked.data.height} at ${fps}fps. It has no runtime yet; it grows as you place clips. Add them with prism.add_text and friends, or edit the file directly — the app is watching it.`
      : `Created “${checked.data.name}” in this browser — an empty canvas with one visual track and one audio track, ${checked.data.width}×${checked.data.height} at ${fps}fps. It has no runtime yet; it grows as you place clips. There is no file to edit here: build it with the tools, and read it back with prism.get_project_context.`,
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
 * Selection and playhead survive. Saved activity is merged with the current log.
 */
export async function reloadFromDisk(): Promise<ActionResult> {
  await flushWrites();
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
    { ...current, file: read.value.file, activity: mergeActivity(read.value.activity ?? [], current.activity) },
    {
      origin: "disk",
      label: "Reloaded project files",
      detail: "Project parts changed outside the app",
    },
  );

  const parsed = FilmProjectSchema.safeParse(next);
  if (!parsed.success) {
    const message = explainZodError(parsed.error);
    useStudioStore.getState().setLoadError(message);
    return fail("graph-invalid", message);
  }

  // An agent's edit, arriving through the file, is undoable like any other.
  useStudioStore.getState().pushHistory(current.file);
  useStudioStore.getState().setProject(parsed.data, read.value.modifiedAt);
  useStudioStore.getState().setLoadError(null);
  schedulePersist();
  await flushWrites();
  await refreshAssets(workspaceGuard.value, current.slug, read.value.file);
  return ok("Reloaded from the folder.");
}

/**
 * Poll for an external edit. Cheap — one `getFile()` and an mtime compare, with
 * no read of the contents unless something moved.
 */
export async function checkForDiskChanges(): Promise<boolean> {
  if (writeTimer || writePending) return false;
  const { workspace, project, loadedAt } = useStudioStore.getState();
  if (workspace.kind !== "linked" || !project) return false;

  const at = await modifiedAt(workspace.workspace, project.slug);
  if (at === 0 || at === loadedAt) return false;

  await reloadFromDisk();
  return true;
}

export function closeProject(): ActionResult {
  void flushWrites();
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

  const removed = await deleteProjectFolder(guard.value, parsed.data);
  if (!removed.ok) return fail("disk-error", removed.message);

  const open = useStudioStore.getState().project;
  if (open?.slug === parsed.data) useStudioStore.getState().closeProject();

  await refreshProjects();

  const remaining = takenSlugs();
  const next = remaining[0];
  if (open?.slug === parsed.data && next) await openProject(next);

  return ok(`Deleted ${locationOf(guard.value, parsed.data)} and everything in it.`);
}

// ---------------------------------------------------------------------------
// Selection, playhead, zoom — tab state, safe for agents
// ---------------------------------------------------------------------------

/**
 * Select by id, whatever the id is.
 *
 * Ids are unique across the whole file, so a caller holding one does not need
 * to say what kind of thing it names — this looks it up. The inspector shows
 * whichever it turns out to be.
 */
export function select(id: string | null): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  const selection = id === null ? null : selectionFor(guard.value.file, id);
  if (id !== null && selection === null) {
    return fail("not-found", `Nothing in the composition has the id "${id}".`);
  }

  setSelection(guard.value, selection);
  return ok(id ? `Selected ${id}.` : "Cleared the selection.");
}

/** The background is the one thing with no id: it is selected by name. */
export function selectBackground(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  setSelection(guard.value, { kind: "background" });
  return ok("Selected the background.");
}

function setSelection(project: FilmProject, selection: Selection | null): void {
  useStudioStore
    .getState()
    .setProject({ ...project, selection }, useStudioStore.getState().loadedAt);
}

function selectionFor(file: ProjectFile, id: string): Selection | null {
  if (findClip(file, id)) return { kind: "clip", id };
  if (findTrack(file, id)) return { kind: "track", id };
  if (findElement(file, id)) return { kind: "element", id };
  if (file.process.storyboard.panels.some((panel) => panel.id === id)) {
    return { kind: "panel", id };
  }
  return null;
}

/** Which section the rail shows. Tab state, so an agent may move it too. */
/** Open a stage's review in the middle of the editor. HUMAN ONLY. */
export function reviewStage(stage: StageId): void {
  const store = useStudioStore.getState();
  store.setTab("process");
  store.setOpenStage(stage);
}

/** Back to the canvas and the timeline, whatever stage the film is at. HUMAN ONLY. */
export function showEditor(): void {
  const store = useStudioStore.getState();
  store.setReviewing(false);
  store.setTab("editor");
}

/** Show a file from the workspace in the middle, or none. HUMAN ONLY. */
export function openFile(path: string | null): void {
  const store = useStudioStore.getState();
  store.setFilePath(path);
  if (path !== null) store.setTab("files");
}

export function showTab(tab: RailTab): ActionResult {
  useStudioStore.getState().setTab(tab);
  return ok(`Showing ${tab}.`);
}

/** Move the playhead, which is also what the preview shows. */
export function seek(frame: number): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  // The last frame is durationInFrames - 1: a 378-frame film has frames 0
  // to 377, and asking the Player for 378 gets 377 back with a message that
  // said 378.
  const last = Math.max(0, guard.value.file.durationInFrames - 1);
  const clamped = Math.min(Math.max(0, Math.round(frame)), last);
  useStudioStore.getState().setPlayhead(clamped);
  return ok(
    `Playhead at ${(clamped / guard.value.file.fps).toFixed(2)}s (frame ${clamped}).`,
  );
}

export type CaptureInput = {
  layout?: CaptureLayout | undefined;
  every?: number | undefined;
  from?: number | undefined;
  to?: number | undefined;
  at?: readonly number[] | undefined;
  width?: number | undefined;
};

export type CaptureResult =
  | {
      ok: true;
      message: string;
      /** One per sheet: base64 without the data-URL prefix, and its type. */
      images: { base64: string; mimeType: string; width: number; height: number }[];
    }
  | { ok: false; message: string };

/**
 * Render chosen frames of the open composition onto storyboard sheets.
 *
 * This is how the agent sees its own work. A screenshot of a playing film
 * lands wherever the clock was; this renders exact frames — the same pixels
 * export produces — at a cadence or at named moments, and returns them six
 * to a sheet, numbered like boards, so the agent reads each sheet as a
 * sequence and can name one cell. Read-only: nothing in the file changes,
 * and the person sees the same sheets in the Activity panel, because the two
 * of them should never be looking at different things.
 *
 * Saved beside the project too, when there is a folder, for agents whose
 * bridge does not pass images through.
 */
export async function captureFrames(input: CaptureInput): Promise<CaptureResult> {
  const guard = requireProject();
  if (!guard.ok) return { ok: false, message: guard.result.message };
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, message: "Capturing frames runs in the browser." };
  }

  const project = guard.value;
  const { fps, durationInFrames } = project.file;
  const plan = planCapture({
    fps,
    durationInFrames,
    every: input.every,
    from: input.from,
    to: input.to,
    at: input.at,
    max: MAX_CAPTURE_FRAMES,
  });
  if (plan.frames.length === 0) {
    return { ok: false, message: "That window holds no frames." };
  }

  const { captureSheets, blobToDataUrl } = await import("@/lib/render/web-capture");
  const { assets } = useStudioStore.getState();
  const layout: CaptureLayout = input.layout ?? "sheet";
  const outcome = await captureSheets(project.file, assets, plan.frames, {
    layout,
    cellWidth: input.width ?? defaultCellWidth(layout),
    format: "jpeg",
    title: project.file.name,
  });
  if (!outcome.ok) return { ok: false, message: outcome.message };

  const pages = await Promise.all(outcome.sheets.map((sheet) => blobToDataUrl(sheet.blob)));
  const images = outcome.sheets.map((sheet, index) => ({
    base64: pages[index]!.slice(pages[index]!.indexOf(",") + 1),
    mimeType: sheet.mimeType,
    width: sheet.width,
    height: sheet.height,
  }));

  const count = plan.frames.length;
  const range = `${timecode(plan.frames[0]!, fps)}–${timecode(plan.frames[count - 1]!, fps)}`;
  const label =
    layout === "single"
      ? `${count} frame${count === 1 ? "" : "s"}, ${range}, one image each`
      : `${count} frame${count === 1 ? "" : "s"}, ${range}, on ${outcome.sheets.length} sheet${outcome.sheets.length === 1 ? "" : "s"}`;

  // Save beside the project when there is one, and show the person.
  const { workspace, loadedAt, setProject, setLastCapture } = useStudioStore.getState();
  const saved: string[] = [];
  if (workspace.kind === "linked") {
    for (const [index, sheet] of outcome.sheets.entries()) {
      const filename =
        layout === "single"
          ? `frame-${sheet.frames[0]}.jpg`
          : `sheet-${plan.frames[0]}-${plan.frames[count - 1]}-${index + 1}.jpg`;
      const written = await writeFrameSheet(workspace.workspace, project.slug, filename, sheet.blob);
      if (written.ok) saved.push(written.value);
    }
  }
  const at = nowTimecode();
  setLastCapture({ pages, label, at });
  setProject(
    withActivity(useStudioStore.getState().project ?? project, {
      origin: "agent",
      label: "prism.capture_frames",
      detail: `Looked at ${label}`,
    }),
    loadedAt,
  );

  schedulePersist();

  // One line per image, so the agent can match an image to its moments.
  const perSheet = outcome.sheets.map((sheet, index) => {
    const cells = sheet.frames
      .map((frame, offset) => `${boardNumber(sheet.firstBoard + offset)} ${timecode(frame, fps)} (f${frame})`)
      .join(", ");
    return `${layout === "single" ? "Image" : "Sheet"} ${index + 1}: ${cells}.`;
  });
  const message = [
    layout === "single"
      ? `${count} frame${count === 1 ? "" : "s"} of “${project.file.name}”, one image each, in order. Each is captioned with its board number, time and frame.`
      : `${count} frame${count === 1 ? "" : "s"} of “${project.file.name}”, ${FRAMES_PER_SHEET} to a sheet, three across, read left to right then top to bottom. Each cell is captioned with its board number, time and frame.`,
    ...perSheet,
    plan.truncated
      ? `That is the first ${MAX_CAPTURE_FRAMES}; narrow the window or widen the cadence for the rest.`
      : null,
    saved.length > 0 ? `Also saved as ${saved.join(", ")}, if you would rather open the files.` : null,
    "The person can see the same sheets in the Activity panel.",
  ]
    .filter(Boolean)
    .join(" ");

  return { ok: true, message, images };
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

  if (project.selection?.kind === "track" && project.selection.id === trackId) {
    select(null);
  }
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
  /** What the activity log calls it. Placing an element is not "add_clip". */
  verb?: string,
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
    // The approval boundary is the stage, not the clip: the person approves
    // the animatic, the build, the polish. The note stays as provenance.
    approval: "accepted",
    ...(origin === "agent" && note ? { revisionNote: note } : {}),
  });
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  const outside = requireInsideBeats(project, parsed.data, origin);
  if (outside) return outside;

  const rejected = commit(project, addClip(project.file, trackId, parsed.data), {
    origin,
    label: verb ?? (origin === "agent" ? "prism.add_clip" : "Added clip"),
    detail: note ?? `${parsed.data.kind} on ${track.name}`,
  });
  if (rejected) return rejected;

  select(parsed.data.id);
  return ok(
    `Added ${parsed.data.kind} clip ${parsed.data.id} to “${track.name}” at frame ${parsed.data.from}.`,
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

  if (selectedClipId(project) === clipId) select(null);
  return ok("Deleted.");
}

export function patchClip(
  clipId: string,
  patch: Partial<Clip> & { trackId?: string },
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

  // A move is part of the same patch: `trackId` carries the clip to another
  // layer, landing at `from` (or where it was). Kind mismatch and a full
  // layer are refusals with reasons, not silent no-ops.
  const { trackId: toTrackId, ...rest } = patch;
  const patchRest: Partial<Clip> = rest;
  let file = project.file;
  if (toTrackId && toTrackId !== found.track.id) {
    const target = findTrack(file, toTrackId);
    if (!target) return fail("not-found", `No track "${toTrackId}".`);
    if ((found.clip.kind === "audio") !== (target.kind === "audio")) {
      return fail(
        "invalid-input",
        `A ${found.clip.kind} clip cannot move to “${target.name}”: audio stays on audio layers, visuals on visual ones.`,
      );
    }
    const targetLocked = requireUnlocked(target);
    if (targetLocked) return targetLocked;
    file = moveClip(file, clipId, toTrackId, patchRest.from ?? found.clip.from);
    const landed = findClip(file, clipId);
    if (!landed || landed.track.id !== toTrackId) {
      return fail("invalid-input", `“${target.name}” has no room for it at that frame.`);
    }
    patchRest.from = landed.clip.from;
  }

  const merged = {
    ...findClip(file, clipId)!.clip,
    ...patchRest,
    ...(origin === "agent" ? { revisionNote: note ?? "Changed by your agent" } : {}),
  };

  const parsed = ClipSchema.safeParse(merged);
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  // Only a timing change can break the lock; a colour change never does.
  if ("from" in patchRest || "durationInFrames" in patchRest) {
    const outside = requireInsideBeats(project, parsed.data, origin);
    if (outside) return outside;
  }

  const rejected = commit(
    project,
    updateClip(file, clipId, parsed.data),
    {
      origin,
      label: origin === "agent" ? "prism.update_clip" : "Edited clip",
      detail: note ?? Object.keys(patch).join(", "),
    },
  );
  if (rejected) return rejected;

  return ok("Updated.");
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
  const id = selectedClipId(project);
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

  const id = selectedClipId(project);
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
// Elements — the look, as things to place
// ---------------------------------------------------------------------------

/**
 * Define an element.
 *
 * Not a draft: elements are not on screen, so there is nothing to accept.
 * They are reviewed as the style stage — the person approves the look they
 * make up — and every clip placed from one is still a draft in its own right.
 */
export function createElement(
  element: ElementDraft,
  origin: "human" | "agent" = "human",
  note?: string,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const gated = requireStageForElements(project, origin);
  if (gated) return gated;

  const parsed = ElementSchema.safeParse({
    ...element,
    id: mintId(`el-${element.kind}`),
  });
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  const rejected = commit(project, addElement(project.file, parsed.data), {
    origin,
    label: origin === "agent" ? "prism.add_element" : "Added element",
    detail: note ?? `${parsed.data.kind} “${parsed.data.name}”`,
  });
  if (rejected) return rejected;

  select(parsed.data.id);
  return ok(
    `Added ${parsed.data.kind} element “${parsed.data.name}” (${parsed.data.id}). Put it on the timeline with prism.place_element.`,
  );
}

/**
 * Change an element — and with it, every clip placed from it.
 *
 * The propagation is the point: adjusting the Headline style's size is one
 * call, not one per headline. Clips that follow the element become drafts
 * again when an agent does this, since what is on screen changed.
 */
export function patchElement(
  elementId: string,
  patch: Partial<Element>,
  origin: "human" | "agent" = "human",
  note?: string,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const gated = requireStageForElements(project, origin);
  if (gated) return gated;

  const element = findElement(project.file, elementId);
  if (!element) return fail("not-found", `No element "${elementId}".`);

  const parsed = ElementSchema.safeParse({ ...element, ...patch, id: element.id, kind: element.kind });
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  let next = updateElement(project.file, elementId, patch);
  const uses = elementUses(project.file, elementId);

  // The change reaches every placed clip already (updateElement); the note
  // rides along as provenance. Nothing re-drafts: the stage is the boundary.
  if (origin === "agent" && uses > 0) {
    next = {
      ...next,
      tracks: next.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.elementId === elementId
            ? { ...clip, revisionNote: note ?? `“${element.name}” changed` }
            : clip,
        ),
      })),
    };
  }

  const rejected = commit(project, next, {
    origin,
    label: origin === "agent" ? "prism.update_element" : "Edited element",
    detail: note ?? `${element.name} · ${Object.keys(patch).join(", ")}`,
  });
  if (rejected) return rejected;

  return ok(
    uses > 0
      ? `Updated “${element.name}” and the ${uses} clip${uses === 1 ? "" : "s"} placed from it.`
      : `Updated “${element.name}”.`,
  );
}

/**
 * Remove an element. The clips placed from it stay, unlinked — deleting the
 * Headline style should not delete the headlines.
 */
export function deleteElement(
  elementId: string,
  origin: "human" | "agent" = "human",
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const gated = requireStageForElements(project, origin);
  if (gated) return gated;

  const element = findElement(project.file, elementId);
  if (!element) return fail("not-found", `No element "${elementId}".`);
  const uses = elementUses(project.file, elementId);

  const rejected = commit(project, removeElement(project.file, elementId), {
    origin,
    label: origin === "agent" ? "prism.remove_element" : "Removed element",
    detail: `${element.name}${uses > 0 ? ` · ${uses} clips unlinked` : ""}`,
  });
  if (rejected) return rejected;

  if (project.selection?.kind === "element" && project.selection.id === elementId) {
    select(null);
  }
  return ok(
    uses > 0
      ? `Removed “${element.name}”. The ${uses} clip${uses === 1 ? "" : "s"} placed from it stay${uses === 1 ? "s" : ""}, no longer linked.`
      : `Removed “${element.name}”.`,
  );
}

/**
 * Put an element on the timeline.
 *
 * Goes through `createClip`, so every rule a clip obeys applies: the track
 * lock, the stage gate, the timing lock, and the draft. This only composes
 * the clip; the element supplies everything but the place and the words.
 */
export function placeElement(
  elementId: string,
  trackId: string,
  placement: Placement,
  origin: "human" | "agent" = "human",
  note?: string,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const element = findElement(project.file, elementId);
  if (!element) return fail("not-found", `No element "${elementId}".`);

  const track = findTrack(project.file, trackId);
  if (!track) return fail("not-found", `No track "${trackId}".`);
  if ((element.kind === "audio") !== (track.kind === "audio")) {
    return fail(
      "invalid-input",
      `“${element.name}” is ${element.kind}; it cannot go on the ${track.kind} track “${track.name}”.`,
    );
  }

  const made = clipFromElement(element, placement);
  if (!made.ok) return fail("invalid-input", made.message);

  return createClip(
    trackId,
    made.clip as ClipDraft as Omit<Clip, "id">,
    origin,
    note ?? `Placed “${element.name}”`,
    origin === "agent" ? "prism.place_element" : "Placed element",
  );
}

/**
 * The inspector's "Place at playhead".
 *
 * Picks the obvious track — the first of the right kind — and the obvious
 * length: the rest of the locked beat the playhead is in, if the timing is
 * locked, so a placed element fills its slot; otherwise two seconds of
 * picture or four of sound. All of it is adjustable afterwards.
 */
export function placeElementHere(elementId: string): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { file } = guard.value;
  const { playhead } = useStudioStore.getState();

  const element = findElement(file, elementId);
  if (!element) return fail("not-found", `No element "${elementId}".`);

  const audio = element.kind === "audio";
  const track = file.tracks.find((candidate) => (candidate.kind === "audio") === audio);
  if (!track) {
    return fail("not-found", `There is no ${audio ? "audio" : "visual"} track to place it on.`);
  }

  const beat = audio ? undefined : beatFor(file.process, { from: playhead, durationInFrames: 1 });
  const durationInFrames = beat
    ? beat.from + beat.durationInFrames - playhead
    : file.fps * (audio ? 4 : 2);

  return placeElement(elementId, track.id, { from: playhead, durationInFrames });
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

  if (stage === "storyboard") {
    const panels = checked.data.storyboard.panels;
    if (panels.length < 2 || panels.some((panel) => !panel.visual)) {
      return fail("invalid-input", "Every storyboard panel needs a visual scene with positioned layers. Text-only boards are scripts, not a visual plan. Supply visual.layers for at least two panels; read SKILL.md's Visual storyboards section.");
    }
    if (panels.reduce((sum, panel) => sum + panel.durationInFrames, 0) > MAX_FRAMES) {
      return fail("invalid-input", `The storyboard cannot exceed ${MAX_FRAMES} frames.`);
    }
    let missing = [...new Set(panels.flatMap((panel) => boardAssetPaths(panel.visual)))].filter((src) => !useStudioStore.getState().assets[src]);
    if (missing.length) {
      const workspace = requireWorkspace();
      if (workspace.ok) {
        // New disk assets need not have been used by an element yet. Resolve
        // them through project storage, without letting an await overwrite edits.
        const loaded = await loadAssets(workspace.value, project.slug, missing);
        if (useStudioStore.getState().project?.file !== project.file) return fail("invalid-input", "The project changed while storyboard images loaded. Read the project again and retry.");
        missing = loaded.missing;
        const store = useStudioStore.getState();
        store.setAssets({ ...store.assets, ...loaded.urls }, store.missingAssets.filter((path) => !loaded.urls[path]), store.assetFiles);
      }
    }
    if (missing.length) return fail("invalid-input", `Storyboard images are not loaded: ${[...new Set(missing)].join(", ")}. Import them first, or draw a labelled rough for footage still to capture.`);
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

  // The one moment the person is needed: put the stage in front of them,
  // the way the result below says it is.
  reviewStage(stage);

  await flushWrites();
  return ok(
    `${STAGE_LABELS[stage]} submitted and open for the person in PrismLaunch. End your turn now: tell them it is waiting for their review, and ask them to message you once they have approved it or sent it back. When they ping you, read the decision with prism.get_project_context (or one prism.wait_for_decision). Do not poll while you wait.`,
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
 * One visual board clip per panel, at cumulative frames from its duration,
 * carrying its layers, keyframes and transitions, labelled by its beat. The
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
    const clip = boardClip(panel, cursor, project.file.background);
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

/** Preserve visual scenes; old text-only boards retain their legacy fallback. */
function boardClip(panel: StoryboardPanel, from: number, background: Background): Clip {
  if (panel.visual) return StoryboardClipSchema.parse({
    kind: "storyboard", id: mintId("board"), from,
    durationInFrames: panel.durationInFrames, label: panel.label,
    revisionNote: `Board: ${panel.frame}`.slice(0, 240),
    visual: panel.visual,
    box: { x: 0.5, y: 0.5, width: 1, height: 1 },
    animation: { enter: panel.transitionIn, exit: panel.transitionOut, enterFrames: 10, exitFrames: 6 },
  });
  return {
    kind: "text",
    id: mintId("board"),
    from,
    durationInFrames: panel.durationInFrames,
    approval: "accepted",
    label: panel.label,
    // A frame description may run to 280 characters; a revision note holds
    // 240. Clamped, because one long board must not refuse the whole animatic.
    revisionNote: `Board: ${panel.frame}`.slice(0, 240),
    text: panel.words?.trim() || panel.label,
    fontSize: 0.07,
    fontFamily: "mono",
    fontWeight: 400,
    // A placeholder has no colour decision of its own: it answers the ground.
    color: `${roughInk(background).ink}B3`,
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    revealStagger: 0,
    revealStyle: "rise",
    radius: 0,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.47, width: 0.8, height: 0.3, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: {
      enter: panel.transitionIn,
      exit: panel.transitionOut,
      enterFrames: 10,
      exitFrames: 6, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
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

/**
 * The style stage names its elements and its frames by id, and a wrong id
 * here would be a style frame nobody can find. Checked before submitting.
 */
export function submitStyleFrames(
  artifact: StagePatch<"style">,
  summary?: string,
): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return Promise.resolve(guard.result);
  const { file } = guard.value;

  const unknownElements = (artifact.elementIds ?? []).filter((id) => !findElement(file, id));
  const unknownClips = (artifact.clipIds ?? []).filter((id) => !findClip(file, id));
  if (unknownElements.length > 0 || unknownClips.length > 0) {
    return Promise.resolve(
      fail(
        "invalid-input",
        [
          unknownElements.length > 0 ? `no such elements: ${unknownElements.join(", ")}` : "",
          unknownClips.length > 0 ? `no such clips: ${unknownClips.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ") + ". Ids come from prism.get_project_context.",
      ),
    );
  }

  return submitStage("style", artifact, summary);
}

export function submitBuild(summary?: string): Promise<ActionResult> {
  return submitStage("build", {}, summary);
}

export function submitPolish(
  artifact: StagePatch<"polish">,
  summary?: string,
): Promise<ActionResult> {
  return submitStage("polish", artifact, summary);
}

/**
 * Edit one storyboard panel in place.
 *
 * The person's, not the agent's: an agent resubmits the whole storyboard
 * with `submit_storyboard`, and the person answers it. But a duration that
 * is twelve frames long or a word that should be another word does not need
 * a round trip, and the person owns the process, so they can change it here.
 * The agent sees the edit on its next `get_project_context`.
 */
export function patchStoryboardPanel(
  panelId: string,
  patch: Partial<Omit<StoryboardPanel, "id">>,
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;
  const { storyboard } = project.file.process;

  const panel = storyboard.panels.find((candidate) => candidate.id === panelId);
  if (!panel) return fail("not-found", `No storyboard panel "${panelId}".`);

  const next: Process = {
    ...project.file.process,
    storyboard: {
      ...storyboard,
      panels: storyboard.panels.map((candidate) =>
        candidate.id === panelId ? { ...candidate, ...patch } : candidate,
      ),
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
      label: "Edited board",
      detail: `${panel.label} · ${Object.keys(patch).join(", ")}`,
    },
  );
  if (rejected) return rejected;

  return ok(`Updated board “${panel.label}”.`);
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
  extra: { chosen?: string; note?: string } = {},
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;
  const process = project.file.process;
  const view = useStudioStore.getState();
  // A reopened page follows currentStage while openStage is null. Approval
  // advances the workflow, but must leave the person on the artifact they
  // just reviewed rather than showing an empty next stage.
  const keepReview = view.tab === "process" && view.reviewing &&
    (view.openStage ?? currentStage(process)) === stage;

  const next: Process = {
    ...process,
    [stage]: {
      ...process[stage],
      status: "approved" as const,
      note: extra.note?.trim() || undefined,
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
      detail: [
        stage === "animatic"
          ? `Timing locked: ${checked.data.animatic.beats.length} beats`
          : (extra.chosen ?? ""),
        checked.data[stage].note,
      ].filter(Boolean).join(" · "),
    },
  );
  if (rejected) return rejected;

  if (keepReview) useStudioStore.getState().setOpenStage(stage);

  return ok(
    stage === "animatic"
      ? `Animatic approved. Timing is locked across ${checked.data.animatic.beats.length} beats.`
      : `${STAGE_LABELS[stage]} approved.`,
  );
}

/** HUMAN ONLY. Send a stage back with a note the agent will read. */
/**
 * Wait for the person to decide on a submitted stage.
 *
 * This is the notification the agent otherwise has no way to get. WebMCP is
 * request and response, so the page cannot push "they approved it" into a
 * chat; what it can do is hold a call open until there is something to say.
 * The agent submits, calls this, and the call resolves the instant the
 * person clicks Approve or Send back — with the decision, their note, and
 * what to do next. Nothing is written; nothing moves.
 *
 * If the stage was already decided before the call, it returns at once. If
 * nothing has been submitted there is nothing to wait for, and saying so is
 * more useful than hanging. A timeout returns "still waiting" rather than
 * failing, so an agent can simply call again.
 */
export function waitForDecision(input: {
  stage?: StageId | undefined;
  timeoutSeconds?: number | undefined;
}): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return Promise.resolve(guard.result);
  const process = guard.value.file.process;

  const stage =
    input.stage ??
    STAGES.find((candidate) => process[candidate].status === "submitted") ??
    currentStage(process);
  if (!stage) {
    return Promise.resolve(
      ok("Every stage is approved; there is nothing left to wait for. Propose the render."),
    );
  }

  const describe = (current: Process): ActionResult => {
    const state = current[stage];
    const label = STAGE_LABELS[stage];
    if (state.status === "approved") {
      const next = nextInstruction(current);
      return ok(
        `${label} approved.${state.note ? ` The person said: “${state.note}”.` : ""} ${next.stage ? `Next, ${STAGE_LABELS[next.stage]}: ${next.instruction}` : next.instruction}`,
      );
    }
    if (state.status === "changes-requested") {
      return ok(
        `${label} sent back${state.note ? `: “${state.note}”` : ""}. Address that and resubmit with prism.submit_${stage}, then wait again.`,
      );
    }
    return ok(`${label} is still waiting for the person.`);
  };

  const initial = process[stage];
  if (initial.status === "approved" || initial.status === "changes-requested") {
    return Promise.resolve(describe(process));
  }
  if (initial.status === "pending") {
    return Promise.resolve(
      fail(
        "invalid-input",
        `${STAGE_LABELS[stage]} has not been submitted, so there is nothing to wait for. Submit it with prism.submit_${stage} first.`,
      ),
    );
  }

  // 25 by default, not 60: an agent harness may cut a long tool call off,
  // and a short wait that says "call again" survives every host.
  const timeoutMs = Math.min(600, Math.max(1, input.timeoutSeconds ?? 25)) * 1000;

  return new Promise((resolve) => {
    let done = false;
    const finish = (result: ActionResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };

    const unsubscribe = useStudioStore.subscribe((state) => {
      const current = state.project?.file.process;
      if (!current) {
        finish(fail("no-project", "The composition was closed while waiting."));
        return;
      }
      if (current[stage].status !== "submitted") finish(describe(current));
    });

    const timer = setTimeout(
      () =>
        finish(
          ok(
            `Still waiting: the person has not decided on ${STAGE_LABELS[stage]} yet. Do not keep calling — tell them it is waiting for their review in PrismLaunch, end your turn, and ask them to message you once they have decided.`,
          ),
        ),
      timeoutMs,
    );
  });
}

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

/**
 * The camera's moves, replaced whole.
 *
 * A list rather than one move at a time, because a camera is read as a
 * sequence — where it goes and when it comes back — and an agent revising
 * the third move wants to see the other two beside it. Sorted by frame so
 * the file reads in order whatever order they were sent in.
 */
export function setCamera(moves: CameraMove[], origin: "human" | "agent" = "human"): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const camera = [...moves].sort((a, b) => a.from - b.from);
  const rejected = commit(
    project,
    { ...project.file, camera },
    {
      origin,
      label: camera.length === 0 ? "Camera stilled" : "Camera moved",
      detail:
        camera.length === 0
          ? "No moves: the whole canvas, still"
          : camera.map((move) => `f${move.from} → (${move.x}, ${move.y}) ×${move.scale}`).join(" · "),
    },
  );
  if (rejected) return rejected;

  return ok(
    camera.length === 0
      ? "Camera is still on the whole canvas."
      : `Camera has ${camera.length} move${camera.length === 1 ? "" : "s"}: ${camera
          .map((move) => `frame ${move.from} looks at (${move.x}, ${move.y}) at ×${move.scale} over ${move.frames}f`)
          .join("; ")}.`,
  );
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
  if (next.durationInFrames === project.file.durationInFrames) {
    return ok(`Already ${(next.durationInFrames / project.file.fps).toFixed(1)}s.`);
  }
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

  schedulePersist();
  await flushWrites();

  // The move preserved the file's mtime but changed its path, so the poller's
  // baseline has to be re-read from the new location or the next tick sees a
  // change that never happened.
  useStudioStore.setState({
    loadedAt: await modifiedAt(workspaceGuard.value, wanted),
  });
  await refreshProjects();

  return ok(`Renamed to “${trimmed}”. Now at ${WORKSPACE_DIR}/${wanted}/.`);
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
          /**
           * "folder": the film is a file the agent may also edit directly.
           * "browser": it lives in the page; the tools are the only way in,
           * and this context is the whole of it.
           */
          storage: workspace.workspace.kind === "disk" ? ("folder" as const) : ("browser" as const),
          directory: workspace.workspace.kind === "disk" ? WORKSPACE_DIR : null,
          ...(workspace.workspace.kind === "browser"
            ? {
                note: "This composition lives in the page. Your file tools cannot reach it: anything you write lands in your own sandbox, which the studio never sees. Change the film only through these prism.* tools; this context is the complete composition.",
              }
            : {}),
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
              ? "This browser cannot link a folder. The person must click “Start in the browser” — the composition then lives in the page and you work through these tools."
              : workspace.kind === "needs-permission"
                ? "A folder is remembered but the browser dropped its permission. The person needs to click “Re-open folder”."
                : "Nothing is linked yet. The person must click “Link project folder”, or “Start in the browser” if this browser cannot hand over a folder (ChatGPT's built-in browser, Safari, Firefox). Either takes a real click; you cannot do it for them.",
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
        polish: strip(file.process.polish),
      },
    },
    composition: {
      slug: project.slug,
      path:
        workspace.kind === "linked"
          ? locationOf(workspace.workspace, project.slug)
          : `${WORKSPACE_DIR}/${project.slug}/project.json`,
      /**
       * The film is a folder, and an agent with file tools must write it as
       * one: this spells the layout out beside the path, because an agent
       * that only sees `project.json` writes the whole film into it.
       */
      layout: {
        main: "project.json — the canvas, background, camera, process file paths, and ordered track/element ids. Never inline stages, tracks or elements here.",
        tracks: "tracks/<id>.json — one file per layer, the track object with its clips.",
        elements: "elements/<id>.json — one file per element.",
        process: "process/<stage>.json — one file per process stage, including its artifact, decision, summary and note. project.json maps each stage to its file path.",
        activity: "activity.json — the persisted event log. The app records this; do not invent past events.",
        rule: "Write and edit the part, never the whole: a new layer is a new file plus its id in project.json; a colour change is one element file; a script revision is process/script.json. Browser storage uses the same parts through the tools.",
      },
      name: file.name,
      width: file.width,
      height: file.height,
      fps: file.fps,
      durationInFrames: file.durationInFrames,
      durationSeconds: Number((file.durationInFrames / file.fps).toFixed(2)),
      background: file.background,
      playheadFrame: playhead,
      selection: project.selection,
      ...(missingAssets.length > 0 ? { missingAssets } : {}),
      // The library, with how often each element has been placed.
      elements: file.elements.map((element) => ({
        ...element,
        uses: elementUses(file, element.id),
      })),
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

  // No per-clip gate here: the approval boundary is the stages, and the
  // person still confirms the render itself before anything encodes.

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
