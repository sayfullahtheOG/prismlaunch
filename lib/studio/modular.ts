import type { Element, ProjectFile, Track } from "@/types/prism";

/**
 * A film as a folder of small files.
 *
 * One `project.json` held everything, and it worked, but it made every
 * change a rewrite of the whole film: an agent adjusting one headline's
 * colour read and wrote a file with every clip in it, and a large film
 * meant a large edit for a small change. So on disk the film is split.
 * `project.json` keeps what is about the film, the canvas, the background,
 * the process, and the order of its layers and elements by id; each layer
 * is `tracks/<id>.json` with its clips, and each element is
 * `elements/<id>.json`. To change one, edit its file.
 *
 * `project.json` is the authority on what the film contains. Its `tracks`
 * and `elements` lists name the files that count, in order; a file the list
 * does not name is not part of the film, which is what lets removing an id
 * remove the layer, and the next save clears the file. An entry in the list
 * may also be the object itself, inline, which is how a film written by hand
 * in one file still reads and how it read before the split. A list that is
 * missing altogether means "every file in the folder", by name.
 *
 * These two functions are the whole format: one splits a film into its
 * files, the other puts them back. Nothing else in the app knows the film
 * is more than one file.
 */

export const TRACKS_DIR = "tracks";
export const ELEMENTS_DIR = "elements";

export type SplitFile<T> = { name: string; body: T };

export type SplitProject = {
  /** `project.json`: the film with `tracks` and `elements` as lists of ids. */
  main: Record<string, unknown>;
  tracks: SplitFile<Track>[];
  elements: SplitFile<Element>[];
};

/** A file name an id can safely have. Ids are matched by their `id` field, so this is only storage. */
export function fileNameFor(id: string): string {
  return `${id.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;
}

export function splitProject(file: ProjectFile): SplitProject {
  const { tracks, elements, ...rest } = file;
  return {
    main: {
      ...rest,
      elements: elements.map((element) => element.id),
      tracks: tracks.map((track) => track.id),
    },
    tracks: tracks.map((track) => ({ name: fileNameFor(track.id), body: track })),
    elements: elements.map((element) => ({ name: fileNameFor(element.id), body: element })),
  };
}

/** One file read from `tracks/` or `elements/`, parsed but not yet validated. */
export type LoosePart = { name: string; body: unknown };

function idOf(body: unknown): string | null {
  const id = (body as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Resolve one list: each entry an id naming a file, or the thing itself.
 * A named id with no file is dropped, which is what an agent mid-edit
 * looks like; the film still opens and the list is corrected on save.
 */
function resolve(
  list: unknown,
  parts: LoosePart[],
  order: (a: LoosePart, b: LoosePart) => number = byName,
): unknown[] {
  const byId = new Map<string, unknown>();
  for (const part of parts) {
    const id = idOf(part.body);
    if (id !== null) byId.set(id, part.body);
  }
  if (!Array.isArray(list)) {
    return [...parts].sort(order).map((part) => part.body);
  }
  const out: unknown[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const body = byId.get(entry);
      if (body !== undefined) out.push(body);
    } else if (entry !== null && typeof entry === "object") {
      out.push(entry);
    }
  }
  return out;
}

function byName(a: LoosePart, b: LoosePart): number {
  return a.name.localeCompare(b.name);
}

/** Unlisted layers still have to satisfy the stack: visual before audio, then by name. */
function byStackThenName(a: LoosePart, b: LoosePart): number {
  const rank = (part: LoosePart) =>
    (part.body as { kind?: unknown } | null)?.kind === "audio" ? 1 : 0;
  return rank(a) - rank(b) || byName(a, b);
}

/**
 * The film, back in one piece, ready for the schema.
 *
 * Returns the raw object rather than a validated file, so the caller
 * reports a bad field the same way it does for a single file: with the
 * field named.
 */
export function assembleProject(
  main: unknown,
  tracks: LoosePart[],
  elements: LoosePart[],
): unknown {
  if (main === null || typeof main !== "object" || Array.isArray(main)) return main;
  const record = main as Record<string, unknown>;
  return {
    ...record,
    tracks: resolve(record.tracks, tracks, byStackThenName),
    elements: resolve(record.elements, elements),
  };
}

/** Whether a main file keeps its parts in files, by id, rather than inline. */
export function isSplit(main: unknown): boolean {
  const record = main as { tracks?: unknown; elements?: unknown } | null;
  const lists = [record?.tracks, record?.elements];
  return lists.some((list) => Array.isArray(list) && list.some((entry) => typeof entry === "string"));
}
