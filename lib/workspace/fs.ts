import {
  explainZodError,
  PROJECT_FILE,
  PROJECT_FILE_VERSION,
  ProjectFileSchema,
  RENDERS_DIR,
  WORKSPACE_DIR,
} from "@/lib/studio/schema";
import type { ProjectFile } from "@/types/prism";
import { rememberWorkspace, requestPermission } from "./handle-store";

/**
 * The filesystem is the database.
 *
 * An agent writes `.prismlaunch/<slug>/project.json` with its own file tools.
 * This module is the other half: it links the folder the person picks, reads
 * what is in it, and writes back the two things the agent is not allowed to
 * decide — approvals, and the rendered film.
 *
 * Nothing here is a cache. Every read goes to disk, so the file is always the
 * truth and the app is always a view of it. That is what makes it safe for the
 * agent to edit the file directly in its own editor while the page is open.
 */

export type Workspace = {
  /** What the person picked — the repository root, usually. */
  root: FileSystemDirectoryHandle;
  /** `.prismlaunch` inside it. Created on link if it is missing. */
  dir: FileSystemDirectoryHandle;
};

export type FsResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: FsErrorCode; message: string };

export type FsErrorCode =
  | "cancelled"
  | "unsupported"
  | "permission-denied"
  | "not-found"
  | "unreadable"
  | "invalid"
  | "write-failed";

function fail<T>(code: FsErrorCode, message: string): FsResult<T> {
  return { ok: false, code, message };
}

/**
 * A cancelled picker is not a failure — someone changed their mind. It is
 * separated from real errors so the UI can say nothing at all.
 */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

/**
 * Open the folder picker and link what comes back.
 *
 * Must run inside a user gesture. If the person picks `.prismlaunch` itself we
 * use it directly; otherwise we get-or-create `.prismlaunch` inside what they
 * chose. Both are things people plausibly do, and guessing wrong would scatter
 * a second workspace one level down.
 */
export async function linkWorkspace(): Promise<FsResult<Workspace>> {
  if (typeof window.showDirectoryPicker !== "function") {
    return fail(
      "unsupported",
      "This browser cannot open a folder. PrismLaunch needs Chrome, Edge, or another Chromium browser.",
    );
  }

  let root: FileSystemDirectoryHandle;
  try {
    root = await window.showDirectoryPicker({
      mode: "readwrite",
      // Reopens where they were last time rather than at the home folder.
      id: "prismlaunch-workspace",
    });
  } catch (error) {
    if (isAbort(error)) return fail("cancelled", "No folder chosen.");
    return fail("permission-denied", "Could not open that folder.");
  }

  if ((await requestPermission(root)) !== "granted") {
    return fail(
      "permission-denied",
      "PrismLaunch needs permission to read and write that folder.",
    );
  }

  const workspace = await resolveWorkspace(root);
  if (workspace.ok) await rememberWorkspace(root);
  return workspace;
}

/**
 * Turn a granted root handle into a workspace, creating `.prismlaunch` if this
 * is the first time. Also the path a restored handle takes on reload.
 */
