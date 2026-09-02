"use client";

import { findClip } from "@/lib/studio/edits";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";
import { ClipInspector } from "./inspector/ClipInspector";
import { CompositionInspector } from "./inspector/CompositionInspector";
import { PanelInspector } from "./inspector/PanelInspector";

/**
 * Properties of whatever is selected.
 *
 * One pane, many subjects: a clip in the timeline, the background row, and —
 * as the other sections come online — a storyboard panel or an element. The
 * selection says which; this only dispatches. Nothing here knows how to edit
 * anything.
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

  return (
    <aside
      aria-label="Properties"
      className="thin-scroll flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line-soft bg-surface"
    >
      {clip ? (
        <ClipInspector clip={clip.clip} track={clip.track} file={file} />
      ) : selection?.kind === "background" ? (
        <CompositionInspector file={file} />
      ) : panel ? (
        <PanelInspector panel={panel} index={panelIndex} file={file} />
      ) : (
        <Empty />
      )}
    </aside>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-center text-xs leading-[var(--ds-leading-body)] text-subtle">
        Select a clip in the timeline to edit it, or the Background row for the
        composition itself.
      </p>
    </div>
  );
}
