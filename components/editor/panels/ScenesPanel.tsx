"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { framesToSeconds } from "@/lib/studio/timing";
import type { Palette, Scene } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

type Props = {
  scenes: Scene[];
  activeSceneId: Scene["id"];
  palette: Palette;
  onSelect: (id: Scene["id"]) => void;
  /** Present only when more than one draft is waiting. */
  onAcceptAll?: (() => void) | undefined;
};

const NARRATIVE_JOB: Record<Scene["template"], string> = {
  "kinetic-type": "Establish the pain",
  "product-reveal": "Reveal the product",
  "feature-spotlight": "Prove one feature",
  "outcome-cta": "Land the outcome",
};

/**
 * The scene list.
 *
 * Uses the same depth vocabulary as the timeline, deliberately — these are two
 * views of one object, so a selected scene must read identically in both:
 * raised at rest, inset when selected, inset and warning-toned when it holds an
 * unreviewed draft.
 */
export function ScenesPanel({
  scenes,
  activeSceneId,
  palette,
  onSelect,
  onAcceptAll,
}: Props) {
  const drafts = scenes.filter((scene) => scene.approval === "draft").length;
  return (
    <PanelShell
      title="Scenes"
      hint="Four fixed scenes. Edit any of them — order and count never change."
    >
      <PanelSection label="Storyboard">
        <ul className="flex flex-col gap-2">
          {scenes.map((scene) => {
            const selected = scene.id === activeSceneId;
            const draft = scene.approval === "draft";

            return (
              <li key={scene.id}>
                <button
                  type="button"
                  onClick={() => onSelect(scene.id)}
                  aria-current={selected ? "true" : "false"}
                  className={`ds-focus flex w-full items-center gap-3 rounded-sm p-2.5 text-left transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
                    draft
                      ? "ds-inset bg-warning-soft"
                      : selected
                        ? "ds-inset bg-sunken"
                        : "ds-raised bg-raised hover:bg-strong"
                  }`}
                >
                  <span
                    className="grid aspect-video w-[72px] shrink-0 place-items-center overflow-hidden rounded-xs"
                    style={{ background: palette.background }}
                    aria-hidden
                  >
                    <span
                      className="h-0.5 w-8 rounded-pill"
                      style={{ background: palette.accent }}
                    />
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`tabular font-mono text-2xs ${
                          draft
                            ? "text-warning"
                            : selected
                              ? "text-accent"
                              : "text-subtle"
                        }`}
                      >
                        {String(scene.order).padStart(2, "0")}
                      </span>
                      <span className="truncate text-xs font-semibold text-ink">
                        {NARRATIVE_JOB[scene.template]}
                      </span>
                      <span className="tabular ml-auto shrink-0 font-mono text-2xs text-subtle">
                        {framesToSeconds(scene.durationFrames).toFixed(1)}s
                      </span>
                    </span>

                    <span className="truncate text-xs text-muted">
                      {scene.headline}
                    </span>

                    {/* State is words + icon, never colour alone. */}
                    {draft ? (
                      <span className="flex items-center gap-1.5 text-2xs font-semibold text-warning">
                        <Sparkles size={12} strokeWidth={2.2} aria-hidden />
                        Agent draft
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-2xs text-subtle">
                        <Check size={12} strokeWidth={2.4} aria-hidden />
                        Accepted
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/*
          * Reviewing scene by scene is the right default — that is the whole
          * approval boundary — but a person who has watched the film and likes
          * it should not have to click four times to say so.
          */}
        {onAcceptAll ? (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={onAcceptAll}
            icon={<Check size={14} strokeWidth={2.4} aria-hidden />}
          >
            Accept all {drafts} drafts
          </Button>
        ) : null}
      </PanelSection>
    </PanelShell>
  );
}
