import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approve,
  consume,
  getConfirmation,
  propose,
  setStatus,
  snapshotAccepted,
} from "@/lib/render/job";
import { explainZodError, FilmProjectSchema } from "@/lib/studio/schema";

/**
 * The render AUTHORISATION endpoint, in three explicit phases.
 *
 * `propose` records what would be rendered and mints a token. `approve` is the
 * human's click. `confirm` releases the recorded snapshot and accepts nothing
 * but the token, so a caller holding it can replay what `propose` recorded but
 * cannot change it. See lib/render/job.ts.
 *
 * Encoding itself happens in the browser (lib/render/web-render.ts), so this
 * route spends no CPU on video and needs no rate limiter to protect a bill.
 * It only decides *whether* a render may proceed, never performs one.
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
      // Whether encoding is possible is a fact about the visitor's browser,
      // so the client probes it rather than the server guessing.
      renderAvailable: true,
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

  // ---- phase 3: confirm. Releases the recorded snapshot. ----
  const result = consume(input.confirmationId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.code === "not-approved" ? 403 : 409 },
    );
  }

  // The snapshot travels back so the browser encodes exactly what was recorded
  // at propose time — not whatever the board happens to look like now.
  setStatus(result.jobId, { state: "rendering", progress: 0 });
  return NextResponse.json({
    ok: true,
    status: "authorised",
    jobId: result.jobId,
    snapshot: result.snapshot,
  });
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
