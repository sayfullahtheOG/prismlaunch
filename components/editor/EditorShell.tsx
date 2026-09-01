"use client";

import { useState } from "react";
import {
  acceptDraft,
  focusScene,
  keepCurrent,
  replayCurrent,
  setArtDirection,
  updateScene,
  type ScenePatch,
} from "@/lib/studio/actions";
import { PALETTES } from "@/lib/studio/palettes";
import { useStudioStore } from "@/lib/studio/store";
import { elapsedThrough, timecode, totalSeconds } from "@/lib/studio/timing";
import type { SceneId } from "@/types/prism";
import { Canvas } from "./Canvas";
import { IconRail, type RailTab } from "./IconRail";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { Transport } from "./Transport";
import { AgentPanel } from "./panels/AgentPanel";
import { LookPanel } from "./panels/LookPanel";
import { ScenesPanel } from "./panels/ScenesPanel";
import { SourcePanel } from "./panels/SourcePanel";

/**
 * The editor shell reads from the store and writes only through actions.
 *
 * There is no `setState` here and no local copy of the project — a WebMCP tool
 * executor calling the same action produces exactly the same visible result,
 * which is what makes the canvas genuinely shared.
 *
 * `tab` stays local: which panel is open is view state, not project state, and
 * nothing outside this component needs it.
 */
export function EditorShell() {
  const project = useStudioStore((state) => state.project);
  const playToken = useStudioStore((state) => state.playToken);
  const [tab, setTab] = useState<RailTab>("scenes");

  const palette = PALETTES[project.brief.artDirection];
  const activeScene =
    project.scenes.find((scene) => scene.id === project.activeSceneId) ??
    project.scenes[0]!;
  const candidates = project.product.componentCandidates;

  const total = timecode(totalSeconds(project.scenes));
  const elapsed = timecode(elapsedThrough(project.scenes, activeScene.id));
  const pendingDraft = project.scenes.find(
    (scene) => scene.approval === "draft",
  );

  function step(direction: 1 | -1) {
    const next = activeScene.order + direction;
    const wrapped = next < 1 ? 4 : next > 4 ? 1 : next;
    const target = project.scenes.find((scene) => scene.order === wrapped);
    if (target) focusScene(target.id);
  }

  function patch(next: ScenePatch) {
    updateScene(activeScene.id, next);
  }

  return (
    <div className="chrome-select-none flex h-dvh min-h-0 flex-col bg-app">
      <TopBar
        productName={project.product.productName}
        duration={`${total} · 4 scenes`}
        renderBlockedReason={
          pendingDraft
            ? `Scene ${String(pendingDraft.order).padStart(2, "0")} still has an unreviewed draft`
            : null
        }
        onRender={() => undefined}
      />

      <div className="flex min-h-0 flex-1">
        <IconRail
          active={tab}
          onChange={setTab}
          agentPending={Boolean(pendingDraft)}
        />

        <div className="flex w-[320px] shrink-0 flex-col border-r border-line bg-surface">
          {tab === "scenes" ? (
            <ScenesPanel
              scenes={project.scenes}
              activeSceneId={activeScene.id}
              palette={palette}
              onSelect={(id: SceneId) => focusScene(id)}
            />
          ) : null}
          {tab === "look" ? (
            <LookPanel
              artDirection={project.brief.artDirection}
              onArtDirection={setArtDirection}
              motion={activeScene.motionPreset}
              onMotion={(motionPreset) => patch({ motionPreset })}
            />
          ) : null}
          {tab === "source" ? (
            <SourcePanel
              candidates={candidates}
              productName={project.product.productName}
              framework={project.product.framework}
              sourceKind={project.product.source}
              warnings={project.product.inspectionWarnings}
              selectedId={activeScene.componentId}
              onSelect={(componentId) => patch({ componentId })}
            />
          ) : null}
          {tab === "agent" ? (
            <AgentPanel
              activity={project.activity}
              webmcpConnected
              toolCount={8}
            />
          ) : null}
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas
            scenes={project.scenes}
            artDirection={project.brief.artDirection}
            candidates={candidates}
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
            scenes={project.scenes}
            activeSceneId={activeScene.id}
            palette={palette}
            onSelect={(id: SceneId) => focusScene(id)}
          />
        </main>

        <Inspector
          scene={activeScene}
          candidates={candidates}
          onPatch={patch}
          onAcceptDraft={() => acceptDraft(activeScene.id)}
          onKeepCurrent={() => keepCurrent(activeScene.id)}
        />
      </div>
    </div>
  );
}
