"use client";

import { useEffect, useState } from "react";
import {
  createBlankProject,
  deleteClip,
  deleteProject,
  duplicateSelected,
  openProject,
  refreshProjects,
  renameProject,
  seek,
  select,
  setPlaying,
  showTab,
  splitAtPlayhead,
  startRenderAsHuman,
} from "@/lib/studio/actions";
import { BLANK_FILE } from "@/lib/studio/blank";
import { currentStage } from "@/lib/studio/process";
import { middleView, reviewedStage } from "@/lib/studio/review";
import { selectedClipId } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import { draftCount } from "@/lib/studio/timing";
import { Timeline } from "@/components/timeline/Timeline";
import { Canvas } from "./Canvas";
import { IconRail } from "./IconRail";
import { Inspector } from "./Inspector";
import { RenderConfirm } from "./RenderConfirm";
import { SetupDialog } from "./SetupDialog";
import { StageReview } from "./StageReview";
import { StoryboardBoard } from "./StoryboardBoard";
import { TopBar } from "./TopBar";
import { useDiskSync } from "./useDiskSync";
import { useWebMcp } from "./WebMcpProvider";
import { AgentPanel } from "./panels/AgentPanel";
import { ElementsPanel } from "./panels/ElementsPanel";
import { ProcessPanel } from "./panels/ProcessPanel";
import { StoryboardPanel } from "./panels/StoryboardPanel";

/**
 * The editor is the page.
 *
 * It renders whether or not a composition is open. With nothing open it
 * renders a blank one — the same blank `createProject` writes — behind the
 * setup dialog, inert and dimmed, so the first thing a person sees is the tool
 * itself and not a landing page standing in for it. The dialog closes the
 * moment a composition opens, and the same chrome carries on with real data.
 *
 * Three columns: the rail and its section on the left, the film in the
 * middle, properties on the right. Which section is showing lives in the
 * store rather than here, because the Process panel needs to open the
 * storyboard or the elements from a link, and a `useState` here would be
 * unreachable from there.
 *
 * Everything reads from the store and writes only through actions. A WebMCP
 * tool executor calling the same action produces exactly the same visible
 * result, which is what makes the canvas genuinely shared. The film lives in
 * a file; `useDiskSync` keeps this view following it.
 */
