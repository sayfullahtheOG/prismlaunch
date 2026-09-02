import { scaffoldProject } from "./scaffold";
import {
  ArtDirectionSchema,
  explainZodError,
  FilmProjectSchema,
  ProjectFileSchema,
  SceneIdSchema,
  SceneSchema,
  SlugSchema,
  WORKSPACE_DIR,
} from "./schema";
import { nowTimecode, useStudioStore, type PlaybackMode } from "./store";
import {
  linkWorkspace,
  listProjects,
  modifiedAt,
  projectExists,
  readProjectFile,
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
  ArtDirection,
  Feature,
  FilmProject,
  ProjectFile,
  Scene,
  SceneId,
} from "@/types/prism";

/**
 * THE mutation path.
 *
 * Every state change in the product — a click handler or a WebMCP tool
 * executor — calls a function in this file. Nothing here imports React, so an
 * executor can call it with no component context
 * (context/architecture.md invariant 1, context/code-standards.md §State).
 *
 * Two things are true here that were not true before the app read folders:
 *
 * 1. **Every commit reaches disk.** The store is a view of
 *    `.prismlaunch/<slug>/project.json`; if the two disagree the file wins.
 *    Writes are debounced so typing does not thrash a file the agent may have
 *    open, and `flushWrites()` forces the queue for callers that must not
 *    return before the bytes land — every tool executor does.
 *
 * 2. **The app writes no copy.** The agent decides what the film says, with
 *    its own file tools or through `writeStoryboard`. What is enforced here is
 *    structure, and the approval boundary.
 *
 * On that boundary: `acceptDraft` and `keepCurrent` are the only actions that
 * clear a draft, and they are deliberately never wrapped as WebMCP tools. That
 * is structural, not a rule in a description — the agent has no function to
 * call (invariant 2).
 */

export type ActionOrigin = "human" | "agent";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "no-workspace"
  | "no-project"
  | "unknown-scene"
  | "invalid-input"
  | "no-draft"
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
        `No film is open. Create one with prism.create_project, or write ${WORKSPACE_DIR}/<slug>/project.json yourself and open it with prism.open_project.`,
      ),
    };
  }
  return { ok: true, value: project };
}

function findScene(project: FilmProject, sceneId: SceneId): Scene | undefined {
  return project.scenes.find((scene) => scene.id === sceneId);
}

function sceneLabel(scene: Scene): string {
  return `scene ${String(scene.order).padStart(2, "0")}`;
}

/**
 * Append an activity event. Every mutation records one, so the rail is a
 * complete account of who changed what — the thing that makes agent work
 * legible rather than magical. Events carry origin "disk" when the change
 * arrived from the agent's own editor: that was made by neither the person
 * watching nor a tool call, and saying so is more useful than guessing.
 */
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

/** Strip the tab-local fields. Only what the film IS reaches the file. */
export function toProjectFile(project: FilmProject): ProjectFile {
  return {
    version: project.version,
    name: project.name,
    product: project.product,
    brief: project.brief,
    scenes: project.scenes,
  };
}

const WRITE_DEBOUNCE_MS = 350;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writePending: Promise<void> | null = null;

/**
 * Queue a write of the current project.
 *
 * Debounced because dragging a duration slider would otherwise write the file
 * thirty times a second, and that file may be open in the agent's editor. The
 * trailing write always carries the latest state, so coalescing loses nothing.
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
    toProjectFile(project),
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
 * Commit a new project, re-validating the whole graph first.
 *
 * Rejecting here means a bad tool call leaves the board untouched rather than
 * putting the UI into a state the renderer would refuse — and, now, rather
 * than writing a file the app could not read back.
 */
function commit(next: FilmProject): ActionResult | null {
  const parsed = FilmProjectSchema.safeParse(next);
  if (!parsed.success) {
    return fail("graph-invalid", explainZodError(parsed.error));
  }
  const { loadedAt } = useStudioStore.getState();
  useStudioStore.getState().setProject(parsed.data, loadedAt);
  schedulePersist();
  return null;
}

function replay(): void {
  useStudioStore.getState().bumpPlayToken();
}

