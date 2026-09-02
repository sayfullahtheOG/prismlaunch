import { NextResponse } from "next/server";
import { getJob } from "@/lib/render/job";

export const runtime = "nodejs";
/** Never cached — this is polled while a render is in flight. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);

  // A job the process no longer knows about is expired, not broken. Saying so
  // is more useful than a 500 the user cannot act on.
  if (!job) {
    return NextResponse.json(
      { ok: false, state: "expired", message: "That render is no longer available." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...job.status });
}
