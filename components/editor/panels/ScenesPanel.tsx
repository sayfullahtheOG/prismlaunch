"use client";

import { Check, Sparkles } from "lucide-react";
import type { Palette, Scene } from "@/types/prism";
import { framesToSeconds } from "@/lib/studio/timing";
import { PanelShell, PanelSection } from "./PanelShell";

type Props = {
  scenes: Scene[];
  activeSceneId: Scene["id"];
  palette: Palette;
  onSelect: (id: Scene["id"]) => void;
};

const NARRATIVE_JOB: Record<Scene["template"], string> = {
  "kinetic-type": "Establish the pain",
  "product-reveal": "Reveal the product",
  "component-spotlight": "Prove one feature",
  "outcome-cta": "Land the outcome",
};

export function ScenesPanel({ scenes, activeSceneId, palette, onSelect }: Props) {
  return (
    <PanelShell
      title="Scenes"
      hint="Four fixed scenes. Edit any of them — order and count never change."
    >
      <PanelSection label="Storyboard">
        <div className="flex flex-col gap-2">
          {scenes.map((scene) => {
            const isActive = scene.id === activeSceneId;
            const isDraft = scene.approval === "draft";

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onSelect(scene.id)}
                aria-current={isActive ? "true" : "false"}
                className={`flex gap-3 rounded-sm border p-2 text-left transition-colors ds-focus ${
                  isDraft
                    ? "border-warning/40 bg-warning-soft"
                    : isActive
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface hover:border-line"
                }`}
              >
                <span
                  className="grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-[5px]"
                  style={{ background: palette.background }}
                >
                  <span
                    className="h-0.5 w-8 rounded-pill"
                    style={{ background: palette.accent }}
                  />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[10.5px] tabular-nums ${
                        isDraft ? "text-warning" : "text-subtle"
                      }`}
                    >
                      {String(scene.order).padStart(2, "0")}
                    </span>
                    <span className="truncate text-xs font-semibold">
                      {NARRATIVE_JOB[scene.template]}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-subtle tabular-nums">
                      {framesToSeconds(scene.durationFrames).toFixed(1)}s
                    </span>
                  </span>

                  <span className="truncate text-[11.5px] text-muted">
                    {scene.headline}
                  </span>

                  <span className="mt-0.5">
                    {isDraft ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        <Sparkles size={9} strokeWidth={2.4} aria-hidden />
                        Agent draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-subtle">
                        <Check size={9} strokeWidth={2.6} aria-hidden />
                        Accepted
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>
    </PanelShell>
  );
}
