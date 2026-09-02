/** Shared so the rail and the shell cannot disagree about the tab set. */
export type RailTab = "layers" | "canvas" | "folder" | "agent";

export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "Layers" | "Frame" | "FolderOpen" | "Sparkles";
}> = [
  { id: "layers", label: "Layers", icon: "Layers" },
  { id: "canvas", label: "Canvas", icon: "Frame" },
  { id: "folder", label: "Folder", icon: "FolderOpen" },
  { id: "agent", label: "Agent", icon: "Sparkles" },
];
