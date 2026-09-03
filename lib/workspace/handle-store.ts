import { WORKSPACE_DIR } from "@/lib/studio/schema";

/**
 * Remembering the linked folder across reloads.
 *
 * A `FileSystemDirectoryHandle` is structured-cloneable, so IndexedDB can hold
 * one. Local storage cannot — it takes strings, and a handle is not a path.
 * There is deliberately no way to turn a handle back into a path string, which
 * is also why the app can never tell you where your folder is: it only knows
 * it has one.
 *
 * The handle survives a reload; the *permission* does not. Chrome downgrades a
 * restored handle to "prompt", and re-granting requires a user gesture. So the
 * handle comes back silently on load and the app asks for permission the first
 * time someone actually does something — never on a timer, and never from a
 * WebMCP tool call, which is not a gesture and would be refused anyway.
 */

const DB_NAME = "prismlaunch";
/** 2: the assets store, for files a browser workspace holds instead of a folder. */
const DB_VERSION = 2;
const STORE = "handles";
const ASSETS = "assets";
const KEY = "workspace-root";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
      if (!request.result.objectStoreNames.contains(ASSETS)) {
        request.result.createObjectStore(ASSETS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  storeName: string = STORE,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(storeName, mode).objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/*
 * Files for a browser workspace.
 *
 * A folder holds its own `assets/`; a browser workspace has nowhere to put a
 * dropped image or a music file except here. Keyed by composition and path,
 * the same `assets/<name>` path a clip refers to, so the rest of the app
 * cannot tell which kind of workspace produced the URL.
 */
export type StoredAsset = { slug: string; path: string; blob: Blob };

function assetKey(slug: string, path: string): string {
  return `${slug}\u0000${path}`;
}

export async function putAsset(slug: string, path: string, blob: Blob): Promise<void> {
  await transact("readwrite", (store) => store.put({ slug, path, blob }, assetKey(slug, path)), ASSETS);
}

export async function getAssets(slug: string): Promise<StoredAsset[]> {
  try {
    const all = await transact<StoredAsset[]>("readonly", (store) => store.getAll(), ASSETS);
    return all.filter((asset) => asset.slug === slug);
  } catch {
    return [];
  }
}

export async function deleteAssets(slug: string): Promise<void> {
  try {
    const all = await transact<StoredAsset[]>("readonly", (store) => store.getAll(), ASSETS);
    for (const asset of all) {
      if (asset.slug === slug) {
        await transact("readwrite", (store) => store.delete(assetKey(slug, asset.path)), ASSETS);
      }
    }
  } catch {
    // Nothing stored, or storage refused. The composition is gone either way.
  }
}

export async function rememberWorkspace(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  try {
    await transact("readwrite", (store) => store.put(handle, KEY));
  } catch {
    // Private browsing, or storage disabled. The link still works for this
    // visit; it just will not be there tomorrow.
  }
}

export async function recallWorkspace(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await transact<FileSystemDirectoryHandle | undefined>(
      "readonly",
      (store) => store.get(KEY),
    );
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function forgetWorkspace(): Promise<void> {
  try {
    await transact("readwrite", (store) => store.delete(KEY));
  } catch {
    // Nothing stored to begin with.
  }
}

export type PermissionState = "granted" | "prompt" | "denied";

/** What we have right now, without prompting. Safe to call on load. */
export async function checkPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  try {
    return await handle.queryPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/**
 * Ask for read-write access. MUST be called from a user gesture — a click.
 * Chrome silently resolves to "prompt" otherwise, which reads as a denial.
 */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  try {
    return await handle.requestPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/**
 * Whether this browser can link a folder at all.
 *
 * The File System Access API is Chromium-only. Safari and Firefox have no
 * `showDirectoryPicker`, and there is no polyfill worth the name — a fallback
 * that uploaded the folder somewhere would break the promise that the work
 * never leaves the machine. So the app says so plainly instead.
 */
export function canLinkFolder(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function" &&
    window.isSecureContext
  );
}

/** The path we tell people to look for, for messages and docs. */
export const WORKSPACE_HINT = `${WORKSPACE_DIR}/`;
