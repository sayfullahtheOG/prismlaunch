import type { RenderSnapshot } from "./job";

/**
 * Client-side rendering.
 *
 * The film is encoded in the browser with WebCodecs (via @remotion/web-renderer
 * and Mediabunny) instead of a headless Chromium on a server. That removes the
 * entire server render path — no Vercel Sandbox, no Blob token, no
 * unauthenticated endpoint spending CPU, and therefore no rate limiter guarding
 * a bill.
 *
 * The product's central claim survives intact, and is arguably stronger: the
 * SAME `LaunchFilm` component that the `<Player>` mounts is the one encoded
 * here, in the same browser, from the same snapshot. Preview and export cannot
 * drift because there is only one runtime now.
 *
 * Everything here is dynamically imported so the encoder never enters the
 * initial bundle — it is only fetched when someone actually renders.
 */

export type RenderProgress = {
  /** 0–1. */
  progress: number;
  encodedFrames: number;
  /** Milliseconds, once encoding has finished. */
  doneIn: number | null;
};

export type RenderCapability =
  | { ok: true }
  | { ok: false; reason: string };

const WIDTH = 960;
const HEIGHT = 540;
const FPS = 24;

/**
 * Ask the browser whether it can actually encode this, rather than assuming.
 *
 * WebCodecs is absent in some browsers and some codecs are unavailable even
 * where it exists, so the Export button's disabled state and its tooltip come
 * from a real probe. No control claims a capability the environment lacks.
 */
export async function probeRenderSupport(): Promise<RenderCapability> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Rendering runs in the browser." };
  }

  try {
    const { canRenderMediaOnWeb } = await import("@remotion/web-renderer");
    const result = await canRenderMediaOnWeb({
      container: "mp4",
      videoCodec: "h264",
      width: WIDTH,
      height: HEIGHT,
      muted: true,
    });

    if (result.canRender) return { ok: true };

    const blocking = result.issues.find((issue) => issue.severity === "error");
    return {
      ok: false,
      reason:
        blocking?.message ??
        "This browser cannot encode video. Chrome, Edge, or a recent Firefox can.",
    };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Could not load the video encoder.",
    };
  }
}

export type RenderOutcome =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; message: string };

/** `vector-launch-film.mp4` — safe on every filesystem. */
function filenameFor(productName: string): string {
  const slug =
    productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "prismlaunch";
  return `${slug}-launch-film.mp4`;
}

export async function renderFilmInBrowser(
  snapshot: RenderSnapshot,
  onProgress?: (progress: RenderProgress) => void,
  signal?: AbortSignal,
): Promise<RenderOutcome> {
  try {
    const [{ renderMediaOnWeb }, { LaunchFilm }] = await Promise.all([
      import("@remotion/web-renderer"),
      import("@/remotion/LaunchFilm"),
    ]);

    const durationInFrames = snapshot.scenes.reduce(
      (total, scene) => total + scene.durationFrames,
      0,
    );

    const props = {
      scenes: snapshot.scenes,
      artDirection: snapshot.artDirection,
    };

    const result = await renderMediaOnWeb({
      composition: {
        id: "LaunchFilm",
        component: LaunchFilm,
        durationInFrames,
        fps: FPS,
        width: WIDTH,
        height: HEIGHT,
        // Required because LaunchFilm has non-optional props. Same values as
        // inputProps: there is only ever one snapshot being rendered.
        defaultProps: props,
      },
      inputProps: props,
      container: "mp4",
      videoCodec: "h264",
      // The film has no audio track; saying so avoids encoding silence.
      muted: true,
      ...(signal ? { signal } : {}),
      ...(onProgress
        ? {
            onProgress: (p) =>
              onProgress({
                progress: p.progress,
                encodedFrames: p.encodedFrames,
                doneIn: p.doneIn,
              }),
          }
        : {}),
    });

    return {
      ok: true,
      blob: await result.getBlob(),
      filename: filenameFor(snapshot.productName),
    };
  } catch (error) {
    if (signal?.aborted) return { ok: false, message: "Render cancelled." };
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "The render failed to finish.",
    };
  }
}

/**
 * Hand the finished file to the user.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking
 * synchronously can cancel the download in some browsers before it starts.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
