import { MAX_FRAMES, MIN_CLIP_FRAMES } from "./schema";
import type {
  Animation,
  Box,
  Clip,
  ClipDraft,
  Element,
  ProjectFile,
  Track,
  TrackKind,
} from "@/types/prism";

/**
 * Pure edits on a composition.
 *
 * Every function here takes a `ProjectFile` and returns a new one. No store, no
 * validation, no side effects — `actions.ts` wraps these, validates the result
 * and writes it to disk.
 *
 * Keeping them separate is what makes the hard parts testable: "does dragging a
 * clip left past its neighbour do the right thing" is a question about data,
 * and answering it should not require a browser, a folder, or a mocked store.
 */

// ---------------------------------------------------------------------------
// Finding things
// ---------------------------------------------------------------------------

export function findTrack(file: ProjectFile, trackId: string): Track | undefined {
  return file.tracks.find((track) => track.id === trackId);
}

export function findClip(
  file: ProjectFile,
  clipId: string,
): { track: Track; clip: Clip } | undefined {
  for (const track of file.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

/**
 * A fresh id.
 *
 * Prefixed by kind so a raw `project.json` stays readable to whoever opens it
 * in an editor — `clip-text-l3k9f2` says what it is without cross-referencing.
 * Randomness rather than a counter because two agents writing the same file
 * would collide on counters.
 */
export function mintId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/**
 * Where a new track of this kind belongs.
 *
 * Visual tracks go to the front of the visual group; audio to the end of the
 * file. That keeps the invariant the schema enforces — all visual before all
 * audio — and matches what people expect: a new overlay lands on top.
 */
export function insertionIndex(file: ProjectFile, kind: TrackKind): number {
  if (kind === "audio") return file.tracks.length;
  return 0;
}

export function addTrack(
  file: ProjectFile,
  kind: TrackKind,
  name: string,
): { file: ProjectFile; track: Track } {
  const track: Track = {
    id: mintId(kind === "audio" ? "audio" : "track"),
    kind,
    name,
    hidden: false,
    locked: false,
    volume: 1,
    clips: [],
  };

  const tracks = [...file.tracks];
  tracks.splice(insertionIndex(file, kind), 0, track);
  return { file: { ...file, tracks }, track };
}

export function removeTrack(file: ProjectFile, trackId: string): ProjectFile {
  return {
    ...file,
    tracks: file.tracks.filter((track) => track.id !== trackId),
  };
}

export function updateTrack(
  file: ProjectFile,
  trackId: string,
  patch: Partial<Omit<Track, "id" | "kind" | "clips">>,
): ProjectFile {
  return {
    ...file,
    tracks: file.tracks.map((track) =>
      track.id === trackId ? { ...track, ...patch } : track,
    ),
  };
}

/**
 * Move a track up or down the stack.
 *
 * Constrained to its own kind: a visual track cannot be dragged below the
 * audio ones, because the background sits between them and "an overlay behind
 * the music" is not a thing. The move is a no-op at either end of the group
 * rather than an error — a person holding the up arrow should not get a
 * dialog.
 */
export function moveTrack(
  file: ProjectFile,
  trackId: string,
  direction: -1 | 1,
): ProjectFile {
  const index = file.tracks.findIndex((track) => track.id === trackId);
  if (index === -1) return file;

  const track = file.tracks[index]!;
  const target = index + direction;
  const neighbour = file.tracks[target];
  if (!neighbour || neighbour.kind !== track.kind) return file;

  const tracks = [...file.tracks];
  tracks[index] = neighbour;
  tracks[target] = track;
  return { ...file, tracks };
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

function withClips(
  file: ProjectFile,
  trackId: string,
  map: (clips: Clip[]) => Clip[],
): ProjectFile {
  return {
    ...file,
    tracks: file.tracks.map((track) =>
      track.id === trackId ? { ...track, clips: sortClips(map(track.clips)) } : track,
    ),
  };
}

export function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.from - b.from);
}

export function addClip(
  file: ProjectFile,
  trackId: string,
  clip: Clip,
): ProjectFile {
  return withClips(file, trackId, (clips) => [...clips, clip]);
}

export function removeClip(file: ProjectFile, clipId: string): ProjectFile {
  return {
    ...file,
    tracks: file.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    })),
  };
}

