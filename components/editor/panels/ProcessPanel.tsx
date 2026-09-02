"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Lock,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { approveStage, reopenStage, requestChanges } from "@/lib/studio/actions";
import {
  currentStage,
  STAGE_LABELS,
  STAGE_PURPOSE,
  timingLocked,
} from "@/lib/studio/process";
import { STAGES } from "@/lib/studio/schema";
import { clipCount, draftCount } from "@/lib/studio/timing";
import type { Process, ProjectFile, StageId, StageStatus } from "@/types/prism";
import { PanelShell } from "./PanelShell";

/**
 * The pipeline, as a place.
 *
 * Eight stages down the side. The agent submits into one; the person reads
 * what arrived and either approves it or sends it back with a note. Nothing
 * here writes an artifact — that is the agent's job — and nothing the agent can
 * call approves one. The two buttons on a submitted stage are the whole
 * approval boundary, made visible.
 *
 * The current stage is open; the rest are one line each. A person should be
 * able to see at a glance where the film is and what is waiting on them.
 */
export function ProcessPanel({ file }: { file: ProjectFile }) {
  const process = file.process;
  const current = currentStage(process);
  const [open, setOpen] = useState<StageId | null>(null);

  // The current stage opens by default; clicking another opens that instead.
  const expanded = open ?? current;

  return (
    <PanelShell
      title="Process"
      hint="Your agent submits each stage. You approve it, or send it back with a note."
    >
      <ol className="flex flex-col gap-1">
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
        <p className="ds-level mt-4 flex items-start gap-2.5 rounded-sm bg-success-soft p-3 text-xs leading-[var(--ds-leading-body)] text-success">
          <Check size={14} strokeWidth={2.4} className="mt-px shrink-0" aria-hidden />
          Every stage is approved. Export is the last step.
        </p>
      ) : null}

      {timingLocked(process) ? (
        <p className="ds-level mt-4 flex items-start gap-2.5 rounded-sm p-3 text-xs leading-[var(--ds-leading-body)] text-muted">
          <Lock size={13} strokeWidth={2} className="mt-px shrink-0 text-subtle" aria-hidden />
          Timing is locked across {process.animatic.beats.length} beats. Your
          agent can only build inside them. Reopen the animatic to change the
          cut.
        </p>
      ) : null}
    </PanelShell>
  );
}

