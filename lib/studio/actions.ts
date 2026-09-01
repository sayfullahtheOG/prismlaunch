import { PALETTES } from "./palettes";
import {
  ArtDirectionSchema,
  explainZodError,
  FilmProjectSchema,
  SceneIdSchema,
  SceneSchema,
} from "./schema";
import { nowTimecode, useStudioStore, type PlaybackMode } from "./store";
import type {
  ActivityEvent,
  ArtDirection,
  FilmProject,
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
 * On the approval boundary: `acceptDraft` and `keepCurrent` are the only
 * actions that clear a draft, and they are deliberately never wrapped as
 * WebMCP tools. That is structural, not a rule written in a tool description —
 * the agent has no function to call (invariant 2).
 */

export type ActionOrigin = "human" | "agent";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "unknown-scene"
  | "invalid-input"
  | "unknown-component"
  | "no-draft"
  | "graph-invalid";

function ok(message: string): ActionResult {
  return { ok: true, message };
}

function fail(code: ActionErrorCode, message: string): ActionResult {
  return { ok: false, code, message };
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
 * legible rather than magical.
 */
function withActivity(
  project: FilmProject,
  event: Omit<ActivityEvent, "id" | "at">,
): FilmProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    activity: [
      ...project.activity,
      { ...event, id: `ev-${project.activity.length + 1}`, at: nowTimecode() },
    ],
  };
}

/**
 * Commit a new project, re-validating the whole graph first.
 *
 * Rejecting here means a bad tool call leaves the board untouched rather than
 * putting the UI into a state the renderer would refuse.
 */
function commit(next: FilmProject): ActionResult | null {
  const parsed = FilmProjectSchema.safeParse(next);
  if (!parsed.success) {
    return fail("graph-invalid", explainZodError(parsed.error));
  }
  useStudioStore.getState().setProject(parsed.data);
  return null;
}

function replay(): void {
  useStudioStore.getState().bumpPlayToken();
}

// ---------------------------------------------------------------------------
// Selection and playback — UI state, safe for agents
// ---------------------------------------------------------------------------

export function focusScene(sceneId: SceneId): ActionResult {
  const idCheck = SceneIdSchema.safeParse(sceneId);
  if (!idCheck.success) {
    return fail("unknown-scene", `unknown scene "${String(sceneId)}"`);
  }

  const { project, setPlayback } = useStudioStore.getState();
  const scene = findScene(project, idCheck.data);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);

  useStudioStore.getState().setProject({ ...project, activeSceneId: scene.id });
  setPlayback({ kind: "scene", sceneId: scene.id });
  replay();

  return ok(`Focused ${sceneLabel(scene)}. Headline: "${scene.headline}"`);
}

export function setPlayback(mode: PlaybackMode): ActionResult {
  useStudioStore.getState().setPlayback(mode);
  replay();
  return ok(
    mode.kind === "film"
      ? "Playing the full board."
      : `Playing ${mode.sceneId}.`,
  );
}

export function replayCurrent(): ActionResult {
  replay();
  return ok("Restarted playback.");
}

// ---------------------------------------------------------------------------
// Scene edits
// ---------------------------------------------------------------------------

/** Fields a caller may change. Everything else is structural and fixed. */
export type ScenePatch = Partial<
  Pick<
    Scene,
    "headline" | "body" | "componentId" | "motionPreset" | "emphasis"
  >
>;

type EditOptions = {
  origin: ActionOrigin;
  /** Agent edits land as drafts; human edits keep the current approval. */
  revisionNote?: string;
};

