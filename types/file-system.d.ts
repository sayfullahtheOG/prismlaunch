/**
 * File System Access API.
 *
 * TypeScript's DOM library still ships an incomplete version of this: the
 * permission methods and `showDirectoryPicker`'s options are missing, and
 * `entries()` is not declared at all. Rather than cast at every call site —
 * which would hide a real typo behind an `any` — the gaps are declared here
 * once, matching the WICG spec as Chromium implements it.
 *
 * Chromium-only. `lib/workspace/handle-store.ts` feature-detects before any of
 * this is touched.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  /** Async iteration over the directory. Absent from the bundled lib.dom. */
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemFileHandle {
  /**
   * Rename or relocate a file without rewriting its bytes.
   *
   * Chromium ships this for FILE handles only — `move` is absent from
   * `FileSystemDirectoryHandle.prototype`, verified against the live API — so
   * renaming a directory means moving its files one at a time. See
   * `renameProjectFolder` in lib/workspace/fs.ts.
   */
  move(name: string): Promise<void>;
  move(destination: FileSystemDirectoryHandle, name?: string): Promise<void>;
}

interface DirectoryPickerOptions {
  mode?: "read" | "readwrite";
  /** Remembers a starting directory per id, across visits. */
  id?: string;
  startIn?:
    | FileSystemHandle
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";
}

interface Window {
  showDirectoryPicker?(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}