// ---------------------------------------------------------------------------
// The workspace
// ---------------------------------------------------------------------------

/**
 * Called once on mount. Restores a folder linked on a previous visit, but only
 * as far as the browser allows without a gesture: the handle comes back, the
 * permission usually does not, and `needs-permission` is an honest state to
 * sit in until someone clicks.
 */
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

  // One readable film and nothing open: skip a list of one and just show it.
  const only = projects.length === 1 ? projects[0] : undefined;
  if (only && only.problem === null && only.name !== null) {
    await openProject(only.slug);
  }

  return ok(
    projects.length === 0
      ? `Linked. No films in ${WORKSPACE_DIR}/ yet.`
      : `Linked. Found ${projects.length} film${projects.length === 1 ? "" : "s"}.`,
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
    `${projects.length} film${projects.length === 1 ? "" : "s"} in ${WORKSPACE_DIR}/.`,
  );
}

// ---------------------------------------------------------------------------
// Opening, creating, syncing
// ---------------------------------------------------------------------------

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
    ...read.value.file,
    slug: parsedSlug.data,
    activeSceneId: "scene-01",
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
  replay();

  const drafts = project.scenes.filter((s) => s.approval === "draft").length;
  return ok(
    `Opened “${project.name}”. ${
      drafts === 0
        ? "All four scenes are accepted."
        : `${drafts} of 4 scenes are unreviewed drafts.`
    }`,
  );
}

export type CreateProjectInputs = {
  slug: string;
  name: string;
  productName: string;
  productDescription?: string;
  promise: string;
  artDirection?: ArtDirection;
};

/**
 * Create the folder and write the scaffold.
 *
 * The four scenes come out as obvious placeholders marked `draft`, so a film
 * nobody has written cannot be exported. Filling them is the agent's job —
 * either through `writeStoryboard` or by editing the file it just made.
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

  const checked = ProjectFileSchema.safeParse(scaffoldProject(inputs));
  if (!checked.success) {
    return fail("invalid-input", explainZodError(checked.error));
  }

  const written = await writeProjectFile(guard.value, slug, checked.data);
  if (!written.ok) return fail("disk-error", written.message);

  await refreshProjects();
  await openProject(slug);

  return ok(
    `Created ${WORKSPACE_DIR}/${slug}/project.json with four empty scenes. Write them with prism.write_storyboard, or edit the file directly — the app is watching it.`,
  );
}

/**
 * Re-read the file and adopt it if it changed underneath us.
 *
 * This is what makes the agent's own editor a first-class way to work: it
 * writes project.json, and the board updates without anyone calling a tool.
 * Selection and the session log survive, because those describe the tab rather
 * than the film.
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
    {
      ...read.value.file,
      slug: current.slug,
      activeSceneId: current.activeSceneId,
      activity: current.activity,
    },
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
  replay();
  return ok("Reloaded from the folder.");
}

/**
 * Poll for an external edit. Cheap — one `getFile()` and an mtime compare, with
 * no read of the contents unless something moved.
 *
 * There is no watch API for File System Access, so polling is the whole story.
 * A one-second interval is fast enough to feel live next to an agent typing,
 * and light enough to leave running.
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
  return ok("Closed the film. The folder is untouched.");
}

// ---------------------------------------------------------------------------
// Writing the film
// ---------------------------------------------------------------------------

export type SceneDraft = {
  headline: string;
  body?: string;
  durationFrames: number;
  motionPreset: Scene["motionPreset"];
  emphasis: Scene["emphasis"];
  feature?: Feature;
};

/**
 * The agent's main authoring call: all four scenes at once.
 *
 * Whole-board rather than scene-by-scene because a launch film is one argument
 * — the hook only works if the resolve pays it off — and because the 16–22s
 * budget is a property of the set. An agent writing one scene per call would
 * discover the total was wrong on the fourth one.
 *
 * Everything lands as `draft`. There is no argument that makes this accept.
 */
