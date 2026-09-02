import { NextResponse } from "next/server";
import { z } from "zod";
import { startRender, isRenderAvailable, unavailableReason } from "@/lib/render/backend";
import {
  approve,
  consume,
  getConfirmation,
  propose,
  setStatus,
  snapshotAccepted,
} from "@/lib/render/job";
import { checkRate, clientKey } from "@/lib/render/rate-limit";
import { explainZodError, FilmProjectSchema } from "@/lib/studio/schema";

/**
 * The render endpoint, in three explicit phases.
 *
 * `propose` records what would be rendered and mints a token. `approve` is the
 * human's click. `confirm` starts the render and accepts nothing but the token,
 * so it can only replay what `propose` recorded. See lib/render/job.ts.
 *
 * Node runtime: Remotion cannot render on edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), project: z.unknown(), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal("approve"), confirmationId: z.string().max(120) }),
  z.object({ action: z.literal("confirm"), confirmationId: z.string().max(120) }),
]);

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: explainZodError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // ---- phase 1: propose. Renders nothing. ----
  if (input.action === "propose") {
    const project = FilmProjectSchema.safeParse(input.project);
    if (!project.success) {
      return NextResponse.json(
        { ok: false, message: explainZodError(project.error) },
        { status: 400 },
      );
    }

    const snapshot = snapshotAccepted(project.data);
    if (!snapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "has-draft",
          message:
            "The board still has an unreviewed draft. Accept or discard it before rendering.",
        },
        { status: 409 },
      );
    }

    const { confirmationId, summary } = propose(snapshot, input.reason);
    return NextResponse.json({
      ok: true,
      status: "needs_confirmation",
      confirmationId,
      summary,
      renderAvailable: isRenderAvailable(),
    });
  }

  // ---- phase 2: approve. Human click only. ----
  if (input.action === "approve") {
    const granted = approve(input.confirmationId);
    if (!granted) {
      return NextResponse.json(
        { ok: false, message: "That confirmation is unknown, expired, or already handled." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, status: "approved" });
  }

  // ---- phase 3: confirm. Replays the recorded snapshot. ----
  const limit = checkRate(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `Too many renders. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const result = consume(input.confirmationId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.code === "not-approved" ? 403 : 409 },
    );
  }

  if (!isRenderAvailable()) {
    setStatus(result.jobId, { state: "failed", message: unavailableReason() });
    return NextResponse.json(
      { ok: false, code: "unavailable", message: unavailableReason(), jobId: result.jobId },
      { status: 503 },
    );
  }

  const started = await startRender(result.jobId, result.snapshot, setStatus);
  if (!started.ok) {
    setStatus(result.jobId, { state: "failed", message: started.message });
    return NextResponse.json(
      { ok: false, code: "render-failed", message: started.message, jobId: result.jobId },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, status: "started", jobId: result.jobId });
}

/** Lets the UI show the confirm sheet an agent raised. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("confirmationId");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing confirmationId." }, { status: 400 });
  }

  const confirmation = getConfirmation(id);
  if (!confirmation) {
    return NextResponse.json({ ok: false, message: "Unknown confirmation." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    state: confirmation.state,
    summary: confirmation.summary,
    reason: confirmation.reason ?? null,
  });
}
