/** Shared so the rail and the shell cannot disagree about the tab set. */
export type RailTab = "scenes" | "look" | "folder" | "agent";

export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "Clapperboard" | "Palette" | "FolderOpen" | "Sparkles";
}> = [
  { id: "scenes", label: "Scenes", icon: "Clapperboard" },
  { id: "look", label: "Look", icon: "Palette" },
  { id: "folder", label: "Folder", icon: "FolderOpen" },
  { id: "agent", label: "Agent", icon: "Sparkles" },
];
