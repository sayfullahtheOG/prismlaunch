"use client";

import { Clapperboard, FolderOpen, Palette, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { RailTab } from "./rail-tabs";
import { RAIL_TABS } from "./rail-tabs";

const ICONS = { Clapperboard, Palette, FolderOpen, Sparkles } as const;

type Props = {
  active: RailTab;
  onChange: (tab: RailTab) => void;
  /** Something needs a human decision. Marked by shape AND colour. */
  agentPending?: boolean;
  /**
   * Sections that have nothing to show yet. Kept visible rather than hidden —
   * a rail that changes length as the film comes into existence would make the
   * tool look like it grew new features, when it only gained content.
   */
  unavailable?: ReadonlySet<RailTab>;
  /** Why the unavailable sections are unavailable. Shown as their tooltip. */
  unavailableReason?: string;
};

/**
 * The section rail.
 *
 * Navigation sits at the top; the theme control sits in the footer behind a
 * rule. That separation is semantic rather than decorative — the toggle is not
 * a destination, so it stays outside the `<nav>` landmark instead of becoming a
 * fifth thing to skip past when looking for sections.
 */
export function IconRail({
  active,
  onChange,
  agentPending = false,
  unavailable,
  unavailableReason,
}: Props) {
  return (
    <div className="flex w-[76px] shrink-0 flex-col border-r border-line-soft bg-surface">
      <nav
        aria-label="Editor sections"
        className="flex flex-1 flex-col items-center gap-1 py-3"
      >
        {RAIL_TABS.map(({ id, label, icon }) => {
          const Icon = ICONS[icon];
          const selected = id === active;
          const off = unavailable?.has(id) ?? false;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              disabled={off}
              {...(off && unavailableReason ? { title: unavailableReason } : {})}
              aria-current={selected ? "page" : undefined}
              className={`ds-focus relative flex min-h-14 w-16 flex-col items-center justify-center gap-1.5 rounded-sm transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] ${
                off
                  ? "cursor-not-allowed font-medium text-faint"
                  : selected
                    ? "ds-inset bg-sunken font-semibold text-accent"
                    : "font-medium text-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              <Icon size={19} strokeWidth={selected && !off ? 2 : 1.6} aria-hidden />
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

      <div className="flex items-center justify-center border-t border-line-soft py-3">
        <ThemeToggle />
      </div>
    </div>
  );
}
