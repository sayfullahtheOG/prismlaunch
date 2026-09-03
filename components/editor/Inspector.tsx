"use client";

import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { select } from "@/lib/studio/actions";
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
 * dispatches. Nothing here knows how to edit anything.
 *
 * It is not a column of the editor. It appears beside the preview when
 * there is a subject and is gone when there is not, so most of the time
 * the film has the width. Escape, or the close button, puts it away.
 */
export function Inspector({ file }: { file: ProjectFile }) {
  const selection = useStudioStore((state) => state.project?.selection ?? null);

  const clip = selection?.kind === "clip" ? findClip(file, selection.id) : undefined;
  const panelIndex =
    selection?.kind === "panel"
      ? file.process.storyboard.panels.findIndex((panel) => panel.id === selection.id)
      : -1;
  const panel = panelIndex >= 0 ? file.process.storyboard.panels[panelIndex] : undefined;
  const element = selection?.kind === "element" ? findElement(file, selection.id) : undefined;
  const background = selection?.kind === "background";

  if (!clip && !panel && !element && !background) return null;

  return (
    <aside
      aria-label="Properties"
      className="thin-scroll relative flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-line-soft bg-surface"
    >
      <IconButton
        label="Close properties"
        size="sm"
        onClick={() => select(null)}
        icon={<X size={13} strokeWidth={2} aria-hidden />}
        className="absolute top-3 right-3"
      />
      {clip ? (
        <ClipInspector clip={clip.clip} track={clip.track} file={file} />
      ) : background ? (
        <CompositionInspector file={file} />
      ) : panel ? (
        <PanelInspector panel={panel} index={panelIndex} file={file} />
      ) : element ? (
        <ElementInspector element={element} file={file} />
      ) : null}
    </aside>
  );
}
