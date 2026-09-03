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
  const [error, setError] = useState<string | null>(null);

  if (state.status === "approved") {
    return (
      <Button
        variant="quiet"
        size="sm"
        className="self-start"
        onClick={() => reopenStage(stage)}
        icon={<RotateCcw size={12} strokeWidth={2} aria-hidden />}
      >
        {stage === "animatic" ? "Reopen and unlock timing" : "Reopen"}
      </Button>
    );
  }

  if (state.status === "changes-requested") {
    return (
      <p className="text-xs text-subtle">Waiting for your agent to resubmit.</p>
    );
  }

  if (state.status === "pending") {
    return (
      <Button variant="quiet" size="sm" className="self-start" onClick={() => approveStage(stage)}>
        Approve as is
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
          <legend className="mb-1 text-xs font-medium text-muted">Go with</legend>
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
        onChange={(event) => {
          setNote(event.target.value);
          setError(null);
        }}
        placeholder="Add a note with approval, or say what should change."
        rows={2}
        maxLength={600}
        aria-label="Feedback for your agent"
      />
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}

      <div className="flex gap-1.5">
        <Button
          variant="primary"
          onClick={() => {
            const result = approveStage(stage, { ...(pick ? { chosen: pick } : {}), note });
            if (!result.ok) setError(result.message);
            else {
              setNote("");
              setError(null);
            }
          }}
          icon={<Check size={13} strokeWidth={2.4} aria-hidden />}
        >
          {stage === "animatic" ? "Approve and lock timing" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          disabled={note.trim().length === 0}
          onClick={() => {
            const result = requestChanges(stage, note);
            if (!result.ok) setError(result.message);
            else {
              setNote("");
              setError(null);
            }
          }}
          icon={<Undo2 size={13} strokeWidth={2.2} aria-hidden />}
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
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.tone}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}