export async function writeStoryboard(
  drafts: readonly [SceneDraft, SceneDraft, SceneDraft, SceneDraft],
  note?: string,
): Promise<ActionResult> {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const scenes: Scene[] = project.scenes.map((existing, index) => {
    const draft = drafts[index]!;
    return {
      id: existing.id,
      order: existing.order,
      template: existing.template,
      durationFrames: draft.durationFrames,
      headline: draft.headline,
      motionPreset: draft.motionPreset,
      emphasis: draft.emphasis,
      approval: "draft" as const,
      revisionNote: note ?? "Storyboard written by your agent.",
      ...(draft.body ? { body: draft.body } : {}),
      ...(draft.feature ? { feature: draft.feature } : {}),
      // Only worth keeping if there was something real there to restore.
      ...(existing.approval === "accepted"
        ? { previousHeadline: existing.headline }
        : {}),
    };
  });

  const rejected = commit(
    withActivity(
      { ...project, scenes, activeSceneId: "scene-01" },
      {
        origin: "agent",
        label: "prism.write_storyboard",
        detail: note ?? "Wrote all four scenes",
      },
    ),
  );
  if (rejected) return rejected;

  await flushWrites();
  replay();

  const seconds = (
    scenes.reduce((total, s) => total + s.durationFrames, 0) / 24
  ).toFixed(1);

  return ok(
    `Wrote four scenes, ${seconds}s total. All four are drafts on the person's screen now — they accept or reject each one, and you cannot do it for them.`,
  );
}

export type ScenePatch = {
  headline?: string | undefined;
  body?: string | undefined;
  feature?: Feature | undefined;
  motionPreset?: Scene["motionPreset"] | undefined;
  emphasis?: Scene["emphasis"] | undefined;
  durationFrames?: number | undefined;
};

/** Drop undefined keys so `exactOptionalPropertyTypes` stays satisfied. */
function defined(patch: ScenePatch): Partial<Scene> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Scene>;
}

function applyPatch(
  sceneId: SceneId,
  patch: ScenePatch,
  origin: { origin: "human" } | { origin: "agent"; revisionNote: string },
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const scene = findScene(project, sceneId);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);

  const changes = defined(patch);
  if (Object.keys(changes).length === 0) {
    return ok(`Nothing to change on ${sceneLabel(scene)}.`);
  }

  const agent = origin.origin === "agent";
  const next: Scene = {
    ...scene,
    ...changes,
    // A person editing their own film is not proposing anything, so their edit
    // never creates a draft. An agent's always does.
    ...(agent
      ? {
          approval: "draft" as const,
          revisionNote: origin.revisionNote,
          ...(scene.approval === "accepted"
            ? { previousHeadline: scene.headline }
            : {}),
        }
      : {}),
  };

  const parsed = SceneSchema.safeParse(next);
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error));
  }

  const rejected = commit(
    withActivity(
      {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? parsed.data : s)),
      },
      agent
        ? {
            origin: "agent",
            label: "prism.revise_scene",
            detail: origin.revisionNote,
            sceneId,
          }
        : {
            origin: "human",
            label: "Edited scene",
            detail: Object.keys(changes).join(", "),
            sceneId,
          },
    ),
  );
  if (rejected) return rejected;

  replay();
  return ok(
    agent
      ? `Proposed a change to ${sceneLabel(scene)}. It is a draft — the person accepts or rejects it.`
      : `Updated ${sceneLabel(scene)}.`,
  );
}

/** A person editing their own film. Never creates a draft. */
export function updateScene(sceneId: SceneId, patch: ScenePatch): ActionResult {
  return applyPatch(sceneId, patch, { origin: "human" });
}

/** An agent proposing one change. Always lands as a draft. */
export async function reviseSceneDraft(
  sceneId: SceneId,
  patch: ScenePatch,
  revisionNote: string,
): Promise<ActionResult> {
  const result = applyPatch(sceneId, patch, { origin: "agent", revisionNote });
  await flushWrites();
  return result;
}

// ---------------------------------------------------------------------------
// The approval boundary — human only, never registered as a tool
// ---------------------------------------------------------------------------

