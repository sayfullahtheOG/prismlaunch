"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Lock,
  Sparkles,
} from "lucide-react";
import { reviewStage } from "@/lib/studio/actions";
import {
  currentStage,
  STAGE_LABELS,
  STAGE_PURPOSE,
  timingLocked,
} from "@/lib/studio/process";
import { REVIEW_PAGES } from "@/lib/studio/review";
import { STAGES } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";
import { clipCount } from "@/lib/studio/timing";
import type { Process, ProjectFile, StageId } from "@/types/prism";
import { PanelShell } from "./PanelShell";
import { STAGE_STATUS, StageDecision } from "./StageDecision";

/**
 * The pipeline, as a list.
 *
 * Nine stages down the side, one line each: where the film is and what is
 * waiting on the person, at a glance. The agent submits into a stage; the
 * person reads what arrived and either approves it or sends it back with a
 * note. Nothing here writes an artifact, and nothing the agent can call
 * approves one.
 *
 * Reading and deciding happen in the middle, at reading size: a document
 * stage opens as a page, the storyboard as the boards. This column does not
 * repeat them. Style frames has its own gallery. The
 * animatic and build use a screening, so for those the
 * row opens here with what to look at and the two buttons.
 */
export function ProcessPanel({ file }: { file: ProjectFile }) {
  const process = file.process;
  const current = currentStage(process);
  const open = useStudioStore((state) => state.openStage);
  const setOpen = useStudioStore((state) => state.setOpenStage);

  // The current stage is the one under review unless the person opened another.
  const reviewing = open ?? current;

  return (
    <PanelShell
      title="Process"
      hint="Your agent submits each stage. You approve it, or send it back with a note."
    >
      <ol className="flex flex-col gap-0.5">
        {STAGES.map((stage, index) => (
          <StageRow
            key={stage}
            stage={stage}
            index={index}
            state={process[stage]}
            file={file}
            isCurrent={stage === current}
            isOpen={stage === reviewing}
            onClose={() => setOpen(null)}
          />
        ))}
      </ol>

      {current === null ? (
        <p className="mt-4 flex items-start gap-2 border-t border-line-soft pt-4 text-xs leading-[var(--ds-leading-body)] text-success">
          <Check size={13} strokeWidth={2.4} className="mt-px shrink-0" aria-hidden />
          Every stage is approved. Export is the last step.
        </p>
      ) : null}

      {timingLocked(process) ? (
        <p className="mt-4 flex items-start gap-2 border-t border-line-soft pt-4 text-xs leading-[var(--ds-leading-body)] text-muted">
          <Lock size={12} strokeWidth={2} className="mt-px shrink-0 text-subtle" aria-hidden />
          Timing is locked across {process.animatic.beats.length} beats. Your
          agent can only build inside them. Reopen the animatic to change the
          cut.
        </p>
      ) : null}
    </PanelShell>
  );
}

type FilmStage = "animatic" | "build";

/** A stage whose artifact is the film itself, with nowhere else to decide it. */
function isFilmStage(stage: StageId): stage is FilmStage {
  return stage !== "storyboard" && !REVIEW_PAGES.includes(stage);
}

function StageRow({
  stage,
  index,
  state,
  file,
  isCurrent,
  isOpen,
  onClose,
}: {
  stage: StageId;
  index: number;
  state: Process[StageId];
  file: ProjectFile;
  isCurrent: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const status = STAGE_STATUS[state.status];
  const film = isFilmStage(stage);
  // A page stage opens in the middle; a film stage opens here, under its row.
  const expanded = isOpen && film;

  return (
    <li
      className={`rounded-sm transition-[background-color] duration-140 ${
        isOpen ? "bg-sunken" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => (expanded ? onClose() : reviewStage(stage))}
        aria-current={isOpen && !film ? "true" : undefined}
        aria-expanded={film ? expanded : undefined}
        className="ds-focus flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left hover:bg-sunken"
      >
        <span className={`shrink-0 ${status.tone}`}>
          {isCurrent && state.status === "pending" ? (
            <CircleDot size={13} strokeWidth={2} aria-hidden />
          ) : (
            status.icon
          )}
        </span>
        <span className="tabular w-4 shrink-0 font-mono text-2xs text-subtle">
          {index + 1}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            state.status === "approved" ? "text-muted" : "text-ink"
          }`}
        >
          {STAGE_LABELS[stage]}
        </span>
        <span className={`shrink-0 text-xs ${status.tone}`}>
          {isCurrent && state.status === "pending" ? "Up next" : status.label}
        </span>
        <span className="shrink-0 text-subtle">
          {expanded ? (
            <ChevronDown size={13} strokeWidth={2} aria-hidden />
          ) : (
            <ChevronRight size={13} strokeWidth={2} aria-hidden />
          )}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3 px-2 pt-1 pb-3">
          <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
            {STAGE_PURPOSE[stage]}
          </p>

          {state.summary ? (
            <p className="flex items-start gap-2 text-xs leading-[var(--ds-leading-body)] text-muted">
              <Sparkles size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Agent: </span>
                {state.summary}
              </span>
            </p>
          ) : null}

          <Artifact stage={stage} process={file.process} file={file} />

          {state.note ? (
            <p className="text-xs leading-[var(--ds-leading-body)] text-warning">
              <span className="font-medium">You said: </span>
              {state.note}
            </p>
          ) : null}

          <StageDecision stage={stage} state={state} process={file.process} />
        </div>
      ) : null}
    </li>
  );
}

/** What to look at for a stage whose artifact is the film: counts and beats. */
function Artifact({
  stage,
  process,
  file,
}: {
  stage: FilmStage;
  process: Process;
  file: ProjectFile;
}) {
  switch (stage) {
    case "animatic": {
      const visual = file.tracks
        .filter((track) => track.kind === "visual")
        .reduce((n, track) => n + track.clips.length, 0);
      const audio = file.tracks
        .filter((track) => track.kind === "audio")
        .reduce((n, track) => n + track.clips.length, 0);
      const locked = process.animatic.beats;
      return (
        <div className="flex flex-col gap-1.5 text-xs leading-[var(--ds-leading-body)] text-muted">
          <p>
            The timeline is the animatic: <span className="text-ink">{visual}</span>{" "}
            visual clip{visual === 1 ? "" : "s"},{" "}
            <span className="text-ink">{audio}</span> audio.
            {audio === 0 ? (
              <span className="text-warning"> No music yet. Timing should lock to it.</span>
            ) : null}
          </p>
          {locked.length > 0 ? (
            <ol className="mt-1 flex flex-col gap-1">
              {locked.map((beat) => (
                <li key={beat.id} className="flex items-baseline gap-2 font-mono text-2xs">
                  <Lock size={10} strokeWidth={2.2} className="shrink-0 text-subtle" aria-hidden />
                  <span className="truncate text-ink">{beat.label || beat.id}</span>
                  <span className="tabular ml-auto shrink-0 text-subtle">
                    {beat.from}–{beat.from + beat.durationInFrames}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-2xs text-subtle">
              {visual === 0
                ? "Empty. Your agent lays the approved boards here with prism.lay_animatic."
                : "Approving snapshots every visual clip as a locked beat."}
            </p>
          )}
        </div>
      );
    }

    case "build": {
      const clips = clipCount(file.tracks);
      return (
        <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
          <span className="text-ink">{clips}</span> clip{clips === 1 ? "" : "s"} on the
          timeline. Watch it through before approving; approving is the sign-off.
        </p>
      );
    }
  }
}
