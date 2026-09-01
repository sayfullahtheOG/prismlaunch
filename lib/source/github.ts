import {
  InspectError,
  looksGenerated,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  selectPaths,
  type SourceFile,
  type SourceLoad,
  type SourceProvider,
} from "./provider";

/**
 * Reads a public GitHub repository. Never clones, installs, builds, or runs
 * anything — it fetches text over HTTPS and hands it to the extractor.
 *
 * Request budget is the design constraint here. GitHub's anonymous REST limit
 * is 60/hour per IP, so fetching each file through the API (one request per
 * blob) would let a judge exhaust the quota in two scans. Instead this uses
 * the REST API only twice — repository metadata and the recursive tree — and
 * pulls file contents from raw.githubusercontent.com, which is served from a
 * different budget. An inspection therefore costs 2 API requests, not ~40.
 */

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

export type RepoRef = { owner: string; repo: string };

/**
 * Accepts only `https://github.com/{owner}/{repo}`, with optional `.git`,
 * trailing slash, or deep path. Anything else is rejected rather than
 * normalised — this value drives an outbound fetch, so guessing is unsafe.
 */
export function parseRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return null;

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repoRaw] = segments;
  if (!owner || !repoRaw) return null;

  const repo = repoRaw.replace(/\.git$/i, "");

  const NAME = /^[A-Za-z0-9._-]+$/;
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  if (owner.length > 100 || repo.length > 100) return null;

  return { owner, repo };
}

function headers(): HeadersInit {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "prismlaunch",
  };

  // Server-only. Raises 60 req/hour to 5,000. Never sent to the browser and
  // never included in any response body (architecture.md invariant 13).
  const token = process.env.GITHUB_TOKEN;
  if (token) base.Authorization = `Bearer ${token}`;

  return base;
}

/** Map an unhappy response onto an error the UI can act on. */
function toInspectError(response: Response, what: string): InspectError {
  if (response.status === 404) {
    // GitHub returns 404 rather than 403 for private repos seen anonymously,
    // so the message has to cover both without guessing which it was.
    return new InspectError(
      "not-found",
      "That repository could not be found. It may be private, renamed, or misspelled — PrismLaunch reads public repositories only.",
    );
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = Number(response.headers.get("x-ratelimit-reset") ?? 0);

    if (remaining === "0" && reset > 0) {
      const seconds = Math.max(0, reset - Math.floor(Date.now() / 1000));
      const minutes = Math.ceil(seconds / 60);
      return new InspectError(
        "rate-limited",
        `GitHub's rate limit is exhausted. It resets in about ${minutes} minute${minutes === 1 ? "" : "s"}. You can try the demo product in the meantime.`,
        seconds,
      );
    }

    return new InspectError(
      "rate-limited",
      "GitHub refused the request. Try again shortly, or use the demo product.",
    );
  }

  return new InspectError(
    "network",
    `Could not reach GitHub while fetching ${what} (HTTP ${response.status}).`,
  );
}

async function getJson(url: string, what: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: headers(), cache: "no-store" });
  } catch {
    throw new InspectError(
      "network",
      `Could not reach GitHub while fetching ${what}.`,
    );
  }

  if (!response.ok) throw toInspectError(response, what);
  return response.json();
}

type RepoMeta = {
  defaultBranch: string;
  description: string;
  isPrivate: boolean;
};

async function fetchMeta({ owner, repo }: RepoRef): Promise<RepoMeta> {
  const body = (await getJson(
    `${API}/repos/${owner}/${repo}`,
    "repository details",
  )) as Record<string, unknown>;

  return {
    defaultBranch:
      typeof body.default_branch === "string" ? body.default_branch : "main",
    description: typeof body.description === "string" ? body.description : "",
    isPrivate: body.private === true,
  };
}

async function fetchTree(ref: RepoRef, branch: string): Promise<string[]> {
  const body = (await getJson(
    `${API}/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    "the file tree",
  )) as { tree?: unknown };

  if (!Array.isArray(body.tree)) return [];

  return body.tree
    .filter(
      (entry): entry is { path: string; type: string; size?: number } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { path?: unknown }).path === "string" &&
        (entry as { type?: unknown }).type === "blob",
    )
    .map((entry) => entry.path);
}

export class GitHubProvider implements SourceProvider {
  /** Populated by `load` so the caller can record it on the manifest. */
  meta: (RepoMeta & RepoRef) | null = null;

  async load(input: string): Promise<SourceLoad> {
    const ref = parseRepoUrl(input);
    if (!ref) {
      throw new InspectError(
        "invalid-url",
        "Enter a public repository URL like https://github.com/owner/repo.",
      );
    }

    const meta = await fetchMeta(ref);
    if (meta.isPrivate) {
      throw new InspectError(
        "private",
        "That repository is private. Private repositories and GitHub sign-in are deliberately outside this project's scope.",
      );
    }
    this.meta = { ...meta, ...ref };

    const paths = await fetchTree(ref, meta.defaultBranch);
    const { selected, warnings } = selectPaths(paths);

    if (selected.length === 0) {
      throw new InspectError(
        "no-evidence",
        "No readable app source was found in the usual places (app/, pages/, components/, src/).",
      );
    }

    const files = await fetchContents(ref, meta.defaultBranch, selected, warnings);
    return { files, warnings };
  }
}

/**
 * Pull file contents from raw.githubusercontent.com in parallel, stopping once
 * the byte budget is spent. Individual failures are skipped rather than fatal:
 * one unreadable file should not lose an otherwise good inspection.
 */
async function fetchContents(
  ref: RepoRef,
  branch: string,
  paths: string[],
  warnings: string[],
): Promise<SourceFile[]> {
  const base = `${RAW}/${ref.owner}/${ref.repo}/${encodeURIComponent(branch)}`;

  const settled = await Promise.allSettled(
    paths.map(async (path): Promise<SourceFile | null> => {
      const response = await fetch(
        `${base}/${path.split("/").map(encodeURIComponent).join("/")}`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;

      const text = await response.text();
      const bytes = Buffer.byteLength(text, "utf8");
      if (bytes > MAX_FILE_BYTES) return null;
      if (looksGenerated(text)) return null;

      return { path, text, bytes };
    }),
  );

  const files: SourceFile[] = [];
  let total = 0;
  let skipped = 0;

  for (const result of settled) {
    if (result.status !== "fulfilled" || result.value === null) {
      skipped += 1;
      continue;
    }
    if (total + result.value.bytes > MAX_TOTAL_BYTES) {
      skipped += 1;
      continue;
    }
    total += result.value.bytes;
    files.push(result.value);
  }

  if (skipped > 0) {
    warnings.push(
      `Skipped ${skipped} file${skipped === 1 ? "" : "s"} that were too large, generated, or unreadable.`,
    );
  }

  return files;
}
