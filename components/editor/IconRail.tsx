"use client";

import { ListChecks, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { RailTab } from "./rail-tabs";
import { RAIL_TABS } from "./rail-tabs";

const ICONS = { ListChecks, Sparkles } as const;

type Props = {
  active: RailTab;
  onChange: (tab: RailTab) => void;
  /** Something needs a human decision. Marked by shape AND colour. */
  agentPending?: boolean;
};

/**
 * The section rail.
 *
 * Navigation sits at the top; the theme control sits in the footer behind a
 * rule. That separation is semantic rather than decorative — the toggle is not
 * a destination, so it stays outside the `<nav>` landmark instead of becoming
 * one more thing to skip past when looking for sections.
 */
export function IconRail({ active, onChange, agentPending = false }: Props) {
  return (
    <div className="flex w-[76px] shrink-0 flex-col border-r border-line-soft bg-surface">
      <nav
        aria-label="Editor sections"
        className="flex flex-1 flex-col items-center gap-1 py-3"
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

              {(id === "agent" || id === "process") && agentPending ? (
                <span
                  className="absolute top-2 right-3 size-2 rounded-pill bg-warning ring-2 ring-surface"
                  aria-label="Waiting for your decision"
                />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-center border-t border-line-soft py-3">
        <ThemeToggle />
      </div>
    </div>
  );
}
