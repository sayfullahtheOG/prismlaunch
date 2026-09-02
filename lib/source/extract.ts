import type { ComponentCandidate, ProductManifest, SourceEvidence } from "@/types/prism";
import type { SourceFile, SourceLoad } from "./provider";
import {
  humanizeName,
  sanitizeDescription,
  sanitizeIdentifier,
  sanitizePath,
  sanitizeReason,
  sanitizeSnippet,
} from "./sanitize";

/**
 * Deterministic extraction from a bounded set of source files.
 *
 * Explicitly *not* "the AI understood your repo": these are explainable
 * heuristics — dependency names, directory conventions, exported identifiers,
 * import counts — and every candidate carries the file path that justifies it.
 * When the evidence is thin we say so in a warning rather than inventing a
 * component (context/architecture.md §Data flow 1).
 *
 * Nothing here executes, imports, or evaluates user code. Regex only.
 */

const MAX_CANDIDATES = 6;
const MIN_CANDIDATES_FOR_CONFIDENCE = 3;

// ---------------------------------------------------------------------------
// Framework and product metadata
// ---------------------------------------------------------------------------

type PackageJson = {
  name?: unknown;
  description?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};

function readPackageJson(files: SourceFile[]): PackageJson | null {
  const file = files.find((f) => f.path === "package.json");
  if (!file) return null;

  try {
    const parsed: unknown = JSON.parse(file.text);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as PackageJson;
  } catch {
    // A malformed package.json is a fact about the repo, not a crash.
    return null;
  }
}

export function detectFramework(
  files: SourceFile[],
  pkg: PackageJson | null,
): ProductManifest["framework"] {
  const deps = {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
  };

  if ("next" in deps) return "next";

  // Directory conventions are evidence too — a vendored or unusual setup can
  // still be recognisably Next.
  const hasAppRouter = files.some((f) =>
    /(^|\/)(src\/)?app\/.*(page|layout)\.[jt]sx$/.test(f.path),
  );
  if (hasAppRouter) return "next";

  if ("react" in deps) return "react";
  if (files.some((f) => f.path.endsWith(".tsx") || f.path.endsWith(".jsx"))) {
    return "react";
  }
  return "unknown";
}