export function EditorShell() {
  const project = useStudioStore((state) => state.project);
  const workspace = useStudioStore((state) => state.workspace);
  const pendingRender = useStudioStore((state) => state.pendingRender);
  const renderNote = useStudioStore((state) => state.renderNote);
  const tab = useStudioStore((state) => state.tab);
  const openStage = useStudioStore((state) => state.openStage);
  const reviewOpen = useStudioStore((state) => state.reviewing);

  useDiskSync();
  useTimelineKeys();

  const [rendering, setRendering] = useState(false);
  const webmcp = useWebMcp();

  const setupOpen = project === null;
  const file = project?.file ?? BLANK_FILE;
  const drafts = draftCount(file.tracks);
  const compositions = workspace.kind === "linked" ? workspace.projects : [];

  // A stage waiting on the person is the same kind of thing as a draft clip:
  // the agent has proposed, and nothing moves until they answer.
  const stage = currentStage(file.process);
  const stageWaiting = stage !== null && file.process[stage].status === "submitted";

  const view = middleView(tab, openStage, file.process, reviewOpen);
  const reviewing = reviewedStage(openStage, file.process);

  async function exportFilm() {
    const store = useStudioStore.getState();
    setRendering(true);
    store.setRenderNote("Encoding in your browser…");

    const result = await startRenderAsHuman((fraction) =>
      store.setRenderNote(`Encoding… ${Math.round(fraction * 100)}%`),
    );

    setRendering(false);
    store.setRenderNote(result.message);
  }

  return (
    <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-canvas">
      {/*
        `inert` takes the whole editor out of the tab order and the
        accessibility tree while the dialog is up — a screen reader should
        not find a timeline behind a modal that says "link a folder first".
      */}
      <div
        inert={setupOpen}
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-140 ${
          setupOpen ? "opacity-90" : ""
        }`}
      >
        <TopBar
          name={project ? file.name : "No composition open"}
          {...(project
            ? {
                project: {
                  slug: project.slug,
                  compositions,
                  // The folder can gain a composition without the app doing
                  // it — an agent writing one with its own file tools.
                  // Re-reading as the menu opens is the cheapest moment to
                  // make the list true.
                  onOpenMenu: () => void refreshProjects(),
                  onOpen: (slug) => void openProject(slug),
                  onRename: (next) => void renameProject(next),
                  onCreate: () => void createBlankProject(),
                  onDelete: () => void deleteProject(project.slug),
                },
              }
            : {})}
          renderBlockedReason={
            !project
              ? "Open a composition to export one"
              : drafts > 0
                ? `${drafts} clip${drafts === 1 ? "" : "s"} still unreviewed`
                : null
          }
          onRender={() => void exportFilm()}
          note={renderNote}
          busy={rendering}
        />

        <div className="flex min-h-0 flex-1">
          <IconRail
            active={tab}
            onChange={showTab}
            agentPending={drafts > 0 || stageWaiting || Boolean(pendingRender)}
          />

          <div className="flex w-[300px] shrink-0 flex-col border-r border-line-soft bg-surface">
            {tab === "process" ? <ProcessPanel file={file} /> : null}
            {tab === "storyboard" ? <StoryboardPanel file={file} /> : null}
            {tab === "elements" ? <ElementsPanel file={file} /> : null}
            {tab === "agent" ? (
              <AgentPanel
                activity={project?.activity ?? []}
                kind={webmcp.kind}
                toolCount={webmcp.registered}
                slug={project?.slug ?? null}
              />
            ) : null}
          </div>

          {/*
            The middle is whatever is being reviewed. A document stage opens
            as a page at reading size; the storyboard takes the width a
            sequence of frames needs; everything else is the film itself,
            canvas and timeline, which is what the animatic, the style frames
            and the build are.

            Properties sit beside the picture, not beside the whole editor,
            and only while something is selected. The timeline runs the full
            width underneath.
          */}
          <main id="studio" className="flex min-w-0 flex-1 flex-col">
            {view === "boards" ? (
              <div className="flex min-h-0 flex-1">
                <StoryboardBoard file={file} />
                <Inspector file={file} />
              </div>
            ) : view === "review" && reviewing ? (
              <StageReview stage={reviewing} file={file} />
            ) : (
              <>
                <div className="flex min-h-0 flex-1">
                  <Canvas file={file} />
                  <Inspector file={file} />
                </div>
                <Timeline file={file} />
              </>
            )}
          </main>
        </div>
      </div>

      {setupOpen ? <SetupDialog /> : null}

      <RenderConfirm />
    </div>
  );
}

/**
 * Timeline keyboard shortcuts.
 *
 * The set every editor shares, so muscle memory transfers: space to play,
 * arrows to step a frame, S to split, D to duplicate, Delete to remove.
 *
 * Skipped entirely while focus is in a text field — otherwise typing a space
 * into a headline would start playback, which is the single most annoying bug
 * a timeline app can have. Skipped, too, while nothing is open: the editor
 * behind the setup dialog is inert, and a keypress should not reach it.
 */
function useTimelineKeys(): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }

      const store = useStudioStore.getState();
      if (!store.project) return;

      // Escape puts the properties away, whatever is on screen.
      if (event.key === "Escape") {
        if (store.project.selection) {
          event.preventDefault();
          select(null);
        }
        return;
      }

      // No timeline on screen, no timeline shortcuts: space over the boards
      // or a brief should not start a player nobody can see.
      if (
        middleView(store.tab, store.openStage, store.project.file.process, store.reviewing) !==
        "editor"
      ) {
        return;
      }

      const step = event.shiftKey ? store.project.file.fps : 1;

      switch (event.key) {
        case " ":
          event.preventDefault();
          setPlaying(!store.playing);
          break;
        case "ArrowLeft":
          event.preventDefault();
          seek(store.playhead - step);
          break;
        case "ArrowRight":
          event.preventDefault();
          seek(store.playhead + step);
          break;
        case "Home":
          event.preventDefault();
          seek(0);
          break;
        case "End":
          event.preventDefault();
          seek(store.project.file.durationInFrames);
          break;
        case "s":
        case "S":
          if (event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          splitAtPlayhead();
          break;
        case "d":
        case "D":
          if (event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          duplicateSelected();
          break;
        case "Delete":
        case "Backspace": {
          const clipId = selectedClipId(store.project);
          if (clipId) {
            event.preventDefault();
            deleteClip(clipId);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
