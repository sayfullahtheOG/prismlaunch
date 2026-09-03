"use client";

import { Expand } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { reviewStage, select } from "@/lib/studio/actions";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";
import { PanelShell } from "./PanelShell";

/**
 * The boards, as a list beside the editor.
 *
 * Each row is one board: a thumbnail on the film's own ground, its label,
 * its length. Clicking one selects it and its notes open in the properties
 * pane. The boards at full size are a review and open from the process, or
 * from the button beside the title.
 */
export function StoryboardPanel({ file }: { file: ProjectFile }) {
  const panels = file.process.storyboard.panels;
  const selected = useStudioStore((state) => selectedIdOf(state.project, "panel"));
  const fill =
    file.background.kind === "solid"
      ? file.background.color
      : `linear-gradient(${file.background.angle}deg, ${file.background.from}, ${file.background.to})`;

  return (
    <PanelShell
      title="Storyboard"
      action={
        panels.length > 0 ? (
          <IconButton
            label="Open the boards at full size"
            size="sm"
            onClick={() => reviewStage("storyboard")}
            icon={<Expand size={13} strokeWidth={2} aria-hidden />}
          />
        ) : undefined
      }
    >
      {panels.length === 0 ? (
        <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
          No boards yet. Your agent submits them at the storyboard stage, one per beat.
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {panels.map((panel, index) => {
            const isSelected = panel.id === selected;
            const words = panel.words?.trim();
            return (
              <li key={panel.id}>
                <button
                  type="button"
                  onClick={() => select(panel.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`ds-focus flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-[background-color] duration-140 ${
                    isSelected ? "bg-sunken" : "hover:bg-sunken"
                  }`}
                >
                  <span
                    className={`relative flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-xs px-1 ${
                      isSelected
                        ? "shadow-[0_0_0_1.5px_var(--ds-color-accent)]"
                        : "shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
                    }`}
                    style={{ background: fill }}
                    aria-hidden
                  >
                    {words ? (
                      <span
                        className="line-clamp-2 text-center text-[6px] leading-[1.1] text-[#F5F5F7]"
                        style={{ fontFamily: "var(--film-display), Georgia, serif" }}
                      >
                        {words}
                      </span>
                    ) : (
                      <span className="font-mono text-[6px] text-[#F5F5F7]/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{panel.label}</span>
                    <span className="block truncate text-2xs text-muted">{panel.frame}</span>
                  </span>
                  <span className="tabular shrink-0 font-mono text-2xs text-subtle">
                    {(panel.durationInFrames / file.fps).toFixed(1)}s
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </PanelShell>
  );
}
