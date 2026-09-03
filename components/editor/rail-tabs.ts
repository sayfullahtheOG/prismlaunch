import type { RailTab } from "@/lib/studio/store";

export type { RailTab };

/**
 * The sections, in rail order.
 *
 * The editor comes first: the film alone, canvas and timeline, with no
 * column beside it, which is where the pages and the boards come back to.
 * The rest are each a place to look at one kind of thing beside the film:
 * the process and its decisions, the boards, the elements the film is
 * built from, then the studio's own pieces by kind rather than one library
 * with a filter, since a person looking for a sound is not looking for a
 * headline: type, shapes, motion, audio. Then the files in the folder, and
 * the record of what the agent did.
 */
export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon:
    | "Clapperboard"
    | "ListChecks"
    | "LayoutGrid"
    | "Blocks"
    | "Type"
    | "Shapes"
    | "MousePointerClick"
    | "AudioLines"
    | "FolderTree"
    | "History";
}> = [
  { id: "editor", label: "Editor", icon: "Clapperboard" },
  { id: "process", label: "Process", icon: "ListChecks" },
  { id: "storyboard", label: "Storyboard", icon: "LayoutGrid" },
  { id: "elements", label: "Elements", icon: "Blocks" },
  { id: "text", label: "Text", icon: "Type" },
  { id: "shapes", label: "Shapes", icon: "Shapes" },
  { id: "motion", label: "Motion", icon: "MousePointerClick" },
  { id: "audio", label: "Audio", icon: "AudioLines" },
  { id: "files", label: "Files", icon: "FolderTree" },
  { id: "agent", label: "Activity", icon: "History" },
];
