import type { ActivityEvent, ProjectFile } from "@/types/prism";
import { STAGE_LABELS } from "./process";
import { STAGES } from "./schema";

export function activityEvent(event: Omit<ActivityEvent, "id" | "at">): ActivityEvent {
  return { ...event, id: `ev-${crypto.randomUUID()}`, at: new Date().toISOString() };
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
      detail: `Saved stage state; earlier event history was not retained.${state.note ? ` You said: ${state.note}` : state.summary ? ` ${state.summary}` : ""}`.slice(0, 240),
      at: "Time not recorded",
    }];
  });
}

export function mergeActivity(saved: ActivityEvent[], current: ActivityEvent[]): ActivityEvent[] {
  return [...new Map([...saved, ...current].map((event) => [event.id, event])).values()].slice(-200);
}
