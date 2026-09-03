import type { ActivityEvent, ProjectFile } from "@/types/prism";
import { ACTIVITY_FILE, assembleProject, ELEMENTS_DIR, PROCESS_DIR, splitProject, TRACKS_DIR } from "@/lib/studio/modular";

/**
 * Compositions kept in the browser, for when there is no folder to keep them in.
 *
 * The File System Access API is the product's first choice — a film should
 * live beside the code it is about — but it is Chromium-only, and even in
 * Chromium it is only as good as the embedder: ChatGPT's built-in browser
 * opens the Finder picker and then refuses the handle, because an embedded
 * Chromium without the browser's own permission UI has no way to grant
 * read-write access to a directory. Safari and Firefox have no picker at all.
 * That set of browsers includes the one the product will most often be
 * driven from, so "link a folder" cannot be the only way in.
 *
 * This is the other way. Each JSON part has its own storage entry. A small
 * manifest points at the committed parts, matching the folder layout. The agent
 * reaches it only through the page's tools, and `get_project_context`
 * returns the whole composition, so an agent that wants it in git can
 * mirror it into the repository with its own file tools.
 *
 * `localStorage` may be missing or throw — private windows, storage disabled,
 * a test runner — so everything goes through one accessor that falls back to
 * memory. The fallback is honest: the composition lives until the tab
 * closes, which is still an editor rather than a dead end.
 */

const PREFIX = "prismlaunch.browser.";
const MODE_KEY = "prismlaunch.mode";

const PART_PREFIX = "prismlaunch.part.";
type Manifest = { format: 2; files: Record<string, string>; modifiedAt: number };
type Entry = { file: ProjectFile; activity?: ActivityEvent[]; modifiedAt: number };
export type StoredFiles = { files: Record<string, string>; modifiedAt: number };

const memory = new Map<string, string>();

function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> {
  try {
    if (typeof localStorage !== "undefined") {
      // A throwing accessor (some sandboxes) surfaces here, not on every call.
      localStorage.getItem(MODE_KEY);
      return localStorage;
    }
  } catch {
    // Fall through to memory.
  }
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
    key: (index) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };
}

/** Read one committed snapshot; a missing part is an error, never an empty film. */
export function readStoredFiles(slug: string): StoredFiles | null {
  const store = storage();
  const raw = store.getItem(PREFIX + slug);
  if (raw === null) return null;
  const entry = JSON.parse(raw);
  if (entry.format !== 2) {
    const files: Record<string, string> = { "project.json": JSON.stringify(entry.file) };
    if (entry.activity !== undefined) files[ACTIVITY_FILE] = JSON.stringify(entry.activity);
    return { files, modifiedAt: entry.modifiedAt ?? 0 };
  }
  const files: Record<string, string> = {};
  for (const [path, key] of Object.entries((entry as Manifest).files)) {
    if (!key.startsWith(PART_PREFIX)) throw new Error(`Invalid storage reference for ${path}.`);
    const text = store.getItem(key);
    if (text === null) throw new Error(`Missing stored file ${path}.`);
    files[path] = text;
  }
  if (!("project.json" in files)) throw new Error("Missing stored project.json.");
  return { files, modifiedAt: entry.modifiedAt };
}

export function readEntry(slug: string): Entry | null {
  const raw = readRaw(slug);
  if (!raw) return null;
  return { file: JSON.parse(raw.text), ...(raw.activity !== undefined ? { activity: raw.activity as ActivityEvent[] } : {}), modifiedAt: raw.modifiedAt };
}

/** Assemble for validation in the same way the linked-folder reader does. */
export function readRaw(slug: string): { text: string; activity?: unknown; modifiedAt: number } | null {
  const stored = readStoredFiles(slug);
  if (!stored) return null;
  const parse = (path: string) => {
    try { return JSON.parse(stored.files[path]!); }
    catch { throw new Error(`${path} is not valid JSON.`); }
  };
  const parts = (dir: string) => Object.keys(stored.files)
    .filter((path) => path.startsWith(`${dir}/`) && path.endsWith(".json"))
    .map((path) => ({ name: path.slice(dir.length + 1), body: parse(path) }));
  return {
    text: JSON.stringify(assembleProject(parse("project.json"), parts(TRACKS_DIR), parts(ELEMENTS_DIR), parts(PROCESS_DIR))),
    ...(stored.files[ACTIVITY_FILE] !== undefined ? { activity: parse(ACTIVITY_FILE) } : {}),
    modifiedAt: stored.modifiedAt,
  };
}

