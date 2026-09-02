/** Shared so the rail and the shell cannot disagree about the tab set. */
export type RailTab = "process" | "layers" | "canvas" | "folder" | "agent";

export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "ListChecks" | "Layers" | "Frame" | "FolderOpen" | "Sparkles";
}> = [
  { id: "process", label: "Process", icon: "ListChecks" },
  { id: "layers", label: "Layers", icon: "Layers" },
  { id: "canvas", label: "Canvas", icon: "Frame" },
  { id: "folder", label: "Folder", icon: "FolderOpen" },
  { id: "agent", label: "Agent", icon: "Sparkles" },
];
