import {
  ASSETS_DIR,
  explainZodError,
  PROJECT_FILE,
  PROJECT_FILE_VERSION,
  ProjectFileSchema,
  RENDERS_DIR,
  WORKSPACE_DIR,
} from "@/lib/studio/schema";
import { isLibraryPath, libraryUrl, safeAssetName } from "@/lib/studio/files";
import type { ProjectFile } from "@/types/prism";
import * as browser from "./browser-store";
import {
  deleteAssets,
  getAssets,
  putAsset,
  rememberWorkspace,
  requestPermission,
} from "./handle-store";

/** Where captured contact sheets go, beside the renders. */
export const FRAMES_DIR = "frames";

/**
 * The filesystem is the database — when there is one.
 *
 * An agent writes `.prismlaunch/<slug>/project.json` with its own file tools.
 * This module is the other half: it links the folder the person picks, reads
 * what is in it, and writes back the two things the agent is not allowed to
 * decide — approvals, and the rendered film.
 *
 * Nothing here is a cache. Every read goes to disk, so the file is always the
 * truth and the app is always a view of it. That is what makes it safe for the
 * agent to edit the file directly in its own editor while the page is open.
 *
 * ## Two kinds of workspace
 *
 * A folder needs the File System Access API, and that needs a browser that
 * actually implements its permission model. Chrome does. ChatGPT's built-in
 * browser opens the picker and then refuses the handle; Safari and Firefox
 * have no picker. So a workspace is one of two things: a `disk` one with real
 * handles, or a `browser` one where each composition is a `localStorage`
 * entry (see browser-store.ts). Every function here takes either and does
 * the same job against whichever it is given, so the rest of the app never
 * asks which.
 */

export type Workspace =
  | {
      kind: "disk";
      /** What the person picked — the repository root, usually. */
      root: FileSystemDirectoryHandle;
      /** `.prismlaunch` inside it. Created on link if it is missing. */
      dir: FileSystemDirectoryHandle;
    }
  | { kind: "browser" };

export function browserWorkspace(): Workspace {
  return { kind: "browser" };
}

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

