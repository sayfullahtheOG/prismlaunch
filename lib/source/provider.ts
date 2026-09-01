/**
 * The contract both source providers implement, and the budgets they share.
 *
 * There is exactly one set of limits and one allowlist. A provider that
 * enforced its own would eventually drift, and the GitHub path would end up
 * safer or laxer than the local one for no reason anybody could explain.
 *
 * See context/architecture.md invariants 5 and 7.
 */

export type SourceFile = {
  /** Repository-relative, POSIX separators. */
  path: string;
  text: string;
  bytes: number;
};

export type SourceLoad = {
  files: SourceFile[];
  warnings: string[];
};

export type InspectErrorCode =
  | "invalid-url"
  | "not-found"
  | "private"
  | "rate-limited"
  | "too-large"
  | "no-evidence"
  | "network"
  | "not-available";

export class InspectError extends Error {
  constructor(
    readonly code: InspectErrorCode,
    message: string,
    /** Seconds until a rate limit resets, when the API tells us. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "InspectError";
  }
}

export interface SourceProvider {
  /** `owner/repo` for GitHub, an absolute directory for local. */
  load(ref: string): Promise<SourceLoad>;
}

// ---------------------------------------------------------------------------
// Budgets — hard caps, enforced by every provider
// ---------------------------------------------------------------------------

/** Tree entries considered before filtering. Protects the rate limit. */
export const MAX_TREE_ENTRIES = 250;

/** Total source bytes read across all files. */
export const MAX_TOTAL_BYTES = 300_000;

/** Any single file larger than this is skipped, not truncated. */
export const MAX_FILE_BYTES = 64_000;

/** Files actually fetched, after the allowlist. Bounds request count. */
export const MAX_FILES = 40;

/** A line longer than this means minified or generated output. */
export const MAX_LINE_LENGTH = 500;

// ---------------------------------------------------------------------------
// Path rules
// ---------------------------------------------------------------------------

const ROOT_FILES = new Set(["package.json", "README.md", "readme.md"]);

/** Directories worth reading, relative to the repository root. */
const ALLOWED_PREFIXES = [
  "src/app/",
  "src/pages/",
  "src/components/",
  "src/features/",
  "app/",
  "pages/",
  "components/",
  "features/",
] as const;

const ALLOWED_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js", ".css"] as const;

/**
 * Never read, regardless of location. Secrets and lockfiles are the
 * expensive mistakes here; the rest is noise that would burn the byte budget.
 */
const DENY_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)\.next\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)vendor\//,
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.?env\./,
  /\.(lock|lockb)$/,
  /(package-lock|pnpm-lock|yarn\.lock|bun\.lock)/,
  /\.min\.(js|css)$/,
  /\.d\.ts$/,
  /\.(test|spec)\.[jt]sx?$/,
  /\.(png|jpe?g|gif|svg|webp|avif|ico|mp4|mov|webm|mp3|wav|woff2?|ttf|otf|eot|pdf|zip|gz|tar)$/i,
  /(^|\/)(secrets?|credentials?)\./i,
] as const;

export function isDenied(path: string): boolean {
  return DENY_PATTERNS.some((pattern) => pattern.test(path));
}

/** True when a path is inside the allowlist and worth reading. */
export function isAllowed(path: string): boolean {
  if (isDenied(path)) return false;
  if (ROOT_FILES.has(path)) return true;

  const inAllowedDir = ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (!inAllowedDir) return false;

  return ALLOWED_EXTENSIONS.some((extension) => path.endsWith(extension));
}

/**
 * Content that survived the path filter but should not be parsed:
 * minified bundles and generated files with enormous single lines.
 */
export function looksGenerated(text: string): boolean {
  if (text.includes("@generated")) return true;

  // Checking the longest line catches minified output without scanning
  // proportionally to file size in the common case.
  for (const line of text.split("\n", 400)) {
    if (line.length > MAX_LINE_LENGTH) return true;
  }
  return false;
}

/**
 * Rank candidate paths so the byte budget is spent on the files most likely to
 * describe the product: manifests first, then routes, then components.
 */
export function priority(path: string): number {
  if (path === "package.json") return 0;
  if (ROOT_FILES.has(path)) return 1;
  if (/(^|\/)(app|pages)\/.*page\.[jt]sx$/.test(path)) return 2;
  if (/(^|\/)components?\//.test(path)) return 3;
  if (path.endsWith(".css")) return 6;
  return 4;
}

/**
 * Apply the allowlist, ordering, and count cap to a list of candidate paths.
 * Both providers call this so their file selection is identical.
 */
export function selectPaths(paths: string[]): {
  selected: string[];
  warnings: string[];
} {
  const warnings: string[] = [];

  if (paths.length > MAX_TREE_ENTRIES) {
    warnings.push(
      `Repository is large — scanned the first ${MAX_TREE_ENTRIES} of ${paths.length} entries.`,
    );
  }

  const considered = paths.slice(0, MAX_TREE_ENTRIES);
  const allowed = considered.filter(isAllowed);

  if (allowed.length === 0) {
    return { selected: [], warnings };
  }

  const ordered = [...allowed].sort((a, b) => {
    const byPriority = priority(a) - priority(b);
    return byPriority !== 0 ? byPriority : a.localeCompare(b);
  });

  if (ordered.length > MAX_FILES) {
    warnings.push(
      `Read the ${MAX_FILES} most relevant files of ${ordered.length} matching ones.`,
    );
  }

  return { selected: ordered.slice(0, MAX_FILES), warnings };
}
