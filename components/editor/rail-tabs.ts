/** Shared so the rail and the shell cannot disagree about the tab set. */
export type RailTab = "scenes" | "look" | "source" | "agent";

export const RAIL_TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  icon: "Clapperboard" | "Palette" | "FileCode2" | "Sparkles";
}> = [
  { id: "scenes", label: "Scenes", icon: "Clapperboard" },
  { id: "look", label: "Look", icon: "Palette" },
  { id: "source", label: "Source", icon: "FileCode2" },
  { id: "agent", label: "Agent", icon: "Sparkles" },
];