/** Where a composition is, in words a person or an agent can act on. */
export function locationOf(workspace: Workspace, slug: string): string {
  return workspace.kind === "disk"
    ? `${WORKSPACE_DIR}/${slug}/${PROJECT_FILE}`
    : `this browser (${slug})`;
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
 *
 * An `AbortError` is reported as cancelled, which is what it means in Chrome.
 * In an embedded Chromium it can also mean "the picker closed and the
 * embedder refused the handle", which is why the setup dialog offers the
 * browser workspace beside this.
 */
export async function linkWorkspace(): Promise<FsResult<Workspace>> {
  if (typeof window.showDirectoryPicker !== "function") {
    return fail(
      "unsupported",
      "This browser cannot open a folder. Start in the browser instead, or use Chrome.",
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
    if (isAbort(error)) {
      return fail(
        "cancelled",
        "No folder was linked. If you did choose one, this browser refused to hand it over. Start in the browser instead.",
      );
    }
    return fail("permission-denied", "Could not open that folder.");
  }

  if ((await requestPermission(root)) !== "granted") {
    return fail(
      "permission-denied",
      "This browser would not grant read and write access to that folder. Start in the browser instead, or use Chrome.",
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
    return { ok: true, value: { kind: "disk", root, dir: root } };
  }

  try {
    const dir = await root.getDirectoryHandle(WORKSPACE_DIR, { create: true });
    return { ok: true, value: { kind: "disk", root, dir } };
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
 * Every composition in the workspace, readable or not.
 *
 * Broken projects are listed with their problem rather than skipped: a file
 * the agent just wrote wrong is exactly the one the person is looking for, and
 * hiding it would leave them staring at an empty list.
 */
export async function listProjects(
  workspace: Workspace,
): Promise<ProjectEntry[]> {
  const slugs: string[] = [];
  if (workspace.kind === "browser") {
    slugs.push(...browser.listSlugs());
  } else {
    for await (const [slug, handle] of workspace.dir.entries()) {
      if (handle.kind === "directory") slugs.push(slug);
    }
  }

  const entries: ProjectEntry[] = [];
  for (const slug of slugs) {
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
  let text: string;
  let modifiedAt: number;

  if (workspace.kind === "browser") {
    const entry = browser.readRaw(slug);
    if (!entry) return fail("not-found", `No composition “${slug}” in this browser.`);
    text = entry.text;
    modifiedAt = entry.modifiedAt;
  } else {
    let file: File;
    try {
      const dir = await workspace.dir.getDirectoryHandle(slug);
      const handle = await dir.getFileHandle(PROJECT_FILE);
      file = await handle.getFile();
    } catch {
      return fail("not-found", `No ${WORKSPACE_DIR}/${slug}/${PROJECT_FILE} to read.`);
    }
    text = await file.text();
    modifiedAt = file.lastModified;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("unreadable", `${slug}/${PROJECT_FILE} is not valid JSON.`);
  }

  // Check the version before the shape, so a file from the future gets an
  // explanation rather than a list of fields that moved. Older versions the
  // schema can read are its business.
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version === "number" && version > PROJECT_FILE_VERSION) {
    return fail(
      "invalid",
      `${slug}/${PROJECT_FILE} is version ${version}; this build reads up to version ${PROJECT_FILE_VERSION}.`,
    );
  }

  const parsed = ProjectFileSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("invalid", `${slug}/${PROJECT_FILE} — ${explainZodError(parsed.error)}`);
  }

  return { ok: true, value: { file: parsed.data, modifiedAt } };
}

/** When a project last changed, or 0 if it is gone. Cheap enough to poll. */
export async function modifiedAt(
  workspace: Workspace,
  slug: string,
): Promise<number> {
  if (workspace.kind === "browser") {
    return browser.readEntry(slug)?.modifiedAt ?? 0;
  }
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

  if (workspace.kind === "browser") {
    try {
      browser.writeEntry(slug, parsed.data);
      return { ok: true, value: undefined };
    } catch {
      return fail("write-failed", "This browser refused to store the composition (storage full or disabled).");
    }
  }

  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const handle = await dir.getFileHandle(PROJECT_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(parsed.data, null, 2)}\n`);
    await writable.close();
    return { ok: true, value: undefined };
  } catch {
    return fail("write-failed", `Could not write ${WORKSPACE_DIR}/${slug}/${PROJECT_FILE}.`);
  }
}

/**
 * Put a finished film next to the project that produced it.
 *
 * Renders land in the folder rather than the downloads directory so the video
 * sits with its source — the same reason the project file does. A browser
 * workspace has no folder, so the caller downloads instead.
 */
export async function writeRender(
  workspace: Workspace,
  slug: string,
  filename: string,
  blob: Blob,
): Promise<FsResult<string>> {
  if (workspace.kind === "browser") {
    return fail("write-failed", "No folder to save into.");
  }
  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const renders = await dir.getDirectoryHandle(RENDERS_DIR, { create: true });
    const handle = await renders.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, value: `${WORKSPACE_DIR}/${slug}/${RENDERS_DIR}/${filename}` };
  } catch {
    return fail("write-failed", `Could not save ${filename}.`);
  }
}

/**
 * Save a captured contact sheet beside the project, so an agent with file
 * tools can open it even if its WebMCP bridge drops image content. A browser
 * workspace has no folder; the caller says so in its message.
 */
export async function writeFrameSheet(
  workspace: Workspace,
  slug: string,
  filename: string,
  blob: Blob,
): Promise<FsResult<string>> {
  if (workspace.kind === "browser") {
    return fail("write-failed", "No folder to save into.");
  }
  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const frames = await dir.getDirectoryHandle(FRAMES_DIR, { create: true });
    const handle = await frames.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, value: `${WORKSPACE_DIR}/${slug}/${FRAMES_DIR}/${filename}` };
  } catch {
    return fail("write-failed", `Could not save ${filename}.`);
  }
}

/**
 * Turn the asset paths a composition refers to into object URLs.
 *
 * Remotion needs a URL for every `<Img>`, `<Video>` and `<Audio>`; the files
 * are handles in someone's folder. This walks the path segment by segment
 * rather than splitting on "/" and trusting it — `AssetPathSchema` already
 * rejects `..` and absolute paths, and this is the second lock on the same
 * door: a composition can only ever read files inside its own directory.
 *
 * Missing paths come back listed instead of thrown. A renamed image should
 * leave a hole in one frame and a line in the UI, not take the film down.
 * A browser workspace has no files yet, so every path is missing there.
 *
 * The URLs live until the tab closes. Revoking them on reload would be tidier,
 * but a revoked URL that Remotion is still holding renders as a broken frame,
 * and the leak is a few dozen blobs.
 */
export async function loadAssets(
  workspace: Workspace,
  slug: string,
  paths: readonly string[],
): Promise<{ urls: Record<string, string>; missing: string[] }> {
  const urls: Record<string, string> = {};
  const missing: string[] = [];

  // The studio's own files resolve to the site, in every workspace.
  const own = paths.filter((path) => {
    if (!isLibraryPath(path)) return true;
    urls[path] = libraryUrl(path);
    return false;
  });

  if (workspace.kind === "browser") {
    const stored = await getAssets(slug);
    for (const path of own) {
      const asset = stored.find((candidate) => candidate.path === path);
      if (asset) urls[path] = URL.createObjectURL(asset.blob);
      else missing.push(path);
    }
    return { urls, missing };
  }

  let root: FileSystemDirectoryHandle;
  try {
    root = await workspace.dir.getDirectoryHandle(slug);
  } catch {
    return { urls, missing: [...own] };
  }

  for (const path of own) {
    const segments = path.split("/").filter(Boolean);
    const filename = segments.pop();
    if (!filename) {
      missing.push(path);
      continue;
    }

    try {
      let dir = root;
      for (const segment of segments) {
        if (segment === "." || segment === "..") throw new Error("escape");
        dir = await dir.getDirectoryHandle(segment);
      }
      const handle = await dir.getFileHandle(filename);
      urls[path] = URL.createObjectURL(await handle.getFile());
    } catch {
      missing.push(path);
    }
  }

  return { urls, missing };
}

/** Files sitting in the project's `assets/` folder, whether referenced or not. */
export async function listAssets(
  workspace: Workspace,
  slug: string,
): Promise<string[]> {
  if (workspace.kind === "browser") {
    return (await getAssets(slug)).map((asset) => asset.path).sort();
  }
  try {
    const root = await workspace.dir.getDirectoryHandle(slug);
    const assets = await root.getDirectoryHandle(ASSETS_DIR);
    const names: string[] = [];
    for await (const [name, handle] of assets.entries()) {
      if (handle.kind === "file") names.push(`${ASSETS_DIR}/${name}`);
    }
    return names.sort();
  } catch {
    return [];
  }
}

/**
 * Put a file the person gave us into the project's `assets/`.
 *
 * On disk it is written beside project.json, where the agent's file tools
 * and Finder both see it. In a browser workspace it goes to IndexedDB under
 * the same path. Either way the clip that refers to it says `assets/<name>`.
 */
export async function addAssetFile(
  workspace: Workspace,
  slug: string,
  file: File,
): Promise<FsResult<string>> {
  const existing = new Set(
    (await listAssets(workspace, slug)).map((path) => path.replace(/^assets\//, "")),
  );
  const name = safeAssetName(file.name, existing);
  const path = `${ASSETS_DIR}/${name}`;

  if (workspace.kind === "browser") {
    try {
      await putAsset(slug, path, file);
      return { ok: true, value: path };
    } catch {
      return fail("write-failed", `This browser refused to store ${file.name}.`);
    }
  }

  try {
    const dir = await workspace.dir.getDirectoryHandle(slug, { create: true });
    const assets = await dir.getDirectoryHandle(ASSETS_DIR, { create: true });
    const handle = await assets.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return { ok: true, value: path };
  } catch {
    return fail("write-failed", `Could not write ${WORKSPACE_DIR}/${slug}/${path}.`);
  }
}

/**
 * Rename a composition's folder.
 *
 * There is no `move()` on a directory handle — Chromium ships it for files
 * only, verified against the live API — so this creates the destination, moves
 * every file across, and removes the source. The files are *moved*, not copied:
 * a project folder can hold a two-hundred-megabyte render, and rewriting those
 * bytes because somebody changed a title would be absurd.
 *
 * The old folder is deleted only once it is confirmed empty. If any move fails
 * we stop and report, which leaves files split across two folders — messy, but
 * recoverable, and strictly better than deleting a directory we have not
 * confirmed we emptied.
 */
export async function renameProjectFolder(
  workspace: Workspace,
  from: string,
  to: string,
): Promise<FsResult<void>> {
  if (from === to) return { ok: true, value: undefined };

  if (workspace.kind === "browser") {
    return browser.renameEntry(from, to)
      ? { ok: true, value: undefined }
      : fail("invalid", `“${to}” is already taken in this browser.`);
  }

  try {
    await workspace.dir.getDirectoryHandle(to);
    return fail("invalid", `${WORKSPACE_DIR}/${to}/ already exists.`);
  } catch {
    // Expected: the destination should not exist yet.
  }

  let source: FileSystemDirectoryHandle;
  try {
    source = await workspace.dir.getDirectoryHandle(from);
  } catch {
    return fail("not-found", `No ${WORKSPACE_DIR}/${from}/ to rename.`);
  }

  try {
    const destination = await workspace.dir.getDirectoryHandle(to, { create: true });
    await moveContents(source, destination);

    // Only now, and only if nothing was left behind.
    for await (const _ of source.keys()) {
      void _;
      return fail(
        "write-failed",
        `Moved what it could into ${WORKSPACE_DIR}/${to}/, but ${WORKSPACE_DIR}/${from}/ still has files in it. Nothing was deleted.`,
      );
    }
    await workspace.dir.removeEntry(from, { recursive: true });

    return { ok: true, value: undefined };
  } catch {
    return fail(
      "write-failed",
      `Could not rename ${WORKSPACE_DIR}/${from}/ to ${to}/. Nothing was deleted.`,
    );
  }
}

/** Depth-first, moving files and recreating the directories that held them. */
async function moveContents(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of source.entries()) {
    if (handle.kind === "file") {
      await (handle as FileSystemFileHandle).move(destination, name);
    } else {
      const sourceChild = await source.getDirectoryHandle(name);
      const destinationChild = await destination.getDirectoryHandle(name, { create: true });
      await moveContents(sourceChild, destinationChild);
      await source.removeEntry(name, { recursive: true });
    }
  }
}

/**
 * Delete a composition, permanently. Only `deleteProject` calls this, and
 * that action is human-only for the reasons written on it.
 */
export async function deleteProjectFolder(
  workspace: Workspace,
  slug: string,
): Promise<FsResult<void>> {
  if (workspace.kind === "browser") {
    browser.deleteEntry(slug);
    await deleteAssets(slug);
    return { ok: true, value: undefined };
  }
  try {
    await workspace.dir.removeEntry(slug, { recursive: true });
    return { ok: true, value: undefined };
  } catch {
    return fail(
      "write-failed",
      `Could not delete ${WORKSPACE_DIR}/${slug}/. It may be open in another program.`,
    );
  }
}

/** True when a composition of this name already exists, so create can refuse. */
export async function projectExists(
  workspace: Workspace,
  slug: string,
): Promise<boolean> {
  if (workspace.kind === "browser") return browser.hasEntry(slug);
  try {
    await workspace.dir.getDirectoryHandle(slug);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Looking at the folder
// ---------------------------------------------------------------------------

/** Where a browser workspace shows its compositions, in the tree the Files section draws. */
export const COMPOSITIONS_DIR = "compositions";

export type DirEntry = {
  name: string;
  /** Relative to the workspace root, slash-separated. */
  path: string;
  kind: "file" | "directory";
  /** Bytes, for a file that could be read. */
  size?: number;
  /** A directory the app will not list: node_modules and its kind. */
  sealed?: boolean;
};

const SEALED = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  ".vercel",
  "dist",
  "build",
  "coverage",
]);

/** Past this a listing is cut. A folder with more is not one anyone reads by eye. */
export const LIST_LIMIT = 300;

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

async function directoryAt(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of segments(path)) dir = await dir.getDirectoryHandle(part);
  return dir;
}

function byKindThenName(a: DirEntry, b: DirEntry): number {
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * One level of the workspace, for the Files section.
 *
 * On disk this is the folder the person linked, usually a repository, one
 * directory at a time so a large one costs nothing until it is opened;
 * node_modules and its kind are shown but not entered. A browser workspace
 * has no folder, so it is drawn as one: `compositions/<slug>/project.json`
 * and the assets beside it, which is the shape the disk has.
 */
export async function listDirectory(
  workspace: Workspace,
  path: string,
): Promise<FsResult<DirEntry[]>> {
  if (workspace.kind === "browser") {
    return { ok: true, value: await listBrowserDirectory(path) };
  }
  try {
    const dir = await directoryAt(workspace.root, path);
    const entries: DirEntry[] = [];
    for await (const [name, handle] of dir.entries()) {
      const entryPath = path ? `${path}/${name}` : name;
      if (handle.kind === "directory") {
        entries.push({
          name,
          path: entryPath,
          kind: "directory",
          ...(SEALED.has(name) ? { sealed: true } : {}),
        });
      } else {
        let size: number | undefined;
        try {
          size = (await (handle as FileSystemFileHandle).getFile()).size;
        } catch {
          // Listed without a size rather than not at all.
        }
        entries.push({ name, path: entryPath, kind: "file", ...(size !== undefined ? { size } : {}) });
      }
      if (entries.length >= LIST_LIMIT) break;
    }
    return { ok: true, value: entries.sort(byKindThenName) };
  } catch {
    return fail("not-found", `Could not read ${path || "the folder"}.`);
  }
}

async function listBrowserDirectory(path: string): Promise<DirEntry[]> {
  const parts = segments(path);
  if (parts.length === 0) {
    return [{ name: COMPOSITIONS_DIR, path: COMPOSITIONS_DIR, kind: "directory" }];
  }
  if (parts[0] !== COMPOSITIONS_DIR) return [];
  if (parts.length === 1) {
    return browser
      .listSlugs()
      .map((name) => ({ name, path: `${COMPOSITIONS_DIR}/${name}`, kind: "directory" as const }));
  }
  const slug = parts[1]!;
  if (!browser.hasEntry(slug)) return [];
  const base = `${COMPOSITIONS_DIR}/${slug}`;
  if (parts.length === 2) {
    const raw = browser.readRaw(slug);
    return [
      { name: ASSETS_DIR, path: `${base}/${ASSETS_DIR}`, kind: "directory" },
      {
        name: PROJECT_FILE,
        path: `${base}/${PROJECT_FILE}`,
        kind: "file",
        size: raw ? new Blob([raw.text]).size : 0,
      },
    ];
  }
  if (parts.length === 3 && parts[2] === ASSETS_DIR) {
    return (await getAssets(slug))
      .map((asset) => ({
        name: asset.path.replace(/^assets\//, ""),
        path: `${base}/${asset.path}`,
        kind: "file" as const,
        size: asset.blob.size,
      }))
      .sort(byKindThenName);
  }
  return [];
}

/** One file from the workspace, as the browser's own File, for the Files section to show. */
export async function readFileAt(workspace: Workspace, path: string): Promise<FsResult<File>> {
  const parts = segments(path);
  const name = parts[parts.length - 1];
  if (!name) return fail("not-found", "No file named.");

  if (workspace.kind === "browser") {
    const [top, slug, ...rest] = parts;
    if (top === COMPOSITIONS_DIR && slug) {
      if (rest.length === 1 && rest[0] === PROJECT_FILE) {
        const raw = browser.readRaw(slug);
        if (raw) return { ok: true, value: new File([raw.text], PROJECT_FILE, { type: "application/json" }) };
      }
      if (rest.length === 2 && rest[0] === ASSETS_DIR) {
        const wanted = `${ASSETS_DIR}/${name}`;
        const asset = (await getAssets(slug)).find((candidate) => candidate.path === wanted);
        if (asset) return { ok: true, value: new File([asset.blob], name, { type: asset.blob.type }) };
      }
    }
    return fail("not-found", `There is no ${path} in this browser.`);
  }

  try {
    const dir = await directoryAt(workspace.root, parts.slice(0, -1).join("/"));
    const handle = await dir.getFileHandle(name);
    return { ok: true, value: await handle.getFile() };
  } catch {
    return fail("not-found", `Could not read ${path}.`);
  }
}
