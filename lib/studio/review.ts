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
 * The Storyboard section of the rail is a list beside the editor, not the
 * big boards: the boards at full size are a review, and reviews open from
 * the process.
 */
export const REVIEW_PAGES: readonly StageId[] = ["brief", "concept", "script", "sound", "polish"];

export type MiddleView = "boards" | "review" | "editor" | "files";

/** The stage under review: the one the person opened, else the one the film is at. */
export function reviewedStage(openStage: StageId | null, process: Process): StageId | null {
  return openStage ?? currentStage(process);
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
  if (tab !== "process" || !reviewing) return "editor";
  const stage = reviewedStage(openStage, process);
  if (stage === "storyboard") return "boards";
  if (stage && REVIEW_PAGES.includes(stage)) return "review";
  return "editor";
}
