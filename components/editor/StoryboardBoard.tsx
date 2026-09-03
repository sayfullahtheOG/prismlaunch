"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { select } from "@/lib/studio/actions";
import { beatFor, currentStage, STAGE_LABELS, timingLocked } from "@/lib/studio/process";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import { timecode } from "@/lib/studio/timing";
import type { ProjectFile, StoryboardPanel } from "@/types/prism";
import { ReviewBar } from "./ReviewBar";

/**
 * The boards, drawn large.
 *
 * A storyboard is read as a sequence of frames, and a sequence of frames
 * needs the width of the screen — six panels in a 300px column is a list,
 * not a board. So this takes the middle of the editor, where the canvas and
 * timeline normally are, with no column beside it, and lays the panels out
 * as a grid of frames with their notes beneath, the way a board is pinned
 * to a wall. It is the Storyboard section of the rail, and the storyboard
 * stage's review.
 *
 * Each frame is a rough, deliberately: the film's own ground with the
 * panel's words set on it in the display face. Enough to read the film as
 * a sequence and argue about the cut; not enough to argue about colour,
 * which is the next stage's job.
 */
export function StoryboardBoard({ file }: { file: ProjectFile }) {
  const panels = file.process.storyboard.panels;
  const selected = useStudioStore((state) => selectedIdOf(state.project, "panel"));
  const total = panels.reduce((n, panel) => n + panel.durationInFrames, 0);
  const locked = timingLocked(file.process);

  const grid = useRef<HTMLOListElement>(null);

  // A selection made elsewhere, the process panel say, scrolls its board into view.
  useEffect(() => {
    if (!selected) return;
    grid.current
      ?.querySelector(`[data-panel-id="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  if (panels.length === 0) return <EmptyBoard file={file} />;

  const fill =
    file.background.kind === "solid"
      ? file.background.color
      : `linear-gradient(${file.background.angle}deg, ${file.background.from}, ${file.background.to})`;

  const starts = startFrames(panels);

  return (
    <section
      aria-label="Storyboard"
      className="flex min-h-0 flex-1 flex-col bg-canvas"
    >
      <ReviewBar>
        <h2 className="text-xs font-medium text-ink">{file.name}</h2>
        <span className="tabular font-mono text-2xs text-subtle">
          {panels.length} panels · {timecode(total / file.fps)}
          {file.process.brief.lengthSeconds ? ` of ${file.process.brief.lengthSeconds}s` : ""}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-subtle">
            <Lock size={11} strokeWidth={2.2} aria-hidden />
            timing locked
          </span>
        ) : null}
      </ReviewBar>

      <ol
        ref={grid}
        className="thin-scroll grid min-h-0 flex-1 content-start gap-x-6 gap-y-8 overflow-y-auto p-6"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
      >
        {panels.map((panel, index) => {
          const from = starts[index] ?? 0;
          const beat = locked ? beatFor(file.process, { from, durationInFrames: panel.durationInFrames }) : undefined;
          return (
            <Board
              key={panel.id}
              panel={panel}
              index={index}
              from={from}
              fps={file.fps}
              fill={fill}
              selected={panel.id === selected}
              lockedLabel={beat ? `${timecode(beat.from / file.fps)}–${timecode((beat.from + beat.durationInFrames) / file.fps)}` : null}
            />
          );
        })}
      </ol>
    </section>
  );
}

/** Where each panel starts, laid end to end — the arithmetic `lay_animatic` does. */
function startFrames(panels: readonly StoryboardPanel[]): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const panel of panels) {
    starts.push(cursor);
    cursor += panel.durationInFrames;
  }
  return starts;
}

function Board({
  panel,
  index,
  from,
  fps,
  fill,
  selected,
  lockedLabel,
}: {
  panel: StoryboardPanel;
  index: number;
  from: number;
  fps: number;
  fill: string;
  selected: boolean;
  lockedLabel: string | null;
}) {
  const words = panel.words?.trim();
  return (
    <li data-panel-id={panel.id}>
      <button
        type="button"
        onClick={() => select(panel.id)}
        aria-current={selected ? "true" : undefined}
        aria-label={`Panel ${index + 1}, ${panel.label}`}
        className="ds-focus group flex w-full flex-col rounded-sm text-left"
      >
        {/* The frame: the only thing with an edge. */}
        <div
          className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs px-[8%] transition-[box-shadow] duration-140 ease-[var(--ease-standard)] ${
            selected
              ? "shadow-[0_0_0_2px_var(--ds-color-accent)]"
              : "shadow-[0_0_0_1px_var(--ds-color-line-soft)] group-hover:shadow-[0_0_0_1px_var(--ds-color-line)]"
          }`}
          style={{ background: fill }}
        >
          {words ? (
            <span
              className="line-clamp-3 text-center leading-[1.15] tracking-[-0.02em] text-[#F5F5F7]"
              style={{
                fontFamily: "var(--film-display), Georgia, serif",
                fontSize: words.length <= 8 ? "2rem" : words.length <= 24 ? "1.35rem" : "1.05rem",
              }}
            >
              {words}
            </span>
          ) : (
            <span className="font-mono text-2xs text-[#F5F5F7]/50">{panel.label}</span>
          )}

          <span className="tabular absolute top-2 left-2 rounded-xs bg-black/40 px-1.5 py-0.5 font-mono text-2xs text-[#F5F5F7]/80">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="tabular absolute right-2 bottom-2 rounded-xs bg-black/40 px-1.5 py-0.5 font-mono text-2xs text-[#F5F5F7]/80">
            {timecode(from / fps)} · {(panel.durationInFrames / fps).toFixed(1)}s
          </span>
        </div>

        {/* The notes under it, the way they are written under a pinned board. */}
        <div className="mt-2.5 flex w-full flex-col gap-1 px-0.5">
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink">{panel.label}</span>
            <span className="tabular ml-auto font-mono text-2xs text-subtle">
              {panel.transitionIn} → {panel.transitionOut}
            </span>
          </p>
          <p className="line-clamp-3 text-xs leading-[var(--ds-leading-body)] text-muted">
            {panel.frame}
          </p>
          {panel.action ? (
            <p className="line-clamp-2 text-xs leading-[var(--ds-leading-body)] text-subtle">
              <span className="font-medium text-muted">Moves </span>
              {panel.action}
            </p>
          ) : null}
          {panel.sound ? (
            <p className="line-clamp-1 text-xs text-subtle">♪ {panel.sound}</p>
          ) : null}
          {lockedLabel ? (
            <p className="inline-flex items-center gap-1 font-mono text-2xs text-subtle">
              <Lock size={10} strokeWidth={2.2} aria-hidden />
              {lockedLabel}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/**
 * Nothing boarded yet. Says where the process is so the empty grid is a
 * status, not a blank.
 */
function EmptyBoard({ file }: { file: ProjectFile }) {
  const stage = currentStage(file.process);
  const before = stage === "brief" || stage === "concept" || stage === "script";
  return (
    <section
      aria-label="Storyboard"
      className="flex min-h-0 flex-1 flex-col bg-canvas"
    >
      <ReviewBar>
        <h2 className="text-xs font-medium text-ink">{file.name}</h2>
      </ReviewBar>
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-[360px] text-center">
        <p className="text-sm font-medium text-ink">No boards yet</p>
        <p className="mt-1.5 text-xs leading-[var(--ds-leading-body)] text-muted">
          {before && stage
            ? `Your agent boards the film once the script is approved. The process is at ${STAGE_LABELS[stage]}.`
            : "Your agent submits the boards with prism.submit_storyboard: one panel per beat, in order."}
        </p>
      </div>
      </div>
    </section>
  );
}
