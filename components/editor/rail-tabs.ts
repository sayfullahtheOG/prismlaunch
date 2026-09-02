import type { RailTab } from "@/lib/studio/store";

export type { RailTab };

/**
 * The sections, in rail order.
 *
 * Fewer than there were. A Layers section duplicated the timeline's own
 * header column; a Canvas section held four fields that are properties of the
 * background and now live in the inspector when its row is selected; a Folder
 * section listed compositions the title bar already lists. What is left is
 * what has no other home: the process, the storyboard, and the agent.
 */
export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "ListChecks" | "LayoutGrid" | "Sparkles";
}> = [
  { id: "process", label: "Process", icon: "ListChecks" },
  { id: "storyboard", label: "Storyboard", icon: "LayoutGrid" },
  { id: "agent", label: "Agent", icon: "Sparkles" },
];
