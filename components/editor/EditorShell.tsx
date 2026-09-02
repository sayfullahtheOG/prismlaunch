"use client";

import { useState } from "react";
import {
  acceptAllDrafts,
  acceptDraft,
  focusScene,
  keepCurrent,
  replayCurrent,
  setArtDirection,
  startRenderAsHuman,
  updateScene,
  type ScenePatch,
} from "@/lib/studio/actions";
import { PALETTES } from "@/lib/studio/palettes";
import { useStudioStore } from "@/lib/studio/store";
import { elapsedThrough, timecode, totalSeconds } from "@/lib/studio/timing";
import type { SceneId } from "@/types/prism";
import { Canvas } from "./Canvas";
import { IconRail } from "./IconRail";
import { Inspector } from "./Inspector";
import { RenderConfirm } from "./RenderConfirm";
import { StartScreen } from "./StartScreen";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { Transport } from "./Transport";
import { useDiskSync } from "./useDiskSync";
import { useWebMcp } from "./WebMcpProvider";
import type { RailTab } from "./rail-tabs";
import { AgentPanel } from "./panels/AgentPanel";
import { FolderPanel } from "./panels/FolderPanel";
import { LookPanel } from "./panels/LookPanel";
import { ScenesPanel } from "./panels/ScenesPanel";

/** Sections that describe a film, and so have nothing to describe before one is open. */
const NO_FILM_TABS: ReadonlySet<RailTab> = new Set<RailTab>(["scenes", "look"]);

/**
 * The editor shell reads from the store and writes only through actions.
 *
 * There is no `setState` here and no local copy of the project — a WebMCP tool
 * executor calling the same action produces exactly the same visible result,
 * which is what makes the canvas genuinely shared. The film itself lives in a
 * file, and `useDiskSync` keeps this view following it, so an agent editing
 * `project.json` in its own editor changes what is on screen here without
 * calling anything.
 *
 * `tab` stays local: which panel is open is view state, not project state, and
 * nothing outside this component needs it.
 */
export function EditorShell() {
  const project = useStudioStore((state) => state.project);
  const playToken = useStudioStore((state) => state.playToken);
  const pendingRender = useStudioStore((state) => state.pendingRender);
  const renderNote = useStudioStore((state) => state.renderNote);

  // Restores the linked folder, then follows the file for as long as the page
  // is open. Called before the early return so the hook order never changes.
  useDiskSync();

  const [tab, setTab] = useState<RailTab>("scenes");
  const [rendering, setRendering] = useState(false);

  // Registers the tools for the lifetime of this component, and reports which
  // implementation backs them.
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

  /*
   * No film open.
   *
   * The chrome still renders, so the tool's shape is legible before there is
   * anything in it — and so the agent panel stays reachable, which matters
   * because the agent may be the one that creates the project.
   */
  if (!project) {
    return (
      <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-canvas">
        <TopBar
          productName="No film open"
          duration="—"
          renderBlockedReason="Open a film to export one"
          onRender={() => undefined}
        />

        <div className="flex min-h-0 flex-1">
          <IconRail
            active={tab}
            onChange={setTab}
            unavailable={NO_FILM_TABS}
            unavailableReason="Available once a film is open"
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

  // Narrowed once, into consts the closures below can capture — TypeScript
  // will not carry `project !== null` into a function declaration.
  const { scenes, product, brief } = project;
  const palette = PALETTES[brief.artDirection];
  const activeScene =
    scenes.find((scene) => scene.id === project.activeSceneId) ?? scenes[0]!;

  const total = timecode(totalSeconds(scenes));
  const elapsed = timecode(elapsedThrough(scenes, activeScene.id));
  const drafts = scenes.filter((scene) => scene.approval === "draft");
  const pendingDraft = drafts[0];

  function step(direction: 1 | -1) {
    const next = activeScene.order + direction;
    const wrapped = next < 1 ? 4 : next > 4 ? 1 : next;
    const target = scenes.find((scene) => scene.order === wrapped);
    if (target) focusScene(target.id);
  }

  function patch(next: ScenePatch) {
    updateScene(activeScene.id, next);
  }

  return (
    <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-app">
      <TopBar
        productName={product.name}
        duration={`${total} · 4 scenes`}
        renderBlockedReason={
          pendingDraft
            ? `${drafts.length} scene${drafts.length === 1 ? "" : "s"} still unreviewed`
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
          agentPending={drafts.length > 0 || Boolean(pendingRender)}
        />

        <div className="flex w-[336px] shrink-0 flex-col border-r border-line-soft bg-surface">
          {tab === "scenes" ? (
            <ScenesPanel
              scenes={scenes}
              activeSceneId={activeScene.id}
              palette={palette}
              onSelect={(id: SceneId) => focusScene(id)}
              onAcceptAll={drafts.length > 1 ? () => acceptAllDrafts() : undefined}
            />
          ) : null}
          {tab === "look" ? (
            <LookPanel
              artDirection={brief.artDirection}
              onArtDirection={setArtDirection}
              motion={activeScene.motionPreset}
              onMotion={(motionPreset) => patch({ motionPreset })}
            />
          ) : null}
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
          <Canvas
            scenes={scenes}
            artDirection={brief.artDirection}
            activeSceneId={activeScene.id}
            playToken={playToken}
          />
          <Transport
            elapsed={elapsed}
            total={total}
            onPlay={replayCurrent}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
          <Timeline
            scenes={scenes}
            activeSceneId={activeScene.id}
            palette={palette}
            onSelect={(id: SceneId) => focusScene(id)}
          />
        </main>

        <Inspector
          scene={activeScene}
          onPatch={patch}
          onAcceptDraft={() => acceptDraft(activeScene.id)}
          onKeepCurrent={() => keepCurrent(activeScene.id)}
        />
      </div>

      <RenderConfirm />
    </div>
  );
}