function resolveDraft(sceneId: SceneId, accepted: boolean): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const scene = findScene(project, sceneId);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);
  if (scene.approval !== "draft") {
    return fail("no-draft", `${sceneLabel(scene)} has no pending draft.`);
  }

  const restored =
    !accepted && scene.previousHeadline ? scene.previousHeadline : scene.headline;

  const settled: Scene = { ...scene, approval: "accepted", headline: restored };
  delete settled.revisionNote;
  delete settled.previousHeadline;

  const rejected = commit(
    withActivity(
      {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? settled : s)),
        // Drop the blocked render proposal — the human has now answered it.
        activity: project.activity.filter((event) => !event.blocked),
      },
      {
        origin: "human",
        label: accepted ? "Accepted draft" : "Kept current",
        detail: sceneLabel(scene),
        sceneId,
      },
    ),
  );
  if (rejected) return rejected;

  replay();
  return ok(
    accepted
      ? `Accepted the draft on ${sceneLabel(scene)}.`
      : `Discarded the draft on ${sceneLabel(scene)}.`,
  );
}

export function acceptDraft(sceneId: SceneId): ActionResult {
  return resolveDraft(sceneId, true);
}

export function keepCurrent(sceneId: SceneId): ActionResult {
  return resolveDraft(sceneId, false);
}

/**
 * Accept every pending draft at once.
 *
 * Reviewing four scenes one at a time is the right default, but a person who
 * has watched the film and likes it should not have to click four times to say
 * so. Still human-only, and still never a tool.
 */
