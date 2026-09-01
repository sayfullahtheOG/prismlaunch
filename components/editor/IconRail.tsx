"use client";

import { Clapperboard, Palette, FileCode2, Sparkles } from "lucide-react";

export type RailTab = "scenes" | "look" | "source" | "agent";

const TABS: ReadonlyArray<{
  id: RailTab;
  label: string;
  Icon: typeof Clapperboard;
}> = [
  { id: "scenes", label: "Scenes", Icon: Clapperboard },
  { id: "look", label: "Look", Icon: Palette },
  { id: "source", label: "Source", Icon: FileCode2 },
  { id: "agent", label: "Agent", Icon: Sparkles },
];

type Props = {
  active: RailTab;
  onChange: (tab: RailTab) => void;
  /** Shows a dot on the Agent tab while something needs a human decision. */
  agentPending?: boolean;
};

export function IconRail({ active, onChange, agentPending = false }: Props) {
  return (
    <nav
      aria-label="Editor sections"
      className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex w-14 flex-col items-center gap-1.5 rounded-card py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              isActive
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            <Icon size={20} strokeWidth={1.6} aria-hidden />
            <span className="text-[10.5px] leading-none font-medium">{label}</span>

            {id === "agent" && agentPending ? (
              <span
                aria-hidden
                className="absolute top-2 right-3 size-2 rounded-full bg-draft ring-2 ring-surface"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
