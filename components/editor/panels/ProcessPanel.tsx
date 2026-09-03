"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  LayoutGrid,
  Lock,
  Shapes,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showTab } from "@/lib/studio/actions";
import {
  currentStage,
  STAGE_LABELS,
  STAGE_PURPOSE,
  timingLocked,
} from "@/lib/studio/process";
import { STAGES } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";
import { clipCount, draftCount } from "@/lib/studio/timing";
import type { Process, ProjectFile, StageId } from "@/types/prism";
import { PanelShell } from "./PanelShell";
import { STAGE_STATUS, StageDecision } from "./StageDecision";

/**
 * The pipeline, as a place.
 *
 * Nine stages down the side. The agent submits into one; the person reads
 * what arrived and either approves it or sends it back with a note. Nothing
 * here writes an artifact — that is the agent's job — and nothing the agent can
 * call approves one. The two buttons on a submitted stage are the whole
 * approval boundary, made visible.
 *
 * Artifacts that fit a column are shown in it: the brief, the concepts, the
 * script, the sound plan, the checklist. Ones that need the screen — the
 * storyboard — are summarised here and opened in their own section.
 *
 * The current stage is open; the rest are one line each. A person should be
 * able to see at a glance where the film is and what is waiting on them.
 */
export function ProcessPanel({ file }: { file: ProjectFile }) {
  const process = file.process;
  const current = currentStage(process);
  const open = useStudioStore((state) => state.openStage);
  const setOpen = useStudioStore((state) => state.setOpenStage);

  // The current stage opens by default; clicking another opens that instead.
  // The middle of the editor follows the same choice.
  const expanded = open ?? current;

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
            isOpen={stage === expanded}
            onToggle={() => setOpen(stage === expanded ? null : stage)}
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

function StageRow({
  stage,
  index,
  state,
  file,
  isCurrent,
  isOpen,
  onToggle,
}: {
  stage: StageId;
  index: number;
  state: Process[StageId];
  file: ProjectFile;
  isCurrent: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const status = STAGE_STATUS[state.status];

  return (
    <li
      className={`rounded-sm transition-[background-color] duration-140 ${
        isOpen ? "bg-sunken" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
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
          {isOpen ? (
            <ChevronDown size={13} strokeWidth={2} aria-hidden />
          ) : (
            <ChevronRight size={13} strokeWidth={2} aria-hidden />
          )}
        </span>
      </button>

      {isOpen ? (
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

/** What the agent submitted, rendered per stage. */
function Artifact({
  stage,
  process,
  file,
}: {
  stage: StageId;
  process: Process;
  file: ProjectFile;
}) {
  switch (stage) {
    case "brief": {
      const b = process.brief;
      if (!b.audience && !b.message) return <Empty />;
      return (
        <dl className="flex flex-col gap-1.5">
          <Row label="Audience" value={b.audience} />
          <Row label="Message" value={b.message} strong />
          <Row label="Feeling" value={b.feeling} />
          <Row label="Length" value={b.lengthSeconds ? `${b.lengthSeconds}s` : undefined} />
          <Row label="The truth" value={b.truth} />
          <Row label="Demo moment" value={b.demoMoment} />
        </dl>
      );
    }

    case "concept": {
      const c = process.concept;
      if (c.directions.length === 0) return <Empty />;
      return (
        <ol className="flex flex-col divide-y divide-line-soft">
          {c.directions.map((direction) => {
            const recommended = direction.id === c.recommended;
            const chosen = direction.id === c.chosen;
            return (
              <li key={direction.id} className="py-2 first:pt-0 last:pb-0">
                <p className="flex items-center gap-2 text-xs font-medium text-ink">
                  {direction.title}
                  {chosen ? (
                    <span className="text-2xs font-semibold text-success">chosen</span>
                  ) : recommended ? (
                    <span className="text-2xs font-semibold text-accent">recommended</span>
                  ) : null}
                  {direction.score !== undefined ? (
                    <span className="tabular ml-auto font-mono text-2xs text-subtle">
                      {direction.score}/12
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs leading-[var(--ds-leading-body)] text-muted">
                  {direction.line}
                </p>
                {direction.angle || direction.feel ? (
                  <p className="mt-1 font-mono text-2xs text-subtle">
                    {[direction.angle, direction.feel].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      );
    }

    case "script": {
      const s = process.script;
      if (s.beats.length === 0) return <Empty />;
      const total = s.beats.reduce((n, beat) => n + beat.seconds, 0);
      return (
        <div className="flex flex-col gap-2">
          <ol className="flex flex-col divide-y divide-line-soft">
            {s.beats.map((beat, index) => (
              <li key={beat.id} className="py-2 first:pt-0 last:pb-0">
                <p className="flex items-baseline gap-2">
                  <span className="tabular font-mono text-2xs text-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-medium text-muted">{beat.label}</span>
                  <span className="tabular ml-auto font-mono text-2xs text-subtle">
                    {beat.seconds.toFixed(1)}s
                  </span>
                </p>
                {beat.words ? (
                  <p className="mt-1 text-xs leading-[var(--ds-leading-body)] text-ink">
                    {beat.words}
                  </p>
                ) : null}
                {beat.sound ? (
                  <p className="mt-1 text-2xs text-subtle">♪ {beat.sound}</p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="tabular font-mono text-2xs text-subtle">
            {s.beats.length} beats · {total.toFixed(1)}s
            {process.brief.lengthSeconds
              ? ` of ${process.brief.lengthSeconds}s`
              : ""}
          </p>
          {s.voiceover ? (
            <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
              <span className="font-semibold text-ink">VO: </span>
              {s.voiceover}
            </p>
          ) : null}
        </div>
      );
    }

    case "storyboard": {
      const panels = process.storyboard.panels;
      if (panels.length === 0) return <Empty />;
      const total = panels.reduce((n, panel) => n + panel.durationInFrames, 0);
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
            <span className="text-ink">{panels.length}</span> panels ·{" "}
            <span className="tabular font-mono text-2xs">
              {(total / file.fps).toFixed(1)}s
              {process.brief.lengthSeconds ? ` of ${process.brief.lengthSeconds}s` : ""}
            </span>
          </p>
          <Button
            variant="secondary"
            onClick={() => showTab("storyboard")}
            icon={<LayoutGrid size={14} strokeWidth={1.9} aria-hidden />}
          >
            Open the boards
          </Button>
        </div>
      );
    }

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

    case "style": {
      const st = process.style;
      const defined = file.elements.length;
      if (!st.look && st.clipIds.length === 0 && defined === 0) return <Empty />;
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
            {st.look ? (
              <>
                The <span className="font-semibold text-ink capitalize">{st.look}</span> look ·{" "}
              </>
            ) : null}
            <span className="text-ink">{defined}</span> element{defined === 1 ? "" : "s"} ·{" "}
            <span className="text-ink">{st.clipIds.length}</span> frame
            {st.clipIds.length === 1 ? "" : "s"} built for real
          </p>
          <Button
            variant="secondary"
            onClick={() => showTab("elements")}
            icon={<Shapes size={14} strokeWidth={1.9} aria-hidden />}
          >
            Open the elements
          </Button>
        </div>
      );
    }

    case "build": {
      const clips = clipCount(file.tracks);
      const drafts = draftCount(file.tracks);
      return (
        <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
          <span className="text-ink">{clips}</span> clips on the timeline
          {drafts > 0 ? (
            <>
              , <span className="text-warning">{drafts} still unreviewed</span>.
              Accept them in the timeline before approving the build.
            </>
          ) : (
            ", all accepted."
          )}
        </p>
      );
    }

    case "sound": {
      const so = process.sound;
      if (!so.plan) return <Empty />;
      return (
        <pre className="thin-scroll max-h-48 overflow-auto font-mono text-2xs leading-[var(--ds-leading-body)] whitespace-pre-wrap text-muted">
          {so.plan}
        </pre>
      );
    }

    case "polish": {
      const po = process.polish;
      if (po.checklist.length === 0) return <Empty />;
      return (
        <ul className="flex flex-col gap-1">
          {po.checklist.map((line, index) => (
            <li
              key={index}
              className={`text-2xs leading-[var(--ds-leading-body)] ${
                /^[✗x✕]/i.test(line.trim()) ? "text-warning" : "text-muted"
              }`}
            >
              {line}
            </li>
          ))}
        </ul>
      );
    }
  }
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string | undefined;
  strong?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-medium text-subtle">{label}</dt>
      <dd
        className={`text-xs leading-[var(--ds-leading-body)] ${
          strong ? "font-medium text-ink" : "text-muted"
        } ${mono ? "font-mono text-2xs break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-xs text-subtle">Nothing submitted yet.</p>
  );
}