export function acceptAllDrafts(): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;

  const drafts = guard.value.scenes.filter((s) => s.approval === "draft");
  if (drafts.length === 0) return ok("Nothing is waiting for review.");

  for (const scene of drafts) resolveDraft(scene.id, true);
  return ok(`Accepted ${drafts.length} draft${drafts.length === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------------
// Film-level settings
// ---------------------------------------------------------------------------

export function setArtDirection(direction: ArtDirection): ActionResult {
  const parsed = ArtDirectionSchema.safeParse(direction);
  if (!parsed.success) {
    return fail(
      "invalid-input",
      `unknown art direction "${String(direction)}" — expected ${ArtDirectionSchema.options.join(", ")}`,
    );
  }

  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  if (project.brief.artDirection === parsed.data) {
    return ok(`Already using ${parsed.data}.`);
  }

  const rejected = commit(
    withActivity(
      { ...project, brief: { ...project.brief, artDirection: parsed.data } },
      { origin: "human", label: "Changed art direction", detail: parsed.data },
    ),
  );
  if (rejected) return rejected;

  replay();
  return ok(`Art direction is now ${parsed.data}.`);
}

// ---------------------------------------------------------------------------
// Selection and playback — UI state, safe for agents
// ---------------------------------------------------------------------------

export function focusScene(sceneId: SceneId): ActionResult {
  const idCheck = SceneIdSchema.safeParse(sceneId);
  if (!idCheck.success) {
    return fail("unknown-scene", `unknown scene "${String(sceneId)}"`);
  }

  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const project = guard.value;

  const scene = findScene(project, idCheck.data);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);

  const { loadedAt } = useStudioStore.getState();
  useStudioStore
    .getState()
    .setProject({ ...project, activeSceneId: scene.id }, loadedAt);
  useStudioStore.getState().setPlayback({ kind: "scene", sceneId: scene.id });
  replay();

  return ok(`Focused ${sceneLabel(scene)}. Headline: "${scene.headline}"`);
}

export function setPlayback(mode: PlaybackMode): ActionResult {
  useStudioStore.getState().setPlayback(mode);
  replay();
  return ok(
    mode.kind === "film" ? "Playing the full board." : `Playing ${mode.sceneId}.`,
  );
}

export function replayCurrent(): void {
  replay();
}

// ---------------------------------------------------------------------------
// Read model — what a WebMCP read tool returns
// ---------------------------------------------------------------------------

/**
 * A small, structured summary of where things stand.
 *
 * Always reports the workspace, even when a film is open, because the agent's
 * next move is often a file write and it needs to know the folder is there.
 * `film` is null before one is opened — a key rather than an absence, so the
 * agent reads a fact with a remedy attached instead of inferring one from a
 * missing field.
 */
export function getProjectContext() {
  const { workspace, project, loadError } = useStudioStore.getState();

  const workspaceSummary =
    workspace.kind === "linked"
      ? {
          linked: true as const,
          directory: WORKSPACE_DIR,
          films: workspace.projects.map((entry) => ({
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
      film: null,
      ...(loadError ? { fileError: loadError } : {}),
    };
  }

  return {
    workspace: workspaceSummary,
    film: {
      slug: project.slug,
      path: `${WORKSPACE_DIR}/${project.slug}/project.json`,
      name: project.name,
      productName: project.product.name,
      promise: project.brief.promise,
      artDirection: project.brief.artDirection,
      activeSceneId: project.activeSceneId,
      pendingDraftSceneIds: project.scenes
        .filter((s) => s.approval === "draft")
        .map((s) => s.id),
      totalSeconds:
        project.scenes.reduce((total, s) => total + s.durationFrames, 0) / 24,
      scenes: project.scenes.map((scene) => ({
        id: scene.id,
        order: scene.order,
        template: scene.template,
        headline: scene.headline,
        ...(scene.body !== undefined ? { body: scene.body } : {}),
        ...(scene.feature !== undefined ? { feature: scene.feature } : {}),
        motionPreset: scene.motionPreset,
        emphasis: scene.emphasis,
        approval: scene.approval,
        durationFrames: scene.durationFrames,
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

/**
 * Phase 1, without any UI.
 *
 * Records the accepted board on the server and mints a confirmation. Renders
 * nothing and touches no store state — raising the confirm sheet is the
 * caller's decision, because the two entry points need different behaviour:
 * an agent must be stopped and made to wait, a person who just clicked Export
 * has already said yes.
 */
async function proposeRenderOnServer(reason?: string): Promise<Proposal> {
  const guard = requireProject();
  if (!guard.ok) return { ok: false, result: guard.result };
  const project = guard.value;

  const draft = project.scenes.find((scene) => scene.approval === "draft");
  if (draft) {
    return {
      ok: false,
      result: fail(
        "invalid-input",
        `${sceneLabel(draft)} still has an unreviewed draft. The person needs to accept or discard it first.`,
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
      body: JSON.stringify({ action: "propose", project, reason }),
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
    summary: body.summary ?? "Render the film.",
  };
}

/**
 * Phase 1 as an AGENT sees it. Renders nothing, raises the confirm sheet, and
 * tells the agent to wait for a person.
 */
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

  commit(
    withActivity(guard.value, {
      origin: "agent",
      label: "prism.request_render",
      detail: "Proposed a render — needs your confirmation",
      blocked: true,
    }),
  );

  return ok(
    `Nothing has been rendered. ${proposal.summary} A confirmation is now waiting in PrismLaunch — ask the person to approve it, then call prism.confirm_render with confirmationId "${proposal.confirmationId}".`,
  );
}

/**
 * Phase 3. Carries only the token — no scene data — so a caller holding it can
 * replay what was recorded but cannot change it. Fails until a human has
 * approved that exact confirmation.
 *
 * The server authorises and returns the recorded snapshot; the browser then
 * encodes it with WebCodecs and writes the file into the project's own folder.
 */
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

  const body: {
    ok: boolean;
    message?: string;
    snapshot?: RenderSnapshot;
  } = await response.json().catch(() => ({ ok: false }));

  if (!body.ok || !body.snapshot) {
    return fail("invalid-input", body.message ?? "The render could not start.");
  }

  const { renderFilmInBrowser, downloadBlob } = await import(
    "@/lib/render/web-render"
  );

  const outcome = await renderFilmInBrowser(body.snapshot, (progress) =>
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
 * A person clicking Export *is* the approval, so this walks all three phases
 * in one go. It still goes through the same server gate rather than a shortcut
 * path — the snapshot is recorded, approved, and consumed exactly as it would
 * be for an agent-initiated render, so there is only one way a render can ever
 * start.
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
