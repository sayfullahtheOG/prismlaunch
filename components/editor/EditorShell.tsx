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
  setPlaying,
  splitAtPlayhead,
  startRenderAsHuman,
} from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";
import { draftCount } from "@/lib/studio/timing";
import { Timeline } from "@/components/timeline/Timeline";
import { Canvas } from "./Canvas";
import { IconRail } from "./IconRail";
import { Inspector } from "./Inspector";
import { RenderConfirm } from "./RenderConfirm";
import { StartScreen } from "./StartScreen";
import { TopBar } from "./TopBar";
import { useDiskSync } from "./useDiskSync";
import { useWebMcp } from "./WebMcpProvider";
import type { RailTab } from "./rail-tabs";
import { AgentPanel } from "./panels/AgentPanel";
import { CanvasPanel } from "./panels/CanvasPanel";
import { FolderPanel } from "./panels/FolderPanel";
import { LayersPanel } from "./panels/LayersPanel";

/** Sections that describe a composition, so have nothing to describe before one is open. */
const NO_FILM_TABS: ReadonlySet<RailTab> = new Set<RailTab>(["layers", "canvas"]);

/**
 * The editor shell reads from the store and writes only through actions.
 *
 * There is no `setState` here and no local copy of the composition — a WebMCP
 * tool executor calling the same action produces exactly the same visible
 * result, which is what makes the canvas genuinely shared. The film itself
 * lives in a file, and `useDiskSync` keeps this view following it, so an agent
 * editing `project.json` in its own editor changes what is on screen without
 * calling anything.
 *
 * `tab` stays local: which panel is open is view state, not project state, and
 * nothing outside this component needs it.
 */
export function EditorShell() {
  const project = useStudioStore((state) => state.project);
  const workspace = useStudioStore((state) => state.workspace);
  const pendingRender = useStudioStore((state) => state.pendingRender);
  const renderNote = useStudioStore((state) => state.renderNote);

  // Restores the linked folder, then follows the file for as long as the page
  // is open. Called before the early return so the hook order never changes.
  useDiskSync();
  useTimelineKeys();

  const [tab, setTab] = useState<RailTab>("layers");
  const [rendering, setRendering] = useState(false);

  const webmcp = useWebMcp();

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

  if (!project) {
    return (
      <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-canvas">
        <TopBar
          name="No composition open"
          renderBlockedReason="Open a composition to export one"
          onRender={() => undefined}
        />

        <div className="flex min-h-0 flex-1">
          <IconRail
            active={tab}
            onChange={setTab}
            unavailable={NO_FILM_TABS}
            unavailableReason="Available once a composition is open"
          />

          {tab === "agent" ? (
            <div className="flex w-[336px] shrink-0 flex-col border-r border-line-soft bg-surface">
              <AgentPanel
                activity={[]}
                kind={webmcp.kind}
                toolCount={webmcp.registered}
              />
            </div>
          ) : null}

          <main id="studio" className="flex min-w-0 flex-1 flex-col">
            <StartScreen />
          </main>
        </div>
      </div>
    );
  }

  const { file } = project;
  const drafts = draftCount(file.tracks);
  const compositions = workspace.kind === "linked" ? workspace.projects : [];

  return (
    <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-app">
      <TopBar
        name={file.name}
        project={{
          slug: project.slug,
          compositions,
          // The folder can gain a composition without the app doing it — an
          // agent writing one with its own file tools. Re-reading as the menu
          // opens is the cheapest moment to make the list true.
          onOpenMenu: () => void refreshProjects(),
          onOpen: (slug) => void openProject(slug),
          onRename: (next) => void renameProject(next),
          onCreate: () => void createBlankProject(),
          onDelete: () => void deleteProject(project.slug),
        }}
        renderBlockedReason={
          drafts > 0
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
          onChange={setTab}
          agentPending={drafts > 0 || Boolean(pendingRender)}
        />

        <div className="flex w-[300px] shrink-0 flex-col border-r border-line-soft bg-surface">
          {tab === "layers" ? <LayersPanel file={file} /> : null}
          {tab === "canvas" ? <CanvasPanel file={file} /> : null}
          {tab === "folder" ? <FolderPanel /> : null}
          {tab === "agent" ? (
            <AgentPanel
              activity={project.activity}
              kind={webmcp.kind}
              toolCount={webmcp.registered}
            />
          ) : null}
        </div>

        <main id="studio" className="flex min-w-0 flex-1 flex-col">
          <Canvas file={file} />
          <Timeline file={file} />
        </main>

        <Inspector file={file} />
      </div>

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
 * a timeline app can have.
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
        case "Backspace":
          if (store.project.selectedId) {
            event.preventDefault();
            deleteClip(store.project.selectedId);
          }
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
