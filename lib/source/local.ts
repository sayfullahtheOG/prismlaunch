import type { Dirent } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  InspectError,
  isDenied,
  looksGenerated,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MAX_TREE_ENTRIES,
  selectPaths,
  type SourceFile,
  type SourceLoad,
  type SourceProvider,
} from "./provider";

/**
 * Reads a folder from the developer's own machine, through the same pipeline
 * as the GitHub provider.
 *
 * This exists because `next dev` runs on the user's machine, so filming the
 * repository you are actually working in costs almost nothing once the
 * pipeline is provider-agnostic — and it means you can make a launch film for
 * something you have not published yet.
 *
 * DEVELOPMENT ONLY. In production this is a directory-traversal hole: the path
 * would come from an HTTP request and could read anything the server process
 * can. Two independent guards below, because one is a single edit away from
 * being wrong (context/architecture.md §Auth and Access Model).
 */

export function isLocalProviderEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "vendor",
]);

export class LocalProvider implements SourceProvider {
  /** Resolved root, set by `load`. */
  root: string | null = null;

  async load(input: string): Promise<SourceLoad> {
    // Guard 1: the environment.
    if (!isLocalProviderEnabled()) {
      throw new InspectError(
        "not-available",
        "Reading a local folder is only available when running PrismLaunch on your own machine.",
      );
    }

    const raw = input.trim();
    if (raw.length === 0 || !isAbsolute(raw)) {
      throw new InspectError(
        "invalid-url",
        "Enter an absolute path to a project folder, for example /Users/you/code/my-app.",
      );
    }

    // Guard 2: resolve symlinks before deciding what the root is, so a
    // symlinked directory cannot later be used to escape it.
    let root: string;
    try {
      root = await realpath(resolve(raw));
      const info = await stat(root);
      if (!info.isDirectory()) {
        throw new InspectError("invalid-url", "That path is not a folder.");
      }
    } catch (error) {
      if (error instanceof InspectError) throw error;
      throw new InspectError(
        "not-found",
        "That folder could not be read. Check the path and its permissions.",
      );
    }
    this.root = root;

    const paths = await walk(root, root);
    const { selected, warnings } = selectPaths(paths);

    if (selected.length === 0) {
      throw new InspectError(
        "no-evidence",
        "No readable app source was found in the usual places (app/, pages/, components/, src/).",
      );
    }

    const files = await readFiles(root, selected, warnings);
    return { files, warnings };
  }
}

/** Collect repository-relative paths, breadth-bounded by the tree budget. */
async function walk(root: string, dir: string): Promise<string[]> {
  const found: string[] = [];
  const queue: string[] = [dir];

  while (queue.length > 0 && found.length < MAX_TREE_ENTRIES) {
    const current = queue.shift();
    if (current === undefined) break;

    // Explicit: `readdir` has a Buffer overload, and inference picks it.
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue; // Unreadable directory is a fact, not a failure.
    }

    for (const entry of entries) {
      if (found.length >= MAX_TREE_ENTRIES) break;

      const absolute = join(current, entry.name);
      const rel = relative(root, absolute).split(sep).join("/");

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        queue.push(absolute);
        continue;
      }

      if (!entry.isFile()) continue; // Skip symlinks and sockets outright.
      if (isDenied(rel)) continue;
      found.push(rel);
    }
  }

  return found;
}

async function readFiles(
  root: string,
  paths: string[],
  warnings: string[],
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  let total = 0;
  let skipped = 0;

  for (const path of paths) {
    if (total >= MAX_TOTAL_BYTES) {
      skipped += 1;
      continue;
    }

    const absolute = resolve(root, path);

    // Belt and braces: even though `walk` only produces paths under root and
    // `isDenied` has run, re-verify containment before every read.
    if (absolute !== root && !absolute.startsWith(root + sep)) {
      skipped += 1;
      continue;
    }

    try {
      const info = await stat(absolute);
      if (!info.isFile() || info.size > MAX_FILE_BYTES) {
        skipped += 1;
        continue;
      }

      const text = await readFile(absolute, "utf8");
      if (looksGenerated(text)) {
        skipped += 1;
        continue;
      }

      const bytes = Buffer.byteLength(text, "utf8");
      if (total + bytes > MAX_TOTAL_BYTES) {
        skipped += 1;
        continue;
      }

      total += bytes;
      files.push({ path, text, bytes });
    } catch {
      skipped += 1;
    }
  }

  if (skipped > 0) {
    warnings.push(
      `Skipped ${skipped} file${skipped === 1 ? "" : "s"} that were too large, generated, or unreadable.`,
    );
  }

  return files;
}
