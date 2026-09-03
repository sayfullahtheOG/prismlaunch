import type { RailTab } from "@/lib/studio/store";

export type { RailTab };

/**
 * The sections, in rail order.
 *
 * The editor comes first: the film alone, canvas and timeline, with no
 * column beside it, which is where the pages and the boards come back to.
 * The rest are each a place to look at one kind of thing beside the film:
 * the process and its decisions, the boards, the elements the film is
 * built from, the library of pieces that can become elements, the files
 * in the folder, and the record of what the agent did.
 */
export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "Clapperboard" | "ListChecks" | "LayoutGrid" | "Shapes" | "Blocks" | "FolderTree" | "History";
}> = [
  { id: "editor", label: "Editor", icon: "Clapperboard" },
  { id: "process", label: "Process", icon: "ListChecks" },
  { id: "storyboard", label: "Storyboard", icon: "LayoutGrid" },
  { id: "elements", label: "Elements", icon: "Shapes" },
  { id: "library", label: "Library", icon: "Blocks" },
  { id: "files", label: "Files", icon: "FolderTree" },
  { id: "agent", label: "Activity", icon: "History" },
];
