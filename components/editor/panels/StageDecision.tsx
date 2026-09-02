"use client";

import { useState } from "react";
import { Check, Circle, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { approveStage, reopenStage, requestChanges } from "@/lib/studio/actions";
import type { Process, StageId, StageStatus } from "@/types/prism";

/**
 * The approval boundary, as buttons.
 *
 * Shared by the Process panel and by the sections that hold a stage's
 * artifact — the storyboard, the elements — so a stage is decided the same
 * way wherever it is looked at. Nothing here writes an artifact; nothing the
 * agent can call approves one.
 *
 * A submitted stage gets the two that matter. A pending one gets a quiet
 * "approve anyway" — the person may not want a brief for a ten-second
 * teaser, and skipping is theirs to do. An approved one gets reopen.
 * Sent-back gets nothing but the note: the ball is with the agent.
 */
export function StageDecision({
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
      <p className="text-2xs text-subtle">Waiting for your agent to resubmit.</p>
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

/** How a status reads and looks, everywhere a stage is shown. */
export const STAGE_STATUS: Record<
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

/** A status as a small chip: icon and word, never colour alone. */
export function StageStatusChip({ status }: { status: StageStatus }) {
  const meta = STAGE_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-semibold ${meta.tone}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}
