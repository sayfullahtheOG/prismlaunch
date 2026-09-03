"use client";

import { memo } from "react";
import { STAGE_LABELS } from "@/lib/studio/process";
import type { Process } from "@/types/prism";
import { StageDecision, StageStatusChip } from "./panels/StageDecision";

/** Keep review controls out of navigation and independent of the playback clock. */
export const ScreeningDecision = memo(function ScreeningDecision({
  stage,
  process,
}: {
  stage: "animatic" | "build";
  process: Process;
}) {
  const state = process[stage];

  return (
    <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-line-soft bg-surface px-6 py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink">{STAGE_LABELS[stage]}</h2>
          <StageStatusChip status={state.status} />
        </div>
        {state.note ? (
          <details className="text-xs text-muted">
            <summary className="ds-focus cursor-pointer rounded-sm">Your feedback</summary>
            <p className="mt-2 whitespace-pre-wrap break-words leading-[var(--ds-leading-body)]">{state.note}</p>
          </details>
        ) : null}
        <StageDecision key={stage} stage={stage} state={state} process={process} />
      </div>
    </div>
  );
});
