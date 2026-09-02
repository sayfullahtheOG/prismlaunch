import { generateStoryboard } from "./generator";
import {
  createFilmProject,
  DEFAULT_ART_DIRECTION,
  initialBrief,
} from "./new-project";
import { PALETTES } from "./palettes";
import {
  ArtDirectionSchema,
  explainZodError,
  FilmProjectSchema,
  SceneIdSchema,
  SceneSchema,
} from "./schema";
import { nowTimecode, useStudioStore, type PlaybackMode } from "./store";
import type { RenderSnapshot } from "@/lib/render/job";
import type {
  ActivityEvent,
  ArtDirection,
  Brief,
  FilmProject,
  ProductManifest,
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
  | "no-project"
  | "inspection-failed"
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

/**
 * Every action that edits a film needs one to exist. Rather than each caller
 * re-checking, this returns a ready-made corrective message that tells an agent
 * exactly what to do next — which is the whole contract for a tool result.
 */
function requireProject():
  | { ok: true; project: FilmProject }
  | { ok: false; result: ActionResult } {
  const { project } = useStudioStore.getState();
  if (!project) {
    return {
      ok: false,
      result: fail(
        "no-project",
        "There is no film yet. Inspect a source first — the built-in demo product, a public GitHub repository, or a local folder.",
      ),
    };
  }
  return { ok: true, project };
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

  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { project } = guard;
  const { setPlayback } = useStudioStore.getState();
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

/**
 * Fields a caller may change. Everything else is structural and fixed.
 *
 * Explicitly `| undefined` on each key: under `exactOptionalPropertyTypes`, an
 * absent property and one set to `undefined` are different types, and a patch
 * assembled from optional tool input always carries the latter.
 */
export type ScenePatch = {
  [K in "headline" | "body" | "componentId" | "motionPreset" | "emphasis"]?:
    | Scene[K]
    | undefined;
};

type EditOptions = {
  origin: ActionOrigin;
  /** Agent edits land as drafts; human edits keep the current approval. */
  revisionNote?: string;
};

/**
 * Drop keys whose value is `undefined`.
 *
 * A tool's optional field arrives as an explicit `undefined` when the agent
 * omitted it, and spreading that over the scene would erase a required value.
 * Omitted means "leave it alone"; clearing an optional line is done by passing
 * an empty string.
 */
type AppliedPatch = {
  [K in keyof ScenePatch]?: Scene[K];
};

function defined(patch: ScenePatch): AppliedPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as AppliedPatch;
}

function applyPatch(
  sceneId: SceneId,
  rawPatch: ScenePatch,
  options: EditOptions,
): ActionResult {
  const patch = defined(rawPatch);
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { project } = guard;
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
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { project } = guard;
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

  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { project } = guard;
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
 *
 * `film` is null before anyone has inspected a source. It is a key rather than
 * an absence so the agent reads a fact with a remedy attached, instead of
 * having to infer one from a missing field.
 */
export function getProjectContext() {
  const { project } = useStudioStore.getState();

  // Told plainly, with the remedy attached: an agent reading this is one tool
  // call away from fixing it, and should not have to infer that from a null.
  if (!project) {
    return {
      film: null,
      note: "No film exists yet. Call prism.inspect_public_repo with a repository the person named, or ask them to pick a source in the app.",
    };
  }

  return {
    film: {
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
    },
  };
}


// ---------------------------------------------------------------------------
// Source inspection
// ---------------------------------------------------------------------------

export type InspectKind = "demo" | "github" | "local";

/**
 * Replace the product manifest by inspecting a source, then regenerate the
 * board from it.
 *
 * This is the action `prism.inspect_public_repo` will wrap in Phase 3 — the
 * agent gets no separate code path, so whatever a human can inspect, an agent
 * can, with identical validation and identical visible results.
 *
 * Regenerating is the right call rather than keeping the old scenes: the
 * previous board referenced components from a different product, and a
 * spotlight pointing at a componentId that no longer exists would fail
 * validation anyway.
 */
export async function inspectSource(
  kind: InspectKind,
  ref: string,
  focus = "",
): Promise<ActionResult> {
  let response: Response;
  try {
    response = await fetch("/api/inspect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, ref, focus }),
    });
  } catch {
    return fail("inspection-failed", "Could not reach the inspection service.");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || !body || typeof body !== "object" || !("ok" in body)) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : "Inspection failed.";
    return fail("inspection-failed", message);
  }

  const payload = body as
    | { ok: true; manifest: ProductManifest }
    | { ok: false; message: string };

  if (!payload.ok) return fail("inspection-failed", payload.message);

  const manifest = payload.manifest;
  const { project } = useStudioStore.getState();

  // Art direction is the one thing worth carrying across an inspection: it is
  // a taste decision about the film, not a fact about the product. Everything
  // else is rebuilt, because the previous board described a different product.
  const brief: Brief = initialBrief(
    manifest,
    project?.brief.artDirection ?? DEFAULT_ART_DIRECTION,
  );

  const base: FilmProject = project ?? createFilmProject(manifest, brief);

  const next = withActivity(
    {
      ...base,
      product: manifest,
      brief,
      scenes: generateStoryboard(manifest, brief),
      activeSceneId: "scene-01",
    },
    {
      origin: "human",
      label: project ? "Inspected source" : "Started a film",
      detail: `${manifest.productName} · ${manifest.componentCandidates.length} candidates`,
    },
  );

  const rejected = commit(next);
  if (rejected) return rejected;

  replay();

  const warnings = manifest.inspectionWarnings.length;
  return ok(
    `Inspected ${manifest.productName}: found ${manifest.componentCandidates.length} component candidate${manifest.componentCandidates.length === 1 ? "" : "s"}${warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}. Storyboard regenerated.`,
  );
}

