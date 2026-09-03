import type { Process, StageId } from "@/types/prism";
import { currentStage } from "./process";
import type { RailTab } from "./store";

/**
 * What the middle of the editor shows.
 *
 * Some stages produce a document (a brief, three directions, a script, a
 * sound plan, a checklist), and a document is reviewed at reading size, not
 * in a 300px column. Those get a page. The storyboard stage gets the boards
 * at full size. The rest (animatic, style frames, build) are the canvas and
 * the timeline, so reviewing them is looking at the editor.
 *
 * The Storyboard section of the rail is the boards at full size too: the
 * editor has a section of its own now, so nothing needs to sit beside it,
 * and a board read in a 300px column is a list, not a board. The same
 * boards open from the process when that stage is under review.
 */
export const REVIEW_PAGES: readonly StageId[] = ["brief", "concept", "script", "sound", "polish"];

export type MiddleView = "boards" | "review" | "editor" | "files" | "screening";

/** The stage under review: the one the person opened, else the one the film is at. */
export function reviewedStage(openStage: StageId | null, process: Process): StageId | null {
  return openStage ?? currentStage(process);
}

/**
 * The section a freshly opened film lands on.
 *
 * Until the animatic, the work is documents: the agent submits and the
 * person reads and decides, so the Process is the place. From the animatic
 * on, the artifact is the film itself, so the Editor is. All approved is
 * the editor too: the film is the thing to look at.
 */
export function openingTab(process: Process): RailTab {
  const stage = currentStage(process);
  if (stage && ["brief", "concept", "script", "storyboard"].includes(stage)) return "process";
  return "editor";
}

export function middleView(
  tab: RailTab,
  openStage: StageId | null,
  process: Process,
  reviewing = true,
): MiddleView {
  // The Files section shows a file; the Editor section is the film alone;
  // every other section sits beside the film.
  if (tab === "files") return "files";
  if (tab === "storyboard") return "boards";
  if (tab !== "process" || !reviewing) return "editor";
  const stage = reviewedStage(openStage, process);
  if (stage === "storyboard") return "boards";
  // An animatic is judged by watching it, so its review is a screening:
  // the film large with a transport, and no layer panel in the way.
  if (stage === "animatic") return "screening";
  if (stage && REVIEW_PAGES.includes(stage)) return "review";
  return "editor";
}