export function updateClip(
  file: ProjectFile,
  clipId: string,
  patch: Partial<Clip>,
): ProjectFile {
  return {
    ...file,
    tracks: file.tracks.map((track) => ({
      ...track,
      clips: sortClips(
        track.clips.map((clip) =>
          clip.id === clipId ? ({ ...clip, ...patch } as Clip) : clip,
        ),
      ),
    })),
  };
}

/**
 * The free stretches on a track, ignoring one clip.
 *
 * This is the honest primitive. The first version of this file tried to
 * describe a placement as a single `{ min, max }` pair computed from where the
 * pointer happened to be, and it was wrong in the case that matters most:
 * a drop point *inside* another clip is neither before it nor after it, and
 * treating it as one or the other silently produced overlapping clips that the
 * schema then rejected — turning a normal drag into a failed edit.
 *
 * Gaps are unambiguous. Every position in one is legal, and the last runs to
 * the end of what a composition may hold.
 */
export function freeGaps(
  track: Track,
  clipId: string,
): Array<{ start: number; end: number }> {
  const others = track.clips
    .filter((clip) => clip.id !== clipId)
    .sort((a, b) => a.from - b.from);

  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const clip of others) {
    if (clip.from > cursor) gaps.push({ start: cursor, end: clip.from });
    cursor = Math.max(cursor, clip.from + clip.durationInFrames);
  }
  gaps.push({ start: cursor, end: MAX_FRAMES });

  return gaps;
}

/**
 * Where a clip of this length should land when someone drags it here.
 *
 * The nearest gap that will actually hold it, clamped inside. That is what
 * makes a drag feel right: pulling a clip left into its neighbour stops it
 * against that neighbour, and pulling it far past one drops it in the space
 * beyond rather than refusing. Null only when the track has no room anywhere.
 */
