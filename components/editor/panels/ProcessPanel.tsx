"use client";

import { CircleDot } from "lucide-react";
import { reviewStage } from "@/lib/studio/actions";
import { currentStage, STAGE_LABELS } from "@/lib/studio/process";
import { STAGES } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";
import { PanelShell } from "./PanelShell";
import { STAGE_STATUS } from "./StageDecision";

/** Stage navigation only. Review content and decisions belong beside the artifact. */
export function ProcessPanel({ file }: { file: ProjectFile }) {
  const current = currentStage(file.process);
  const open = useStudioStore((state) => state.openStage);
  const reviewing = open ?? current;

  return (
    <PanelShell title="Process">
      <ol className="flex flex-col gap-0.5">
        {STAGES.map((stage, index) => {
          const state = file.process[stage];
          const status = STAGE_STATUS[state.status];
          const upNext = stage === current && state.status === "pending";

          return (
            <li key={stage}>
              <button
                type="button"
                onClick={() => reviewStage(stage)}
                aria-current={stage === reviewing ? "step" : undefined}
                className={`ds-focus flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-left hover:bg-sunken ${stage === reviewing ? "bg-sunken" : ""}`}
              >
                <span className={`shrink-0 ${status.tone}`}>
                  {upNext ? <CircleDot size={13} strokeWidth={2} aria-hidden /> : status.icon}
                </span>
                <span className="tabular w-4 shrink-0 font-mono text-2xs text-subtle">
                  {index + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${state.status === "approved" ? "text-muted" : "text-ink"}`}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className={`shrink-0 text-xs ${status.tone}`}>
                  {upNext ? "Up next" : status.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </PanelShell>
  );
}