function firstReadmeSentence(files: SourceFile[]): string | null {
  const readme = files.find((f) => f.path.toLowerCase() === "readme.md");
  if (!readme) return null;

  for (const rawLine of readme.text.split("\n").slice(0, 40)) {
    const line = rawLine.trim();
    // Skip headings, badges, images, and HTML.
    if (line.length < 20) continue;
    if (/^[#>!\-*|<]/.test(line)) continue;
    if (line.includes("![") || line.includes("](http")) continue;
    return line;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component discovery
// ---------------------------------------------------------------------------

/**
 * Exported identifiers that start with a capital — the React component
 * convention. Deliberately shallow: a real parse would be slower, and would
 * still not tell us whether something is worth filming.
 */
const EXPORT_PATTERNS = [
  /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g,
  /export\s+(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g,
  /export\s+default\s+class\s+([A-Z][A-Za-z0-9_]*)/g,
] as const;

function exportedComponents(file: SourceFile): string[] {
  const names = new Set<string>();

  for (const pattern of EXPORT_PATTERNS) {
    // Fresh lastIndex each file — these are module-level /g regexes.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(file.text)) !== null) {
      const name = sanitizeIdentifier(match[1] ?? "");
      if (name.length > 1) names.add(name);
    }
  }

  // `export default function Page()` is common and tells us nothing useful,
  // so fall back to the filename for route files.
  if (names.size === 0 && /(page|layout)\.[jt]sx$/.test(file.path)) {
    const parent = file.path.split("/").at(-2);
    if (parent) names.add(sanitizeIdentifier(toPascal(parent)));
  }

  return [...names];
}

function toPascal(segment: string): string {
  return segment
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function hasJsx(text: string): boolean {
  return /<[A-Za-z][A-Za-z0-9]*[\s/>]/.test(text);
}

/**
 * `app/cycles/page.tsx` → `/cycles`. Returns null for non-route files.
 *
 * Being strict matters: the App Router only treats specific filenames as
 * routes, so a helper component that merely lives under `app/` is not a page.
 * Treating it as one both mislabels it and hands it an unearned score bonus.
 */
const APP_ROUTE_FILE = /(^|\/)(page|layout|template|default)\.[jt]sx?$/;

export function inferRoute(path: string): string | null {
  const match = path.match(/(?:^|\/)(?:src\/)?(app|pages)\/(.*)$/);
  if (!match?.[2]) return null;

  const router = match[1];
  if (router === "app" && !APP_ROUTE_FILE.test(path)) return null;

  const rest = match[2]
    .replace(/\/?(page|layout|index)\.[jt]sx?$/, "")
    .replace(/\.[jt]sx?$/, "")
    // Route groups like (marketing) are organisational, not part of the URL.
    .replace(/\([^)]*\)\/?/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");

  return rest.length === 0 ? "/" : `/${rest}`;
}

/** How many other files import this one. A cheap proxy for centrality. */
function importCount(name: string, files: SourceFile[]): number {
  let count = 0;
  for (const file of files) {
    // Match the identifier inside an import statement only.
    const pattern = new RegExp(
      `import[^;]{0,200}\\b${name}\\b[^;]{0,200}from`,
      "s",
    );
    if (pattern.test(file.text)) count += 1;
  }
  return count;
}

/**
 * Words that suggest a visually interesting surface. Used both for scoring and
 * to derive `visualTokens`, which the film templates read.
 */
const VISUAL_TOKENS = [
  "command",
  "palette",
  "search",
  "dashboard",
  "board",
  "editor",
  "canvas",
  "chat",
  "feed",
  "list",
  "table",
  "chart",
  "graph",
  "map",
  "player",
  "timeline",
  "inbox",
  "calendar",
  "card",
  "modal",
  "nav",
  "menu",
  "filter",
  "upload",
  "preview",
] as const;

/** Names that describe plumbing rather than a product surface. */
const BORING = [
  "provider",
  "context",
  "wrapper",
  "layout",
  "boundary",
  "error",
  "loading",
  "notfound",
  "head",
  "meta",
  "config",
  "util",
  "helper",
  "hoc",
  "theme",
] as const;

/**
 * Tokens found in the component's own name, and separately in its path.
 *
 * These are weighted differently on purpose. Every file under
 * `components/editor/` shares the path token "editor", so counting path and
 * name equally makes a whole directory score identically and buries the one
 * component actually worth filming.
 */
function tokensFor(
  name: string,
  path: string,
): { name: string[]; path: string[]; all: string[] } {
  const lowerName = name.toLowerCase();
  const lowerPath = path.toLowerCase();

  const fromName = VISUAL_TOKENS.filter((token) => lowerName.includes(token));
  const fromPath = VISUAL_TOKENS.filter(
    (token) => !fromName.includes(token) && lowerPath.includes(token),
  );

  return {
    name: fromName,
    path: fromPath,
    all: [...fromName, ...fromPath].slice(0, 6),
  };
}

type Scored = {
  name: string;
  file: SourceFile;
  score: number;
  route: string | null;
  tokens: ReturnType<typeof tokensFor>;
  reasons: string[];
};

function scoreComponent(
  name: string,
  file: SourceFile,
  files: SourceFile[],
  focus: string,
): Scored {
  const lower = name.toLowerCase();
  const route = inferRoute(file.path);
  const tokens = tokensFor(name, file.path);
  const reasons: string[] = [];
  let score = 0;

  if (hasJsx(file.text)) {
    score += 3;
  }

  if (tokens.name.length > 0) {
    score += 3 * Math.min(tokens.name.length, 2);
    reasons.push(`named for ${tokens.name.slice(0, 2).join(", ")}`);
  }
  if (tokens.path.length > 0) {
    // Weak signal — a whole directory shares it.
    score += 1;
  }

  if (route) {
    score += 3;
    reasons.push(`route ${route}`);
  }

  const imports = importCount(name, files);
  if (imports > 0) {
    score += Math.min(imports, 4);
    reasons.push(`imported by ${imports} file${imports === 1 ? "" : "s"}`);
  }

  // The user's stated focus is the strongest signal we have.
  const focusWords = focus
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  if (focusWords.some((word) => lower.includes(word))) {
    // The strongest signal available: the user told us what to feature.
    // Deliberately large enough to beat any combination of heuristics, since
    // a heuristic that overrules an explicit instruction is just wrong.
    score += 12;
    reasons.push("matches your focus");
  }

  if (BORING.some((word) => lower.includes(word))) {
    score -= 5;
  }

  // A one-word generic name is rarely the thing worth filming.
  if (name.length <= 3) score -= 2;

  return { name, file, score, route, tokens, reasons };
}

function evidenceFor(scored: Scored): SourceEvidence | null {
  const path = sanitizePath(scored.file.path);
  if (!path) return null;

  // Quote the line the export appears on — the most useful single line.
  const line =
    scored.file.text
      .split("\n")
      .find((candidate) => candidate.includes(`${scored.name}`)) ?? "";

  const reason =
    scored.reasons.length > 0
      ? `${scored.reasons.slice(0, 3).join("; ")}.`
      : "Exported component with JSX.";

  return {
    path,
    exportName: scored.name,
    snippet: sanitizeSnippet(line),
    reason: sanitizeReason(reason),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type ExtractInput = {
  load: SourceLoad;
  source: ProductManifest["source"];
  /** What the user said they want to feature. Free text, untrusted. */
  focus?: string;
  /** Falls back to package.json, then this. */
  fallbackName: string;
  repository?: ProductManifest["repository"];
};

export function buildManifest({
  load,
  source,
  focus = "",
  fallbackName,
  repository,
}: ExtractInput): ProductManifest {
  const { files } = load;
  const warnings = [...load.warnings];

  const pkg = readPackageJson(files);
  const framework = detectFramework(files, pkg);

  const productName =
    (typeof pkg?.name === "string" && pkg.name.trim().length > 0
      ? humanizeName(toPascal(pkg.name.replace(/^@[^/]+\//, "")))
      : "") || fallbackName;

  const description =
    (typeof pkg?.description === "string" ? pkg.description : "") ||
    firstReadmeSentence(files) ||
    "";

  const scored: Scored[] = [];
  for (const file of files) {
    if (!/\.[jt]sx$/.test(file.path)) continue;
    for (const name of exportedComponents(file)) {
      scored.push(scoreComponent(name, file, files, focus));
    }
  }

  // Best score per component name, so a component re-exported from an index
  // does not appear twice.
  const bestByName = new Map<string, Scored>();
  for (const entry of scored) {
    const existing = bestByName.get(entry.name);
    if (!existing || entry.score > existing.score) {
      bestByName.set(entry.name, entry);
    }
  }

  const ranked = [...bestByName.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_CANDIDATES);

  const componentCandidates: ComponentCandidate[] = [];
  for (const entry of ranked) {
    const evidence = evidenceFor(entry);
    if (!evidence) continue;

    componentCandidates.push({
      id: `cmp-${entry.name.toLowerCase()}`,
      name: entry.name,
      label: humanizeName(entry.name),
      kind: entry.route ? "page" : "component",
      evidence: [evidence],
      visualTokens: entry.tokens.all,
    });
  }

  if (componentCandidates.length === 0) {
    warnings.push(
      "No exported components matched the allowlist. Name the feature you want to film manually.",
    );
  } else if (componentCandidates.length < MIN_CANDIDATES_FOR_CONFIDENCE) {
    warnings.push(
      `Only found ${componentCandidates.length} candidate${componentCandidates.length === 1 ? "" : "s"} — the scan may have missed this project's layout.`,
    );
  }

  if (framework === "unknown") {
    warnings.push("Could not identify a React or Next.js project.");
  }

  return {
    source,
    ...(repository ? { repository } : {}),
    productName: productName.slice(0, 80),
    description: sanitizeDescription(description),
    framework,
    componentCandidates,
    inspectionWarnings: warnings.slice(0, 10),
  };
}
