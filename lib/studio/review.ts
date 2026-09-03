import type { Process, ProjectFile, StageId } from "@/types/prism";
import { currentStage } from "./process";
import type { RailTab } from "./store";

/**
 * What the middle of the editor shows.
 *
 * Some stages produce a document (a brief, three directions, a script, a
 * sound plan, a checklist), and a document is reviewed at reading size, not
 * in a 300px column. Those get a page. The storyboard stage gets the boards
 * at full size. Style frames show their elements and sample frames; animatic
 * and build get a read-only screening. Editing belongs to the Editor.
 *
 * The Storyboard section of the rail is the boards at full size too: the
 * editor has a section of its own now, so nothing needs to sit beside it,
 * and a board read in a 300px column is a list, not a board. The same
 * boards open from the process when that stage is under review.
 */
export const REVIEW_PAGES: readonly StageId[] = ["brief", "concept", "script", "style", "polish"];

export type MiddleView = "boards" | "review" | "style" | "editor" | "files" | "screening";

/** The stage under review: the one the person opened, else the one the film is at. */
export function reviewedStage(openStage: StageId | null, process: Process): StageId | null {
  return openStage ?? currentStage(process);
}

/**
 * The section a freshly opened film lands on.
 *
 * Until the animatic, the work is reviewed as documents and style samples: the agent submits and the
 * person reads and decides, so the Process is the place. From the animatic
 * on, the artifact is the film itself, so the Editor is. All approved is
 * the editor too: the film is the thing to look at.
 */
export function openingTab(process: Process): RailTab {
  const stage = currentStage(process);
  if (stage && ["brief", "concept", "script", "storyboard", "style"].includes(stage)) return "process";
  return "editor";
}

export function middleView(
  tab: RailTab,
  openStage: StageId | null,
  process: Process,
): MiddleView {
  // The Files section shows a file; the Editor section is the film alone;
  // every other section sits beside the film.
  if (tab === "files") return "files";
  if (tab === "storyboard") return "boards";
  if (tab !== "process") return "editor";
  const stage = reviewedStage(openStage, process);
  if (stage === "storyboard") return "boards";
  // An animatic is judged by watching it, so its review is a screening:
  // the film large with a transport, and no layer panel in the way.
  if (stage === "style") return "style";
  if (stage === "animatic" || stage === "build" || stage === null) return "screening";
  if (stage && REVIEW_PAGES.includes(stage)) return "review";
  return "editor";
}

/** Follow new style work from the approved boards, without stealing an explicit editor view. */
export function shouldFollowStyleWork(
  previous: ProjectFile,
  next: ProjectFile,
  tab: RailTab,
  openStage: StageId | null,
): boolean {
  const watchingBoards = tab === "storyboard" ||
    (tab === "process" && reviewedStage(openStage, previous.process) === "storyboard");
  if (!watchingBoards || currentStage(next.process) !== "style") return false;
  // Compare content rather than identity: validation clones unchanged objects.
  return JSON.stringify(previous.elements) !== JSON.stringify(next.elements) ||
    JSON.stringify(previous.tracks.filter((track) => track.kind === "visual").flatMap((track) => track.clips)) !==
    JSON.stringify(next.tracks.filter((track) => track.kind === "visual").flatMap((track) => track.clips));
}
