import { randomUUID } from "node:crypto";
import type { FilmProject, Scene } from "@/types/prism";

/**
 * The two-phase render gate, and the job lifecycle behind it.
 *
 * The gate is the product's central safety claim, so it is structural rather
 * than a rule written in a tool description:
 *
 *   1. `propose()` records a snapshot of the ACCEPTED scenes and mints a
 *      short-lived, single-use confirmation. It renders nothing.
 *   2. A HUMAN approves it in the app — `approve()` is reachable only from a
 *      real click, never from a tool.
 *   3. `consume()` starts the render, and only succeeds for a confirmation a
 *      human has already approved.
 *
 * The asymmetry is the point. The second call carries no scene data at all, so
 * a caller that held the token still cannot change what gets rendered — it can
 * only replay exactly what step 1 recorded. An agent that guessed a token still
 * gets nothing, because the token is worthless until a human approves it.
 *
 * Compare `humanConfirmed: true`, which the original brief proposed: that is a
 * field the agent fills in itself, so it grants its own permission.
 */

export type RenderSnapshot = {
  scenes: Scene[];
  artDirection: FilmProject["brief"]["artDirection"];
  candidates: FilmProject["product"]["componentCandidates"];
  productName: string;
};

export type ConfirmationState = "pending" | "approved" | "consumed";

type Confirmation = {
  id: string;
  state: ConfirmationState;
  snapshot: RenderSnapshot;
  summary: string;
  createdAt: number;
  /** Why the agent thinks it is ready. Display-only, bounded. */
  reason?: string;
};

export type RenderStatus =
  | { state: "queued" }
  | { state: "rendering"; progress: number }
  | { state: "done"; url: string }
  | { state: "failed"; message: string };

type Job = {
  id: string;
  status: RenderStatus;
  snapshot: RenderSnapshot;
  startedAt: number;
};

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const JOB_TTL_MS = 60 * 60 * 1000;

// In-process only. Lost on cold start, which is correct: a confirmation that
// outlived the process should not be honoured, and a lost job reads as expired
// rather than as an error.
const confirmations = new Map<string, Confirmation>();
const jobs = new Map<string, Job>();

function sweep(): void {
  const now = Date.now();
  for (const [id, item] of confirmations) {
    if (now - item.createdAt > CONFIRMATION_TTL_MS) confirmations.delete(id);
  }
  for (const [id, job] of jobs) {
    if (now - job.startedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

/** Step 1. Writes nothing renderable — records intent and returns a token. */
export function propose(
  snapshot: RenderSnapshot,
  reason?: string,
): { confirmationId: string; summary: string } {
  sweep();

  const seconds = snapshot.scenes.reduce((n, s) => n + s.durationFrames, 0) / 24;
  const summary = `Render “${snapshot.productName}” — ${snapshot.scenes.length} accepted scenes, ${seconds.toFixed(1)}s, 960×540 MP4.`;

  const confirmation: Confirmation = {
    id: `cnf_${randomUUID()}`,
    state: "pending",
    snapshot,
    summary,
    createdAt: Date.now(),
    ...(reason ? { reason } : {}),
  };

  confirmations.set(confirmation.id, confirmation);
  return { confirmationId: confirmation.id, summary };
}

export function getConfirmation(id: string): Confirmation | null {
  sweep();
  return confirmations.get(id) ?? null;
}

/** The pending proposal a human is being asked about, if any. */
export function pendingConfirmation(): Confirmation | null {
  sweep();
  for (const confirmation of confirmations.values()) {
    if (confirmation.state === "pending") return confirmation;
  }
  return null;
}

/**
 * Step 2 — HUMAN ONLY.
 *
 * Never call this from a tool executor. It is reachable from the confirm
 * sheet's click handler and nowhere else; that restriction is what makes the
 * token meaningful.
 */
export function approve(id: string): boolean {
  const confirmation = getConfirmation(id);
  if (!confirmation || confirmation.state !== "pending") return false;
  confirmation.state = "approved";
  return true;
}

export type ConsumeResult =
  | { ok: true; jobId: string; snapshot: RenderSnapshot }
  | { ok: false; code: "unknown" | "not-approved" | "already-used"; message: string };

/** Step 3. Only succeeds for a confirmation a human already approved. */
export function consume(id: string): ConsumeResult {
  const confirmation = getConfirmation(id);

  if (!confirmation) {
    return {
      ok: false,
      code: "unknown",
      message: "That confirmation is unknown or has expired. Ask for a new render.",
    };
  }

  if (confirmation.state === "consumed") {
    return {
      ok: false,
      code: "already-used",
      message: "That confirmation has already been used.",
    };
  }

  if (confirmation.state !== "approved") {
    return {
      ok: false,
      code: "not-approved",
      message:
        "Nobody has approved this render yet. The person needs to confirm it in PrismLaunch first.",
    };
  }

  confirmation.state = "consumed";

  const job: Job = {
    id: `rnd_${randomUUID()}`,
    status: { state: "queued" },
    snapshot: confirmation.snapshot,
    startedAt: Date.now(),
  };
  jobs.set(job.id, job);

  return { ok: true, jobId: job.id, snapshot: job.snapshot };
}

export function getJob(id: string): Job | null {
  sweep();
  return jobs.get(id) ?? null;
}

export function setStatus(id: string, status: RenderStatus): void {
  const job = jobs.get(id);
  if (job) job.status = status;
}

/**
 * Only accepted scenes ever reach a render. A draft in the graph means the
 * human has not signed off, so there is nothing legitimate to export
 * (context/architecture.md invariant 4).
 */
export function snapshotAccepted(project: FilmProject): RenderSnapshot | null {
  if (project.scenes.some((scene) => scene.approval === "draft")) return null;

  return {
    scenes: project.scenes.map((scene) => ({ ...scene })),
    artDirection: project.brief.artDirection,
    candidates: project.product.componentCandidates,
    productName: project.product.productName,
  };
}
