import { NextResponse } from "next/server";
import { z } from "zod";
import { demoManifest } from "@/lib/source/demo-manifest";
import { buildManifest } from "@/lib/source/extract";
import { GitHubProvider, parseRepoUrl } from "@/lib/source/github";
import { isLocalProviderEnabled, LocalProvider } from "@/lib/source/local";
import { InspectError, type InspectErrorCode } from "@/lib/source/provider";
import { explainZodError, ProductManifestSchema } from "@/lib/studio/schema";
import type { ProductManifest } from "@/types/prism";

/**
 * Source inspection.
 *
 * Node runtime, never edge — the local provider needs `fs`, and edge has no
 * filesystem. Never cached at the framework level; caching is handled below,
 * keyed on the exact reference, so a repository that changed is re-read.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["demo", "github", "local"]),
  /** Repo URL or absolute folder path. Ignored for `demo`. */
  ref: z.string().max(400).optional(),
  /** What the user wants to feature. Free text, untrusted, bounded. */
  focus: z.string().max(120).optional(),
});

type Ok = { ok: true; manifest: ProductManifest; cached: boolean };
type Err = { ok: false; code: InspectErrorCode | "invalid-input"; message: string };

/**
 * A tiny in-process cache. Protects GitHub's rate limit when a judge scans the
 * same repository twice, and makes a re-scan feel instant. Lost on cold start,
 * which is fine — it is derived data.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; manifest: ProductManifest }>();

function readCache(key: string): ProductManifest | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.manifest;
}

function fail(
  code: Err["code"],
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse<Err> {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

export async function POST(request: Request): Promise<NextResponse<Ok | Err>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid-input", "Expected a JSON body.", 400);
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return fail("invalid-input", explainZodError(parsed.error), 400);
  }

  const { kind, ref = "", focus = "" } = parsed.data;

  // The demo product is pre-authored and always available — the deterministic
  // path the demo relies on when the network or a rate limit is against us.
  if (kind === "demo") {
    return NextResponse.json({
      ok: true,
      manifest: demoManifest,
      cached: false,
    });
  }

  if (kind === "local" && !isLocalProviderEnabled()) {
    return fail(
      "not-available",
      "Reading a local folder only works when running PrismLaunch on your own machine.",
      403,
    );
  }

  // Validate the GitHub URL before doing any work, so a typo costs no request.
  if (kind === "github" && !parseRepoUrl(ref)) {
    return fail(
      "invalid-url",
      "Enter a public repository URL like https://github.com/owner/repo.",
      400,
    );
  }

  const cacheKey = `${kind}:${ref}:${focus}`;
  const hit = readCache(cacheKey);
  if (hit) return NextResponse.json({ ok: true, manifest: hit, cached: true });

  try {
    const manifest =
      kind === "github"
        ? await inspectGitHub(ref, focus)
        : await inspectLocal(ref, focus);

    // Validate before it can reach the store or a tool result.
    const checked = ProductManifestSchema.safeParse(manifest);
    if (!checked.success) {
      return fail(
        "no-evidence",
        `Inspection produced an unusable manifest: ${explainZodError(checked.error)}`,
        422,
      );
    }

    cache.set(cacheKey, { at: Date.now(), manifest: checked.data });
    return NextResponse.json({ ok: true, manifest: checked.data, cached: false });
  } catch (error) {
    if (error instanceof InspectError) {
      // Map onto statuses that describe what actually happened. `no-evidence`
      // is a fact about the repository, not a gateway failure.
      const STATUS: Record<string, number> = {
        "invalid-url": 400,
        "not-found": 404,
        private: 404,
        "not-available": 403,
        "rate-limited": 429,
        "no-evidence": 422,
        "too-large": 422,
        network: 502,
      };
      const status = STATUS[error.code] ?? 502;

      return fail(
        error.code,
        error.message,
        status,
        error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : undefined,
      );
    }

    // Never leak an internal message — it could contain a token or a path.
    console.error("[inspect] unexpected failure", error);
    return fail("network", "Inspection failed unexpectedly. Try again.", 500);
  }
}

async function inspectGitHub(ref: string, focus: string) {
  const provider = new GitHubProvider();
  const load = await provider.load(ref);
  const meta = provider.meta;

  return buildManifest({
    load,
    source: "github-public",
    focus,
    fallbackName: meta?.repo ?? "This product",
    ...(meta
      ? {
          repository: {
            owner: meta.owner,
            repo: meta.repo,
            defaultBranch: meta.defaultBranch,
          },
        }
      : {}),
  });
}

async function inspectLocal(ref: string, focus: string) {
  const provider = new LocalProvider();
  const load = await provider.load(ref);
  const folder = provider.root?.split("/").filter(Boolean).at(-1);

  return buildManifest({
    load,
    source: "local",
    focus,
    fallbackName: folder ?? "This product",
  });
}
