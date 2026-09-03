import { clipFromElement } from "./edits";
import type { Element, ProjectFile } from "@/types/prism";

/** Samples use the full composition so all overlapping layers are visible. */
export function styleSamples(file: ProjectFile) {
  const submitted = new Set(file.process.style.clipIds);
  const frames = new Set<number>();
  return file.tracks
    .filter((track) => track.kind === "visual" && !track.hidden)
    .flatMap((track) => track.clips)
    .filter((clip) => submitted.size === 0 || submitted.has(clip.id))
    .sort((a, b) => a.from - b.from)
    .flatMap((clip) => {
      const frame = Math.min(file.durationInFrames - 1, clip.from + Math.floor((clip.durationInFrames - 1) / 2));
      if (frames.has(frame)) return [];
      frames.add(frame);
      return [{ id: clip.id, label: clip.label ?? "Style sample", frame }];
    });
}

/** Preview an HTML element with the actual renderer, even before it is placed. */
export function htmlElementPreview(file: ProjectFile, element: Extract<Element, { kind: "html" }>): ProjectFile {
  const durationInFrames = Math.max(90, element.animation.enterFrames + element.animation.exitFrames + 30);
  const placed = clipFromElement(element, { from: 0, durationInFrames });
  return {
    ...file,
    durationInFrames,
    camera: [],
    tracks: [{
      id: "style-preview", name: element.name, kind: "visual", hidden: false, locked: false, volume: 0,
      clips: placed.ok ? [{ ...placed.clip, id: element.id }] : [],
    }],
  };
}