const STATUS: Record<
  StageStatus,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Not started",
    tone: "text-subtle",
    icon: <Circle size={13} strokeWidth={1.8} aria-hidden />,
  },
  submitted: {
    label: "Waiting for you",
    tone: "text-warning",
    icon: <Sparkles size={13} strokeWidth={2.2} aria-hidden />,
  },
  "changes-requested": {
    label: "Sent back",
    tone: "text-muted",
    icon: <Undo2 size={13} strokeWidth={2} aria-hidden />,
  },
  approved: {
    label: "Approved",
    tone: "text-success",
    icon: <Check size={13} strokeWidth={2.6} aria-hidden />,
  },
};

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
  const status = STATUS[state.status];

  return (
    <li
      className={`rounded-sm transition-[background-color,box-shadow] duration-140 ${
        isOpen ? "ds-inset bg-sunken" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="ds-focus flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left"
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
          className={`min-w-0 flex-1 truncate text-xs font-semibold ${
            state.status === "approved" ? "text-muted" : "text-ink"
          }`}
        >
          {STAGE_LABELS[stage]}
        </span>
        <span className={`shrink-0 text-2xs ${status.tone}`}>
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
        <div className="flex flex-col gap-3 px-2.5 pt-1 pb-3">
          <p className="text-2xs leading-[var(--ds-leading-body)] text-subtle">
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
            <p className="ds-level rounded-sm bg-warning-soft p-2.5 text-xs leading-[var(--ds-leading-body)] text-warning">
              <span className="font-semibold">You said: </span>
              {state.note}
            </p>
          ) : null}

          <Decision stage={stage} state={state} process={file.process} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The buttons, by status.
 *
 * A submitted stage gets the two that matter. A pending one gets a quiet
 * "approve anyway" — the person may not want a brief for a ten-second teaser,
 * and skipping is theirs to do. An approved one gets reopen. Sent-back gets
 * nothing but the note: the ball is with the agent.
 */
function Decision({
  stage,
  state,
  process,
}: {
  stage: StageId;
  state: Process[StageId];
  process: Process;
}) {
  const [note, setNote] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);

  if (state.status === "approved") {
    return (
      <Button
        variant="quiet"
        onClick={() => reopenStage(stage)}
        icon={<RotateCcw size={13} strokeWidth={2} aria-hidden />}
      >
        {stage === "animatic" ? "Reopen and unlock timing" : "Reopen"}
      </Button>
    );
  }

  if (state.status === "changes-requested") {
    return (
      <p className="text-2xs text-subtle">
        Waiting for your agent to resubmit.
      </p>
    );
  }

  if (state.status === "pending") {
    return (
      <Button variant="quiet" onClick={() => approveStage(stage)}>
        Skip — approve as is
      </Button>
    );
  }

  // Submitted: the whole approval boundary, in two buttons.
  const pick =
    stage === "concept" ? (chosen ?? process.concept.recommended) : undefined;

  return (
    <div className="flex flex-col gap-2">
      {stage === "concept" && process.concept.directions.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
            Go with
          </legend>
          {process.concept.directions.map((direction) => (
            <label
              key={direction.id}
              className="flex cursor-pointer items-center gap-2 text-xs text-ink"
            >
              <input
                type="radio"
                name="chosen-direction"
                value={direction.id}
                checked={pick === direction.id}
                onChange={() => setChosen(direction.id)}
                className="accent-accent"
              />
              {direction.title}
            </label>
          ))}
        </fieldset>
      ) : null}

      <TextArea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What should change? Your agent reads this."
        rows={2}
        aria-label="Feedback for your agent"
      />

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => approveStage(stage, pick ? { chosen: pick } : {})}
          icon={<Check size={14} strokeWidth={2.4} aria-hidden />}
        >
          {stage === "animatic" ? "Approve and lock timing" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={note.trim().length === 0}
          onClick={() => {
            requestChanges(stage, note);
            setNote("");
          }}
          icon={<Undo2 size={14} strokeWidth={2.2} aria-hidden />}
        >
          Send back
        </Button>
      </div>
    </div>
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
        </dl>
      );
    }

    case "concept": {
      const c = process.concept;
      if (c.directions.length === 0) return <Empty />;
      return (
        <ol className="flex flex-col gap-2">
          {c.directions.map((direction) => {
            const recommended = direction.id === c.recommended;
            const chosen = direction.id === c.chosen;
            return (
              <li
                key={direction.id}
                className={`rounded-sm p-2.5 ${
                  chosen || (recommended && !c.chosen)
                    ? "ds-raised bg-raised"
                    : "ds-inset bg-sunken"
                }`}
              >
                <p className="flex items-center gap-2 text-xs font-semibold text-ink">
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
          <ol className="flex flex-col gap-1.5">
            {s.beats.map((beat, index) => (
              <li key={beat.id} className="ds-inset rounded-sm bg-sunken p-2.5">
                <p className="flex items-baseline gap-2">
                  <span className="tabular font-mono text-2xs text-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-2xs font-semibold text-muted">{beat.label}</span>
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
              <span className="text-warning"> No music yet — timing should lock to it.</span>
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
              Approving snapshots every visual clip as a locked beat.
            </p>
          )}
        </div>
      );
    }

    case "style": {
      const st = process.style;
      if (!st.look && st.clipIds.length === 0) return <Empty />;
      return (
        <dl className="flex flex-col gap-1.5">
          <Row label="Look" value={st.look} strong />
          <Row
            label="Built for real"
            value={st.clipIds.length > 0 ? st.clipIds.join(", ") : undefined}
            mono
          />
        </dl>
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
              , <span className="text-warning">{drafts} still unreviewed</span> —
              accept them in the timeline before approving the build.
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
        <pre className="thin-scroll ds-inset max-h-48 overflow-auto rounded-sm bg-sunken p-2.5 font-mono text-2xs leading-[var(--ds-leading-body)] whitespace-pre-wrap text-muted">
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
      <dt className="text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
        {label}
      </dt>
      <dd
        className={`text-xs leading-[var(--ds-leading-body)] ${
          strong ? "font-semibold text-ink" : "text-muted"
        } ${mono ? "font-mono text-2xs break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-2xs text-subtle">Nothing submitted yet.</p>
  );
}
