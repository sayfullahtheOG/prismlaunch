"use client";

import { useState } from "react";
import {
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
import { EmptyStudio, EmptyTimeline } from "./EmptyStudio";
import { RenderConfirm } from "./RenderConfirm";
import { useWebMcp } from "./WebMcpProvider";
import { IconRail } from "./IconRail";
import type { RailTab } from "./rail-tabs";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { Transport } from "./Transport";
import { AgentPanel } from "./panels/AgentPanel";
import { LookPanel } from "./panels/LookPanel";
import { ScenesPanel } from "./panels/ScenesPanel";
import { SourcePanel } from "./panels/SourcePanel";

/** Sections that describe a film, and so have nothing to describe before one exists. */
const NO_FILM_TABS: ReadonlySet<RailTab> = new Set<RailTab>(["scenes", "look"]);

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
  // Source is the only useful panel before a film exists, so open there.
  const [tab, setTab] = useState<RailTab>(project ? "scenes" : "source");

  // Registers the eight tools for the lifetime of this component, and reports
  // which implementation backs them.
  const webmcp = useWebMcp();

  const pendingRender = useStudioStore((state) => state.pendingRender);
  const renderNote = useStudioStore((state) => state.renderNote);
  const [rendering, setRendering] = useState(false);

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
   * No film yet.
   *
   * The chrome still renders, so the tool's shape is legible before there is
   * anything in it — and so the agent panel is reachable, which matters
   * because an agent can create the project without the person touching
   * anything.
   */
  if (!project) {
    return (
      <div className="chrome-select-none relative flex h-dvh min-h-0 flex-col bg-canvas">
        <TopBar
          productName="No film yet"
          duration="—"
          renderBlockedReason="Inspect a source to start a film"
          onRender={() => undefined}
        />

        <div className="flex min-h-0 flex-1">
          <IconRail
            active={tab}
            onChange={setTab}
            unavailable={NO_FILM_TABS}
            unavailableReason="Available once a film exists"
          />

          {/*
           * Source has no side panel here — the empty studio in the middle IS
           * the source step, and putting the same intake in two places would
           * only make the person wonder which one counts.
           */}
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
            <EmptyStudio />
            <EmptyTimeline />
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
  const candidates = product.componentCandidates;

  const total = timecode(totalSeconds(scenes));
  const elapsed = timecode(elapsedThrough(scenes, activeScene.id));
  const pendingDraft = scenes.find((scene) => scene.approval === "draft");

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
        productName={product.productName}
        duration={`${total} · 4 scenes`}
        renderBlockedReason={
          pendingDraft
            ? `Scene ${String(pendingDraft.order).padStart(2, "0")} still has an unreviewed draft`
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
          agentPending={Boolean(pendingDraft) || Boolean(pendingRender)}
        />

        <div className="flex w-[336px] shrink-0 flex-col border-r border-line-soft bg-surface">
          {tab === "scenes" ? (
            <ScenesPanel
              scenes={scenes}
              activeSceneId={activeScene.id}
              palette={palette}
              onSelect={(id: SceneId) => focusScene(id)}
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
          {tab === "source" ? (
            <SourcePanel
              candidates={candidates}
              productName={product.productName}
              framework={product.framework}
              sourceKind={product.source}
              warnings={product.inspectionWarnings}
              selectedId={activeScene.componentId}
              onSelect={(componentId) => patch({ componentId })}
            />
          ) : null}
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
            scenes={scenes}
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

      <RenderConfirm />
    </div>
  );
}
