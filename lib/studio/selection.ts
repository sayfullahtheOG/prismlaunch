import type { FilmProject, Selection } from "@/types/prism";

/**
 * What is selected, asked the way each part of the chrome asks it.
 *
 * Selection is one value on the project — a clip, a track, a storyboard
 * panel, an element, or the background — and the inspector shows whichever it
 * is. The timeline only ever asks about clips and tracks, and "is this clip
 * selected" should not make every caller spell out the union.
 */

type Keyed = Exclude<Selection, { kind: "background" }>;

export function selectedIdOf(
  project: FilmProject | null,
  kind: Keyed["kind"],
): string | null {
  const selection = project?.selection;
  return selection && selection.kind === kind ? selection.id : null;
}

export function selectedClipId(project: FilmProject | null): string | null {
  return selectedIdOf(project, "clip");
}

export function backgroundSelected(project: FilmProject | null): boolean {
  return project?.selection?.kind === "background";
}