export function findSlot(
  track: Track,
  clipId: string,
  desired: number,
  duration: number,
): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;

  for (const gap of freeGaps(track, clipId)) {
    if (gap.end - gap.start < duration) continue;
    const clamped = Math.min(Math.max(desired, gap.start), gap.end - duration);
    const distance = Math.abs(clamped - desired);
    if (distance < bestDistance) {
      best = clamped;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * How far a clip's own edge may travel, for trimming.
 *
 * Safe to compute from the clip's current position because that position is
 * already valid — no other clip can contain it, so the ambiguity `freeGaps`
 * exists to resolve cannot arise here.
 */
export function slotBounds(
  track: Track,
  clipId: string,
  at: number,
): { min: number; max: number } {
  let min = 0;
  let max = MAX_FRAMES;

  for (const clip of track.clips) {
    if (clip.id === clipId) continue;
    const end = clip.from + clip.durationInFrames;
    if (end <= at) min = Math.max(min, end);
    else if (clip.from >= at) max = Math.min(max, clip.from);
  }

  return { min, max };
}

/** Move a clip along its track, or to another one, into the nearest free gap. */
export function moveClip(
  file: ProjectFile,
  clipId: string,
  toTrackId: string,
  from: number,
): ProjectFile {
  const found = findClip(file, clipId);
  const target = findTrack(file, toTrackId);
  if (!found || !target) return file;

  // Audio cannot land on a visual track, or the schema would reject the whole
  // file for one bad drag. The UI prevents it too; this is the backstop.
  const audio = found.clip.kind === "audio";
  if (audio !== (target.kind === "audio")) return file;

  const start = findSlot(
    target,
    clipId,
    Math.max(0, Math.round(from)),
    found.clip.durationInFrames,
  );
  // Nowhere on the track can hold it. Leaving it put is the only non-destructive
  // answer — the alternative is shoving somebody else's clip aside.
  if (start === null) return file;

  const moved: Clip = { ...found.clip, from: start };
  return addClip(removeClip(file, clipId), toTrackId, moved);
}

/**
 * Drag one edge of a clip.
 *
 * The left edge moves the start *and* shortens the clip, so the far edge stays
 * put — which is what makes trimming feel like trimming rather than sliding.
 * For media clips it also walks `startFrom`, so the visible frames stay the
 * same ones: trimming the head of a video should reveal less of it, not
 * retime it.
 */
export function trimClip(
  file: ProjectFile,
  clipId: string,
  edge: "start" | "end",
  frame: number,
): ProjectFile {
  const found = findClip(file, clipId);
  if (!found) return file;

  const { track, clip } = found;
  const end = clip.from + clip.durationInFrames;
  const bounds = slotBounds(track, clipId, clip.from);

  if (edge === "start") {
    const start = Math.min(
      Math.max(Math.round(frame), bounds.min),
      end - MIN_CLIP_FRAMES,
    );
    const delta = start - clip.from;

    const patch: Partial<Clip> = {
      from: start,
      durationInFrames: end - start,
    };

    if ("startFrom" in clip) {
      // Never below zero: dragging the left edge outwards past the head of the
      // source cannot invent footage that is not there.
      (patch as { startFrom: number }).startFrom = Math.max(
        0,
        clip.startFrom + delta,
      );
    }

    return updateClip(file, clipId, patch);
  }

  const finish = Math.min(
    Math.max(Math.round(frame), clip.from + MIN_CLIP_FRAMES),
    bounds.max,
  );
  return updateClip(file, clipId, { durationInFrames: finish - clip.from });
}

/**
 * Cut a clip in two at a frame.
 *
 * The right half keeps playing the same source content, which for media means
 * advancing `startFrom` by however much the left half consumed. Get that wrong
 * and a split video jumps back to its first frame — the bug every editor has
 * shipped at least once.
 */
export function splitClip(
  file: ProjectFile,
  clipId: string,
  frame: number,
): { file: ProjectFile; newClipId: string } | null {
  const found = findClip(file, clipId);
  if (!found) return null;

  const { track, clip } = found;
  const at = Math.round(frame);
  const offset = at - clip.from;

  if (offset < MIN_CLIP_FRAMES) return null;
  if (clip.durationInFrames - offset < MIN_CLIP_FRAMES) return null;

  const left: Clip = { ...clip, durationInFrames: offset };
  const right: Clip = {
    ...clip,
    id: mintId(clip.kind),
    from: at,
    durationInFrames: clip.durationInFrames - offset,
    ...("startFrom" in clip ? { startFrom: clip.startFrom + offset } : {}),
  } as Clip;

  const next = withClips(file, track.id, (clips) => [
    ...clips.filter((candidate) => candidate.id !== clipId),
    left,
    right,
  ]);

  return { file: next, newClipId: right.id };
}

/**
 * Copy a clip into the nearest gap that will hold it.
 *
 * Wants the space immediately after the original, and settles for the closest
 * one that fits. Null only when the track is full, because silently shoving a
 * neighbour along is worse than doing nothing.
 */
export function duplicateClip(
  file: ProjectFile,
  clipId: string,
): { file: ProjectFile; newClipId: string } | null {
  const found = findClip(file, clipId);
  if (!found) return null;

  const { track, clip } = found;
  const from = findSlot(
    track,
    "",
    clip.from + clip.durationInFrames,
    clip.durationInFrames,
  );
  if (from === null) return null;

  const copy: Clip = { ...clip, id: mintId(clip.kind), from };
  return { file: addClip(file, track.id, copy), newClipId: copy.id };
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

export function findElement(file: ProjectFile, elementId: string): Element | undefined {
  return file.elements.find((element) => element.id === elementId);
}

export function addElement(file: ProjectFile, element: Element): ProjectFile {
  return { ...file, elements: [...file.elements, element] };
}

/** How many clips were placed from an element. Shown beside it, and before deleting it. */
export function elementUses(file: ProjectFile, elementId: string): number {
  return file.tracks.reduce(
    (total, track) =>
      total + track.clips.filter((clip) => clip.elementId === elementId).length,
    0,
  );
}

/**
 * Remove an element and detach the clips placed from it.
 *
 * The clips stay — they are real clips with every field filled in — and only
 * lose their link. Deleting the Headline style should not delete the
 * headlines; it should stop them following it.
 */
export function removeElement(file: ProjectFile, elementId: string): ProjectFile {
  return {
    ...file,
    elements: file.elements.filter((element) => element.id !== elementId),
    tracks: file.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.elementId === elementId ? detached(clip) : clip,
      ),
    })),
  };
}

function detached(clip: Clip): Clip {
  const { elementId, ...rest } = clip;
  void elementId;
  return rest as Clip;
}