// ---------------------------------------------------------------------------
// Storyboard regeneration
// ---------------------------------------------------------------------------

export type RegenerateOptions = {
  artDirection?: ArtDirection | undefined;
  focusComponentId?: string | undefined;
  promise?: string | undefined;
};

/**
 * Rebuild all four scenes from the current manifest and brief.
 *
 * Every scene comes back `accepted`, because the generator is deterministic
 * and authored by us — there is nothing for a human to review that they did
 * not already ask for. An agent adjusting one shot afterwards goes through
 * `reviseSceneDraft`, which does create a draft.
 */
export function regenerateStoryboard(
  options: RegenerateOptions = {},
): ActionResult {
  const guard = requireProject();
  if (!guard.ok) return guard.result;
  const { project } = guard;

  if (options.artDirection && !ArtDirectionSchema.safeParse(options.artDirection).success) {
    return fail(
      "invalid-input",
      `unknown art direction "${options.artDirection}". Available: ${Object.keys(PALETTES).join(", ")}`,
    );
  }

  if (options.focusComponentId) {
    const known = project.product.componentCandidates.some(
      (candidate) => candidate.id === options.focusComponentId,
    );
    if (!known) {
      const available = project.product.componentCandidates
        .map((candidate) => candidate.id)
        .join(", ");
      return fail(
        "unknown-component",
        `unknown componentId "${options.focusComponentId}". Available: ${available || "none — inspect a source first"}`,
      );
    }
  }

  const brief = {
    ...project.brief,
    ...(options.artDirection ? { artDirection: options.artDirection } : {}),
    ...(options.promise ? { promise: options.promise } : {}),
    ...(options.focusComponentId
      ? { selectedComponentIds: [options.focusComponentId] }
      : {}),
  };

  let scenes;
  try {
    scenes = generateStoryboard(project.product, brief);
  } catch (error) {
    return fail(
      "graph-invalid",
      error instanceof Error ? error.message : "Could not build a storyboard.",
    );
  }

  const next = withActivity(
    { ...project, brief, scenes, activeSceneId: "scene-01" },
    {
      origin: "agent",
      label: "prism.create_storyboard_draft",
      detail: `Rebuilt 4 scenes · ${brief.artDirection}`,
    },
  );

  const rejected = commit(next);
  if (rejected) return rejected;

  replay();
  return ok(
    `Rebuilt the storyboard in ${brief.artDirection}: ${scenes.map((s) => `${s.id} "${s.headline}"`).join(", ")}. All four scenes are accepted and ready to review.`,
  );
}

// ---------------------------------------------------------------------------
// The render gate — two phases, and the agent can only take the first
// ---------------------------------------------------------------------------

/**
 * Phase 1. Renders nothing.
 *
 * Posts the accepted board to the server, which records a snapshot and mints a
 * short-lived confirmation. The confirm sheet then appears in the app for a
 * human to approve. The returned message deliberately tells the agent to wait.
 */
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
  const { project } = guard;

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
      result: fail("inspection-failed", "Could not reach the render service."),
    };
  }

  if (!body.ok || !body.confirmationId) {
    return {
      ok: false,
      result: fail(
        "invalid-input",
        body.message ?? "Could not propose a render.",
      ),
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
    withActivity(guard.project, {
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
 * encodes it with WebCodecs. Splitting it this way keeps the gate structural
 * (only the server can release a snapshot) while the work happens locally, so
 * no endpoint spends CPU on video.
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
    return fail("inspection-failed", "Could not reach the render service.");
  }

  const body: {
    ok: boolean;
    message?: string;
    jobId?: string;
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

  downloadBlob(outcome.blob, outcome.filename);
  useStudioStore.getState().setPendingRender(null);

  const megabytes = (outcome.blob.size / 1_000_000).toFixed(1);
  return ok(`Rendered ${outcome.filename} (${megabytes} MB). The download has started.`);
}

/**
 * Phase 2 — HUMAN ONLY, wired to the confirm sheet's button.
 *
 * Deliberately not exported through any tool. This is the click the whole gate
 * turns on.
 */
export async function approveRender(confirmationId: string): Promise<ActionResult> {
  try {
    await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve", confirmationId }),
    });
  } catch {
    return fail("inspection-failed", "Could not reach the render service.");
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
