import type { ProjectFile } from "@/types/prism";

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
 * This is the other way. Each composition is one `localStorage` entry, the
 * same JSON the folder would hold, with the time it was written. The agent
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

type Entry = { file: ProjectFile; modifiedAt: number };

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

export function readEntry(slug: string): Entry | null {
  const raw = storage().getItem(PREFIX + slug);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Entry;
  } catch {
    return null;
  }
}

/** The raw text, for the reader that wants to validate it itself. */
export function readRaw(slug: string): { text: string; modifiedAt: number } | null {
  const raw = storage().getItem(PREFIX + slug);
  if (raw === null) return null;
  try {
    const entry = JSON.parse(raw) as { file?: unknown; modifiedAt?: number };
    return { text: JSON.stringify(entry.file), modifiedAt: entry.modifiedAt ?? 0 };
  } catch {
    return { text: raw, modifiedAt: 0 };
  }
}

export function writeEntry(slug: string, file: ProjectFile): number {
  const modifiedAt = Date.now();
  const entry: Entry = { file, modifiedAt };
  storage().setItem(PREFIX + slug, JSON.stringify(entry));
  return modifiedAt;
}

export function hasEntry(slug: string): boolean {
  return storage().getItem(PREFIX + slug) !== null;
}

export function deleteEntry(slug: string): void {
  storage().removeItem(PREFIX + slug);
}

export function renameEntry(from: string, to: string): boolean {
  const store = storage();
  const raw = store.getItem(PREFIX + from);
  if (raw === null || store.getItem(PREFIX + to) !== null) return false;
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
