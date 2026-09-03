import { DEFAULT_ANIMATION, DEFAULT_BOX, DEFAULT_MOTION } from "./schema";
import type { ElementDraft, ElementKind } from "@/types/prism";

/**
 * Files, and what the film makes of them.
 *
 * Two kinds of path can appear in a clip's `src`. `assets/<name>` is a file
 * of the project's own: in a folder workspace it is on disk beside
 * project.json, in a browser workspace it is in IndexedDB. `library/…` is a
 * file the studio ships for everyone (the sound effects, and any music), and
 * resolves to the site itself, so it works in every workspace with nothing
 * to copy.
 */

export const LIBRARY_PREFIX = "library/";

export function isLibraryPath(path: string): boolean {
  return path.startsWith(LIBRARY_PREFIX);
}

/** The URL a library path is served from. */
export function libraryUrl(path: string): string {
  const relative = `/${path}`;
  return typeof window === "undefined" ? relative : new URL(relative, window.location.origin).href;
}

export function kindForPath(path: string): Extract<ElementKind, "image" | "video" | "audio"> {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  return "image";
}

/** A media element for a file, by extension. */
export function elementForFile(path: string): ElementDraft {
  const name = (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
  const kind = kindForPath(path);
  const visual = {
    box: { ...DEFAULT_BOX, width: 0.8, height: 0.45 },
    animation: { ...DEFAULT_ANIMATION },
    motion: { ...DEFAULT_MOTION },
    shadow: 0,
    glow: 0,
    blur: 0,
  };
  if (kind === "audio") {
    return { kind, name, src: path, startFrom: 0, volume: 1, fadeInFrames: 0, fadeOutFrames: 0, playbackRate: 1 };
  }
  if (kind === "video") {
    return { kind, name, src: path, fit: "cover", radius: 0, startFrom: 0, volume: 0, playbackRate: 1, ...visual };
  }
  return { kind: "image", name, src: path, fit: "cover", radius: 0, ...visual };
}

/** A file name that is safe as a path segment and not already taken. */
export function safeAssetName(name: string, taken: ReadonlySet<string>): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "") || "file";
  if (!taken.has(cleaned)) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  let n = 2;
  while (taken.has(`${stem}-${n}${extension}`)) n += 1;
  return `${stem}-${n}${extension}`;
}
