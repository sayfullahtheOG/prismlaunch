"use client";

import { Clapperboard, Palette, FileCode2, Sparkles } from "lucide-react";
import type { RailTab } from "./rail-tabs";
import { RAIL_TABS } from "./rail-tabs";

const ICONS = { Clapperboard, Palette, FileCode2, Sparkles } as const;

type Props = {
  active: RailTab;
  onChange: (tab: RailTab) => void;
  /** Something needs a human decision. Marked by shape AND colour. */
  agentPending?: boolean;
};

/**
 * Section rail.
 *
 * Current selection carries both structural depth (inset well) and text/icon
 * state, per the app-shell rule that navigation must show more than one signal.
 */
export function IconRail({ active, onChange, agentPending = false }: Props) {
  return (
    <nav
      aria-label="Editor sections"
      className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line-soft bg-surface py-3"
    >
      {RAIL_TABS.map(({ id, label, icon }) => {
        const Icon = ICONS[icon];
        const selected = id === active;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={selected ? "page" : undefined}
            className={`ds-focus relative flex min-h-14 w-16 flex-col items-center justify-center gap-1.5 rounded-sm transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
              selected
                ? "ds-inset bg-sunken font-semibold text-accent"
                : "font-medium text-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            <Icon size={19} strokeWidth={selected ? 2 : 1.6} aria-hidden />
            <span className="text-2xs leading-none">{label}</span>

            {id === "agent" && agentPending ? (
              <span
                className="absolute top-2 right-3 size-2 rounded-pill bg-warning ring-2 ring-surface"
                aria-label="Waiting for your decision"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