/**
 * Write changed parts first, then atomically replace the small manifest.
 * A quota error leaves the previous snapshot intact, including on migration.
 * Unchanged parts retain their keys and are not rewritten.
 */
export function writeEntry(slug: string, file: ProjectFile, activity?: ActivityEvent[]): number {
  const store = storage();
  const previousRaw = store.getItem(PREFIX + slug);
  const previous = previousRaw ? JSON.parse(previousRaw) : null;
  const oldRefs: Record<string, string> = previous?.format === 2 ? previous.files : {};
  const split = splitProject(file);
  const bodies: Record<string, unknown> = { "project.json": split.main };
  for (const [dir, parts] of [[TRACKS_DIR, split.tracks], [ELEMENTS_DIR, split.elements], [PROCESS_DIR, split.process]] as const) {
    for (const part of parts) bodies[`${dir}/${part.name}`] = part.body;
  }
  if (activity !== undefined) bodies[ACTIVITY_FILE] = activity;
  else if (oldRefs[ACTIVITY_FILE]) bodies[ACTIVITY_FILE] = JSON.parse(store.getItem(oldRefs[ACTIVITY_FILE])!);
  else if (previous?.activity !== undefined) bodies[ACTIVITY_FILE] = previous.activity;
  const files: Record<string, string> = {};
  const created: string[] = [];
  let modifiedAt = previous?.modifiedAt ?? 0;
  try {
    for (const [path, body] of Object.entries(bodies)) {
      const text = `${JSON.stringify(body, null, 2)}\n`;
      const oldKey = oldRefs[path];
      if (oldKey && store.getItem(oldKey) === text) { files[path] = oldKey; continue; }
      const key = `${PART_PREFIX}${crypto.randomUUID()}/${path}`;
      store.setItem(key, text);
      created.push(key);
      files[path] = key;
    }
    const filmChanged = [...new Set([...Object.keys(oldRefs), ...Object.keys(files)])]
      .some((path) => path !== ACTIVITY_FILE && oldRefs[path] !== files[path]);
    if (filmChanged) modifiedAt = Math.max(Date.now(), modifiedAt + 1);
    const manifest: Manifest = { format: 2, files, modifiedAt };
    store.setItem(PREFIX + slug, JSON.stringify(manifest));
  } catch (error) {
    for (const key of created) store.removeItem(key);
    throw error;
  }
  const keep = new Set(Object.values(files));
  for (const key of Object.values(oldRefs)) {
    if (!keep.has(key)) { try { store.removeItem(key); } catch { /* Committed; cleanup can wait. */ } }
  }
  return modifiedAt;
}

export function entryModifiedAt(slug: string): number {
  const raw = storage().getItem(PREFIX + slug);
  try { return raw ? JSON.parse(raw).modifiedAt ?? 0 : 0; } catch { return 0; }
}

export function hasEntry(slug: string): boolean {
  return storage().getItem(PREFIX + slug) !== null;
}

export function deleteEntry(slug: string): void {
  const store = storage();
  const raw = store.getItem(PREFIX + slug);
  const entry = raw ? JSON.parse(raw) : null;
  store.removeItem(PREFIX + slug);
  if (entry?.format === 2) for (const key of Object.values((entry as Manifest).files)) store.removeItem(key);
}

export function renameEntry(from: string, to: string): boolean {
  const store = storage();
  const raw = store.getItem(PREFIX + from);
  if (raw === null || store.getItem(PREFIX + to) !== null) return false;
  // Parts are addressed by immutable keys, so moving the manifest preserves them.
  store.setItem(PREFIX + to, raw);
  store.removeItem(PREFIX + from);
  return true;
}

export function listSlugs(): string[] {
  const store = storage();
  const slugs: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key?.startsWith(PREFIX)) slugs.push(key.slice(PREFIX.length));
  }
  return slugs.sort();
}

/** Remember that this browser chose to keep compositions in itself. */
export function rememberBrowserMode(): void {
  storage().setItem(MODE_KEY, "browser");
}

export function forgetBrowserMode(): void {
  storage().removeItem(MODE_KEY);
}

export function browserModeRemembered(): boolean {
  return storage().getItem(MODE_KEY) === "browser";
}

/** Tests only: a clean slate for the memory fallback. */
export function resetBrowserStore(): void {
  memory.clear();
  try {
    if (typeof localStorage !== "undefined") {
      for (const slug of listSlugs()) deleteEntry(slug);
      forgetBrowserMode();
    }
  } catch {
    // Nothing to clear.
  }
}
