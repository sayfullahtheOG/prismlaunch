"use client";

import { Lock, Sparkles } from "lucide-react";
import { select } from "@/lib/studio/actions";
import { STAGE_PURPOSE, timingLocked } from "@/lib/studio/process";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";
import { StageDecision, StageStatusChip } from "./StageDecision";

/**
 * The storyboard's side column: the decisions, and the list of boards.
 *
 * The boards themselves are drawn large in the middle of the screen; this
 * column is where they are approved or sent back, and where the animatic —
 * the same boards, on the timeline — is approved once they are. Two stages
 * live here because they are one artifact seen twice: as panels, then as a
 * cut. The list is for getting around: click a board here and the grid
 * scrolls to it and the inspector opens it.
 */
export function StoryboardPanel({ file }: { file: ProjectFile }) {
  const process = file.process;
  const panels = process.storyboard.panels;
  const selected = useStudioStore((state) => selectedIdOf(state.project, "panel"));
  const total = panels.reduce((n, panel) => n + panel.durationInFrames, 0);

  return (
    <PanelShell
      title="Storyboard"
      hint="The film before it exists. One board per beat: what is in the frame, what moves, how long, what the sound does."
    >
      <PanelSection label="Boards">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <StageStatusChip status={process.storyboard.status} />
            {panels.length > 0 ? (
              <span className="tabular font-mono text-2xs text-subtle">
                {panels.length} panels · {(total / file.fps).toFixed(1)}s
                {process.brief.lengthSeconds ? ` of ${process.brief.lengthSeconds}s` : ""}
              </span>
            ) : null}
          </div>

          {process.storyboard.summary ? (
            <p className="flex items-start gap-2 text-xs leading-[var(--ds-leading-body)] text-muted">
              <Sparkles size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Agent: </span>
                {process.storyboard.summary}
              </span>
            </p>
          ) : null}

          {process.storyboard.note ? (
            <p className="text-xs leading-[var(--ds-leading-body)] text-warning">
              <span className="font-medium">You said: </span>
              {process.storyboard.note}
            </p>
          ) : null}

          <StageDecision stage="storyboard" state={process.storyboard} process={process} />
        </div>
      </PanelSection>

      {process.storyboard.status === "approved" ? (
        <PanelSection label="Animatic">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <StageStatusChip status={process.animatic.status} />
              {timingLocked(process) ? (
                <span className="inline-flex items-center gap-1 font-mono text-2xs text-subtle">
                  <Lock size={10} strokeWidth={2.2} aria-hidden />
                  {process.animatic.beats.length} beats locked
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
              {STAGE_PURPOSE.animatic}
            </p>
            {process.animatic.note ? (
              <p className="text-xs leading-[var(--ds-leading-body)] text-warning">
                <span className="font-medium">You said: </span>
                {process.animatic.note}
              </p>
            ) : null}
            <StageDecision stage="animatic" state={process.animatic} process={process} />
          </div>
        </PanelSection>
      ) : null}

      {panels.length > 0 ? (
        <PanelSection label="Panels">
          <ol className="flex flex-col gap-1">
            {panels.map((panel, index) => {
              const isSelected = panel.id === selected;
              return (
                <li key={panel.id}>
                  <button
                    type="button"
                    onClick={() => select(panel.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`ds-focus flex w-full items-baseline gap-2.5 rounded-sm px-2 py-1.5 text-left transition-[background-color] duration-140 ${
                      isSelected ? "bg-sunken" : "hover:bg-sunken"
                    }`}
                  >
                    <span className="tabular w-4 shrink-0 font-mono text-2xs text-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">
                        {panel.label}
                      </span>
                      {panel.words ? (
                        <span className="block truncate text-2xs text-muted">
                          {panel.words}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 font-mono text-2xs text-subtle">
                      {(panel.durationInFrames / file.fps).toFixed(1)}s
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
