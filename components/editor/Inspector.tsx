"use client";

import { findClip, findElement } from "@/lib/studio/edits";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";
import { ClipInspector } from "./inspector/ClipInspector";
import { CompositionInspector } from "./inspector/CompositionInspector";
import { ElementInspector } from "./inspector/ElementInspector";
import { PanelInspector } from "./inspector/PanelInspector";

/**
 * Properties of whatever is selected.
 *
 * One pane, many subjects: a clip in the timeline, the background row, a
 * storyboard panel, an element. The selection says which; this only
 * dispatches. With nothing selected it shows the composition itself — its
 * ground, its length, its size — because a properties pane with a sentence
 * in it is a column of nothing, and the film is always there to edit.
 */
export function Inspector({ file }: { file: ProjectFile }) {
  const selection = useStudioStore((state) => state.project?.selection ?? null);

  const clip =
    selection?.kind === "clip" ? findClip(file, selection.id) : undefined;
  const panelIndex =
    selection?.kind === "panel"
      ? file.process.storyboard.panels.findIndex((panel) => panel.id === selection.id)
      : -1;
  const panel = panelIndex >= 0 ? file.process.storyboard.panels[panelIndex] : undefined;
  const element =
    selection?.kind === "element" ? findElement(file, selection.id) : undefined;

  return (
    <aside
      aria-label="Properties"
      className="thin-scroll flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-line-soft bg-surface"
    >
      {clip ? (
        <ClipInspector clip={clip.clip} track={clip.track} file={file} />
      ) : selection?.kind === "background" ? (
        <CompositionInspector file={file} />
      ) : panel ? (
        <PanelInspector panel={panel} index={panelIndex} file={file} />
      ) : element ? (
        <ElementInspector element={element} file={file} />
      ) : (
        <CompositionInspector file={file} />
      )}
    </aside>
  );
}
