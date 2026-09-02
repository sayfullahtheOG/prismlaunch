import type { RenderSnapshot, RenderStatus } from "./job";

/**
 * Where a render actually happens.
 *
 * Remotion cannot render on edge runtimes — not Vercel Edge, not Cloudflare
 * Workers — so the only supported path is Node plus a Vercel Sandbox, which
 * needs both a Vercel deployment and a Blob token to return the file.
 *
 * Locally neither exists, and the honest thing is to say so rather than ship a
 * button that silently does nothing (invariant 16). `isRenderAvailable()`
 * drives the disabled state and its tooltip, so the UI never claims a
 * capability the environment does not have.
 */

export function isRenderAvailable(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function unavailableReason(): string {
  return "Rendering needs a deployed environment with BLOB_READ_WRITE_TOKEN set. The live preview still reflects every edit.";
}

export type StartResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Kick off a render. Deliberately dynamic-imports @remotion/vercel so the
 * heavy renderer is not pulled into the module graph on a machine that cannot
 * use it, and so a missing dependency degrades to a message rather than a
 * crash at import time.
 */
export async function startRender(
  jobId: string,
  snapshot: RenderSnapshot,
  onStatus: (jobId: string, status: RenderStatus) => void,
): Promise<StartResult> {
  if (!isRenderAvailable()) {
    return { ok: false, message: unavailableReason() };
  }

  try {
    const { createSandbox, renderMediaOnVercel } = await import(
      "@remotion/vercel"
    );

    onStatus(jobId, { state: "rendering", progress: 0 });

    const sandbox = await createSandbox();
    await renderMediaOnVercel({
      sandbox,
      compositionId: "LaunchFilm",
      inputProps: {
        scenes: snapshot.scenes,
        artDirection: snapshot.artDirection,
        candidates: snapshot.candidates,
      },
      codec: "h264",
      detached: true,
      vercelBlob: {
        blobToken: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "public",
      },
    });

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Render failed to start.";
    return { ok: false, message };
  }
}