export async function resolveWorkspace(
  root: FileSystemDirectoryHandle,
): Promise<FsResult<Workspace>> {
  if (root.name === WORKSPACE_DIR) {
    return { ok: true, value: { root, dir: root } };
  }

  try {
    const dir = await root.getDirectoryHandle(WORKSPACE_DIR, { create: true });
    return { ok: true, value: { root, dir } };
  } catch {
    return fail(
      "permission-denied",
      `Could not open ${WORKSPACE_DIR}/ inside ${root.name}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type ProjectEntry = {
  slug: string;
  /** Null when the folder holds no readable project.json. */
  name: string | null;
  /** Why it is unreadable, for the ones that are. */
  problem: string | null;
  /** Epoch millis, for change detection. */
  modifiedAt: number;
};

/**
 * Every folder under `.prismlaunch`, readable or not.
 *
 * Broken projects are listed with their problem rather than skipped: a file
 * the agent just wrote wrong is exactly the one the person is looking for, and
 * hiding it would leave them staring at an empty list.
 */
export async function listProjects(
  workspace: Workspace,
): Promise<ProjectEntry[]> {
  const entries: ProjectEntry[] = [];

  for await (const [slug, handle] of workspace.dir.entries()) {
    if (handle.kind !== "directory") continue;

    const read = await readProjectFile(workspace, slug);
    if (read.ok) {
      entries.push({
        slug,
        name: read.value.file.name,
        problem: null,
        modifiedAt: read.value.modifiedAt,
      });
    } else {
      entries.push({
        slug,
        name: null,
        problem: read.code === "not-found" ? null : read.message,
        modifiedAt: 0,
      });
    }
  }

  return entries.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export type ReadProject = { file: ProjectFile; modifiedAt: number };

/**
 * Read and validate one project.
 *
 * A file that fails validation comes back with the field named, because that
 * message is going straight to the agent that wrote it. "invalid" is a
 * different outcome from "missing" for the same reason.
 */
export async function readProjectFile(
  workspace: Workspace,
  slug: string,
): Promise<FsResult<ReadProject>> {
  let file: File;
  try {
    const dir = await workspace.dir.getDirectoryHandle(slug);
    const handle = await dir.getFileHandle(PROJECT_FILE);
    file = await handle.getFile();
  } catch {
    return fail(
      "not-found",
      `No ${WORKSPACE_DIR}/${slug}/${PROJECT_FILE} to read.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return fail("unreadable", `${slug}/${PROJECT_FILE} is not valid JSON.`);
  }

  // Check the version before the shape, so an older file gets an explanation
  // rather than a list of fields that moved.
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version === "number" && version !== PROJECT_FILE_VERSION) {
    return fail(
      "invalid",
      `${slug}/${PROJECT_FILE} is version ${version}; this build reads version ${PROJECT_FILE_VERSION}.`,
    );
  }

  const parsed = ProjectFileSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "invalid",
      `${slug}/${PROJECT_FILE} — ${explainZodError(parsed.error)}`,
    );
  }

  return {
    ok: true,
    value: { file: parsed.data, modifiedAt: file.lastModified },
  };
}

/** When a project.json last changed, or 0 if it is gone. Cheap enough to poll. */
export async function modifiedAt(
  workspace: Workspace,
  slug: string,
): Promise<number> {
  try {
    const dir = await workspace.dir.getDirectoryHandle(slug);
    const handle = await dir.getFileHandle(PROJECT_FILE);
    return (await handle.getFile()).lastModified;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Write a project back.
 *
 * Formatted with two-space indent and a trailing newline because this file
 * lives in someone's repository: it gets committed, diffed and reviewed, and a
 * single-line blob would make every approval look like a rewrite.
 */
export async function writeProjectFile(
  workspace: Workspace,
  slug: string,
  file: ProjectFile,
): Promise<FsResult<void>> {
  const parsed = ProjectFileSchema.safeParse(file);
  if (!parsed.success) {
    // Refuse rather than persist something the app itself could not read back.
    return fail("invalid", explainZodError(parsed.error));
  }

  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const handle = await dir.getFileHandle(PROJECT_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(parsed.data, null, 2)}\n`);
    await writable.close();
    return { ok: true, value: undefined };
  } catch {
    return fail(
      "write-failed",
      `Could not write ${WORKSPACE_DIR}/${slug}/${PROJECT_FILE}.`,
    );
  }
}

/**
 * Put a finished film next to the project that produced it.
 *
 * Renders land in the folder rather than the downloads directory so the video
 * sits with its source — the same reason the project file does.
 */
export async function writeRender(
  workspace: Workspace,
  slug: string,
  filename: string,
  blob: Blob,
): Promise<FsResult<string>> {
  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const renders = await dir.getDirectoryHandle(RENDERS_DIR, { create: true });
    const handle = await renders.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return {
      ok: true,
      value: `${WORKSPACE_DIR}/${slug}/${RENDERS_DIR}/${filename}`,
    };
  } catch {
    return fail("write-failed", `Could not save ${filename}.`);
  }
}

/** True when a folder of this name already exists, so create can refuse. */
export async function projectExists(
  workspace: Workspace,
  slug: string,
): Promise<boolean> {
  try {
    await workspace.dir.getDirectoryHandle(slug);
    return true;
  } catch {
    return false;
  }
}