/** The keys of an element that are about the element, not about what it looks like. */
const IDENTITY = new Set(["id", "kind", "name", "role"]);

/**
 * Change an element, and every clip placed from it.
 *
 * This is what makes an element an element rather than a template: change
 * the Headline style's colour and every headline in the film changes. The
 * rule is simple on purpose — every patched key that is not the element's
 * identity is written onto every linked clip — because the alternative,
 * tracking per-clip overrides, is a second data model nobody asked for. A
 * clip's own edits survive until the same property changes on its element.
 */
export function updateElement(
  file: ProjectFile,
  elementId: string,
  patch: Partial<Element>,
): ProjectFile {
  const propagated = Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) => !IDENTITY.has(key) && value !== undefined,
    ),
  );

  return {
    ...file,
    elements: file.elements.map((element) =>
      element.id === elementId ? ({ ...element, ...patch } as Element) : element,
    ),
    tracks: file.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.elementId === elementId ? ({ ...clip, ...propagated } as Clip) : clip,
      ),
    })),
  };
}

export type Placement = {
  from: number;
  durationInFrames: number;
  label?: string;
  /** Words, for a text element. Required if the element has none of its own. */
  text?: string;
  box?: Partial<Box>;
  animation?: Partial<Animation>;
};

/**
 * A clip from an element and a place to put it.
 *
 * Everything the element knows is copied onto the clip — the clip is
 * self-contained, so the renderer and the inspector never resolve anything —
 * and the link is kept in `elementId` so later changes to the element reach
 * it. The words are the one thing a text style cannot supply by itself.
 */
export function clipFromElement(
  element: Element,
  placement: Placement,
): { ok: true; clip: ClipDraft } | { ok: false; message: string } {
  const place = {
    elementId: element.id,
    from: placement.from,
    durationInFrames: placement.durationInFrames,
    approval: "draft" as const,
    label: placement.label ?? element.name,
  };

  if (element.kind === "text") {
    const { id, name, role, text: defaultWords, ...style } = element;
    void id;
    void role;
    const text = placement.text?.trim() || defaultWords?.trim();
    if (!text) {
      return {
        ok: false,
        message: `“${name}” is a text style with no words of its own. Pass \`text\` when placing it.`,
      };
    }
    const clip: ClipDraft = {
      ...style,
      ...place,
      text,
      box: { ...style.box, ...placement.box },
      animation: { ...style.animation, ...placement.animation },
    };
    return { ok: true, clip };
  }

  if (element.kind === "audio") {
    const { id, name, role, ...sound } = element;
    void id;
    void name;
    void role;
    const clip: ClipDraft = { ...sound, ...place };
    return { ok: true, clip };
  }

  const { id, name, role, ...picture } = element;
  void id;
  void name;
  void role;
  const clip = {
    ...picture,
    ...place,
    box: { ...picture.box, ...placement.box },
    animation: { ...picture.animation, ...placement.animation },
  } as ClipDraft;
  return { ok: true, clip };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * Grow the composition so a clip fits.
 *
 * Called before anything that could push content past the end. Silently
 * extending is right here: an agent placing a clip at frame 900 of an
 * 800-frame film means the film is now longer, and refusing would be a rule
 * with nothing behind it.
 */
export function fitDuration(file: ProjectFile): ProjectFile {
  let end = 0;
  for (const track of file.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.from + clip.durationInFrames);
    }
  }
  if (end <= file.durationInFrames) return file;
  return { ...file, durationInFrames: Math.min(end, MAX_FRAMES) };
}

/** Shrink the composition to where the content actually stops. */
export function trimToContent(file: ProjectFile): ProjectFile {
  let end = 0;
  for (const track of file.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.from + clip.durationInFrames);
    }
  }
  return { ...file, durationInFrames: Math.max(1, end) };
}

/** Every asset path the composition refers to — clips and elements — deduplicated. */
export function referencedAssets(file: ProjectFile): string[] {
  const paths = new Set<string>();
  for (const track of file.tracks) {
    for (const clip of track.clips) {
      if ("src" in clip) paths.add(clip.src);
    }
  }
  for (const element of file.elements) {
    if ("src" in element) paths.add(element.src);
  }
  return [...paths];
}
