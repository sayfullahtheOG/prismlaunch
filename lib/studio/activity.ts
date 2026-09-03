import type { ActivityEvent, ProjectFile } from "@/types/prism";
import { STAGE_LABELS } from "./process";
import { MAX_ACTIVITY_DETAIL_LENGTH, STAGES } from "./schema";

/** Diagnostics must never reject an otherwise valid edit or review decision. */
function activityDetail(detail: string): string {
  return detail.length <= MAX_ACTIVITY_DETAIL_LENGTH
    ? detail
    : `${detail.slice(0, MAX_ACTIVITY_DETAIL_LENGTH - 1)}…`;
}

export function activityEvent(event: Omit<ActivityEvent, "id" | "at">): ActivityEvent {
  return { ...event, detail: activityDetail(event.detail), id: `ev-${crypto.randomUUID()}`, at: new Date().toISOString() };
}

/** Old builds did not save events. Recover only facts still present in the film. */
export function recoverActivity(file: ProjectFile): ActivityEvent[] {
  return STAGES.flatMap((stage) => {
    const state = file.process[stage];
    if (state.status === "pending") return [];
    return [{
      id: `recovered-${stage}`,
      origin: "disk" as const,
      label: `Recovered: ${STAGE_LABELS[stage]} ${state.status}`,
      detail: activityDetail(`Saved stage state; earlier event history was not retained.${state.note ? ` You said: ${state.note}` : state.summary ? ` ${state.summary}` : ""}`),
      at: "Time not recorded",
    }];
  });
}

export function mergeActivity(saved: ActivityEvent[], current: ActivityEvent[]): ActivityEvent[] {
  return [...new Map([...saved, ...current].map((event) => [event.id, event])).values()].slice(-200);
}