function applyPatch(
  sceneId: SceneId,
  patch: ScenePatch,
  options: EditOptions,
): ActionResult {
  const { project } = useStudioStore.getState();
  const scene = findScene(project, sceneId);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);

  const isAgent = options.origin === "agent";

  const candidate: Scene = {
    ...scene,
    ...patch,
    ...(isAgent
      ? {
          approval: "draft" as const,
          ...(options.revisionNote !== undefined
            ? { revisionNote: options.revisionNote }
            : {}),
          // Remember the headline being replaced so the diff is showable and
          // "Keep current" can restore it.
          ...(patch.headline !== undefined && patch.headline !== scene.headline
            ? { previousHeadline: scene.previousHeadline ?? scene.headline }
            : {}),
        }
      : {}),
  };

  // Field-level validation first, so the caller gets a precise message rather
  // than a whole-graph complaint.
  const sceneCheck = SceneSchema.safeParse(candidate);
  if (!sceneCheck.success) {
    return fail("invalid-input", explainZodError(sceneCheck.error));
  }

  if (patch.componentId !== undefined) {
    const known = project.product.componentCandidates.some(
      (c) => c.id === patch.componentId,
    );
    if (!known) {
      const available = project.product.componentCandidates
        .map((c) => c.id)
        .join(", ");
      return fail(
        "unknown-component",
        `unknown componentId "${patch.componentId}". Available: ${available}`,
      );
    }
  }

  const changed = Object.keys(patch).filter(
    (key) =>
      patch[key as keyof ScenePatch] !== scene[key as keyof ScenePatch],
  );
  if (changed.length === 0) return ok(`No change to ${sceneLabel(scene)}.`);

  const next = withActivity(
    {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId ? sceneCheck.data : s,
      ),
      activeSceneId: sceneId,
    },
    {
      origin: options.origin,
      label: isAgent ? "prism.revise_scene_draft" : "Edited scene",
      detail: `${sceneLabel(scene)} · ${changed.join(", ")}`,
      sceneId,
    },
  );

  const rejected = commit(next);
  if (rejected) return rejected;

  replay();
  return ok(
    isAgent
      ? `Drafted changes to ${sceneLabel(scene)} (${changed.join(", ")}). Awaiting human approval.`
      : `Updated ${sceneLabel(scene)} (${changed.join(", ")}).`,
  );
}

/** A human editing directly. Approval state is untouched. */
export function updateScene(sceneId: SceneId, patch: ScenePatch): ActionResult {
  return applyPatch(sceneId, patch, { origin: "human" });
}

/**
 * An agent proposing a change. Always lands as a draft — there is no argument
 * that makes this accept.
 */
export function reviseSceneDraft(
  sceneId: SceneId,
  patch: ScenePatch,
  revisionNote: string,
): ActionResult {
  return applyPatch(sceneId, patch, { origin: "agent", revisionNote });
}

// ---------------------------------------------------------------------------
// The approval boundary — human only, never registered as a tool
// ---------------------------------------------------------------------------

function resolveDraft(sceneId: SceneId, accepted: boolean): ActionResult {
  const { project } = useStudioStore.getState();
  const scene = findScene(project, sceneId);
  if (!scene) return fail("unknown-scene", `unknown scene "${sceneId}"`);
  if (scene.approval !== "draft") {
    return fail("no-draft", `${sceneLabel(scene)} has no pending draft.`);
  }

  const restored =
    !accepted && scene.previousHeadline ? scene.previousHeadline : scene.headline;

  const settled: Scene = {
    ...scene,
    approval: "accepted",
    headline: restored,
  };
  delete settled.revisionNote;
  delete settled.previousHeadline;

  const next = withActivity(
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
  );

  const rejected = commit(next);
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

// ---------------------------------------------------------------------------
// Film-level settings
// ---------------------------------------------------------------------------

export function setArtDirection(direction: ArtDirection): ActionResult {
  const parsed = ArtDirectionSchema.safeParse(direction);
  if (!parsed.success) {
    const available = Object.keys(PALETTES).join(", ");
    return fail(
      "invalid-input",
      `unknown art direction "${String(direction)}". Available: ${available}`,
    );
  }

  const { project } = useStudioStore.getState();
  if (project.brief.artDirection === parsed.data) {
    return ok(`Already using ${parsed.data}.`);
  }

  const next = withActivity(
    { ...project, brief: { ...project.brief, artDirection: parsed.data } },
    {
      origin: "human",
      label: "Changed art direction",
      detail: parsed.data,
    },
  );

  const rejected = commit(next);
  if (rejected) return rejected;

  replay();
  return ok(`Art direction is now ${parsed.data}.`);
}

// ---------------------------------------------------------------------------
// Read model — what a WebMCP read tool returns
// ---------------------------------------------------------------------------

/**
 * A small, structured summary of the board. Deliberately excludes raw source
 * text: evidence snippets are untrusted and belong behind the
 * `untrustedContentHint` annotation, not in a general context dump
 * (invariant 6).
 */
export function getProjectContext() {
  const { project } = useStudioStore.getState();

  return {
    productName: project.product.productName,
    promise: project.brief.promise,
    artDirection: project.brief.artDirection,
    activeSceneId: project.activeSceneId,
    pendingDraftSceneId:
      project.scenes.find((s) => s.approval === "draft")?.id ?? null,
    candidates: project.product.componentCandidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      kind: candidate.kind,
    })),
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      template: scene.template,
      headline: scene.headline,
      ...(scene.body !== undefined ? { body: scene.body } : {}),
      ...(scene.componentId !== undefined
        ? { componentId: scene.componentId }
        : {}),
      motionPreset: scene.motionPreset,
      emphasis: scene.emphasis,
      approval: scene.approval,
      durationFrames: scene.durationFrames,
    })),
  };
}
