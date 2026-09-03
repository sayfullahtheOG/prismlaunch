import type { RailTab } from "@/lib/studio/store";

export type { RailTab };

/**
 * The sections, in rail order.
 *
 * Each is a place to look at one kind of thing: the process and its
 * decisions, the boards, the elements the film is built from, the library
 * of pieces that can become elements, and the record of what the agent did.
 * Nothing here duplicates the editor; the timeline has its own layer
 * column, the inspector has the properties, the title bar has the
 * compositions.
 */
export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "ListChecks" | "LayoutGrid" | "Shapes" | "Blocks" | "Activity";
}> = [
  { id: "process", label: "Process", icon: "ListChecks" },
  { id: "storyboard", label: "Storyboard", icon: "LayoutGrid" },
  { id: "elements", label: "Elements", icon: "Shapes" },
  { id: "library", label: "Library", icon: "Blocks" },
  { id: "agent", label: "Activity", icon: "Activity" },
];
