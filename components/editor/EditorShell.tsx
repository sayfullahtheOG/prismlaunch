"use client";

import { useState } from "react";
import { demoProject } from "@/lib/source/demo-project";
import { PALETTES } from "@/lib/studio/palettes";
import { elapsedThrough, timecode, totalSeconds } from "@/lib/studio/timing";
import type {
  ArtDirection,
  FilmProject,
  MotionPreset,
  Scene,
  SceneId,
} from "@/types/prism";
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
 * The editor shell owns all state for now.
 *
 * Next unit replaces this `useState` with the Zustand store, and every mutation
 * below becomes a call into lib/studio/actions.ts — the single mutation path
 * shared by human handlers and WebMCP tool executors
 * (context/architecture.md invariant 1). The shapes here are already the
 * schema-derived ones, so that swap is mechanical rather than a rewrite.
 */
export function EditorShell() {
  const [project, setProject] = useState<FilmProject>(demoProject);
  const [tab, setTab] = useState<RailTab>("scenes");
  const [playToken, setPlayToken] = useState(0);

  const palette = PALETTES[project.brief.artDirection];
  const activeScene =
    project.scenes.find((s) => s.id === project.activeSceneId) ??
    project.scenes[0]!;
  const candidates = project.product.componentCandidates;

  const total = timecode(totalSeconds(project.scenes));
  const elapsed = timecode(elapsedThrough(project.scenes, activeScene.id));
  const pendingDraft = project.scenes.find((s) => s.approval === "draft");

  function replay() {
    setPlayToken((token) => token + 1);
  }

  function selectScene(id: SceneId) {
    setProject((prev) => ({ ...prev, activeSceneId: id }));
    replay();
  }

  function step(direction: 1 | -1) {
    const next = activeScene.order + direction;
    const wrapped = next < 1 ? 4 : next > 4 ? 1 : next;
    const target = project.scenes.find((s) => s.order === wrapped);
    if (target) selectScene(target.id);
  }

  function patchScene(patch: Partial<Scene>) {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) =>
        scene.id === prev.activeSceneId ? { ...scene, ...patch } : scene,
      ),
    }));
    replay();
  }

  /**
   * Resolving a draft is the one action an agent can never take. It clears the
   * amber state everywhere at once — timeline clip, scenes panel, inspector —
   * and unlocks Export.
   */
  function resolveDraft(accepted: boolean) {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.id !== prev.activeSceneId) return scene;

        const restored =
          !accepted && scene.previousHeadline
            ? scene.previousHeadline
            : scene.headline;

        return {
          ...scene,
          approval: "accepted" as const,
          headline: restored,
          revisionNote: undefined,
          previousHeadline: undefined,
        };
      }),
      activity: [
        ...prev.activity.filter((event) => !event.blocked),
        {
          id: `ev-${prev.activity.length + 1}`,
          origin: "human" as const,
          label: accepted ? "Accepted draft" : "Kept current",
          detail: `Scene ${String(activeScene.order).padStart(2, "0")}`,
          at: "14:05:20",
          sceneId: prev.activeSceneId,
        },
      ],
    }));
    replay();
  }

  function setArtDirection(artDirection: ArtDirection) {
    setProject((prev) => ({
      ...prev,
      brief: { ...prev.brief, artDirection },
    }));
    replay();
  }

  function setMotion(motionPreset: MotionPreset) {
    patchScene({ motionPreset });
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
              onSelect={selectScene}
            />
          ) : null}
          {tab === "look" ? (
            <LookPanel
              artDirection={project.brief.artDirection}
              onArtDirection={setArtDirection}
              motion={activeScene.motionPreset}
              onMotion={setMotion}
            />
          ) : null}
          {tab === "source" ? (
            <SourcePanel
              candidates={candidates}
              selectedId={activeScene.componentId}
              onSelect={(componentId) => patchScene({ componentId })}
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
          <Canvas scene={activeScene} palette={palette} playToken={playToken} />
          <Transport
            elapsed={elapsed}
            total={total}
            onPlay={replay}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
          <Timeline
            scenes={project.scenes}
            activeSceneId={activeScene.id}
            palette={palette}
            onSelect={selectScene}
          />
        </main>

        <Inspector
          scene={activeScene}
          candidates={candidates}
          onPatch={patchScene}
          onAcceptDraft={() => resolveDraft(true)}
          onKeepCurrent={() => resolveDraft(false)}
        />
      </div>
    </div>
  );
}
