"use client";

import { Check } from "lucide-react";
import { ART_DIRECTION_LABELS, PALETTES } from "@/lib/studio/palettes";
import type { ArtDirection, MotionPreset } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

type Props = {
  artDirection: ArtDirection;
  onArtDirection: (value: ArtDirection) => void;
  motion: MotionPreset;
  onMotion: (value: MotionPreset) => void;
};

const DIRECTIONS = Object.keys(PALETTES) as ArtDirection[];

const MOTION: ReadonlyArray<{ id: MotionPreset; label: string; blurb: string }> = [
  { id: "drift", label: "Drift", blurb: "Slow, floating, premium" },
  { id: "snap", label: "Snap", blurb: "Fast cuts, decisive" },
  { id: "orbit", label: "Orbit", blurb: "Rotational, playful" },
];

export function LookPanel({
  artDirection,
  onArtDirection,
  motion,
  onMotion,
}: Props) {
  return (
    <PanelShell
      title="Look"
      hint="Art direction applies to the whole film. Motion is per scene."
    >
      <PanelSection label="Art direction">
        <div className="flex flex-col gap-2">
          {DIRECTIONS.map((id) => {
            const palette = PALETTES[id];
            const isActive = id === artDirection;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onArtDirection(id)}
                aria-pressed={isActive}
                className={`flex items-center gap-3 rounded-sm border p-2 text-left transition-colors ds-focus ${
                  isActive
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line"
                }`}
              >
                <span
                  className="grid aspect-video w-20 shrink-0 place-items-center gap-1 rounded-[5px] p-2"
                  style={{ background: palette.background }}
                >
                  <span
                    className="h-1 w-full rounded-pill"
                    style={{ background: palette.primary, opacity: 0.85 }}
                  />
                  <span
                    className="h-1 w-2/3 justify-self-start rounded-pill"
                    style={{ background: palette.accent }}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">
                    {ART_DIRECTION_LABELS[id]}
                  </span>
                  <span className="mt-1 flex gap-1">
                    {[palette.background, palette.primary, palette.accent].map(
                      (hex) => (
                        <span
                          key={hex}
                          className="size-3 rounded-pill ring-1 ring-line"
                          style={{ background: hex }}
                        />
                      ),
                    )}
                  </span>
                </span>

                {isActive ? (
                  <Check size={15} strokeWidth={2.4} className="text-accent" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection label="Motion preset">
        <div className="flex flex-col gap-1.5">
          {MOTION.map((preset) => {
            const isActive = preset.id === motion;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onMotion(preset.id)}
                aria-pressed={isActive}
                className={`flex items-center justify-between rounded-sm border px-3 py-2 text-left transition-colors ds-focus ${
                  isActive
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line"
                }`}
              >
                <span>
                  <span className="block text-xs font-semibold">{preset.label}</span>
                  <span className="block text-2xs text-muted">{preset.blurb}</span>
                </span>
                {isActive ? (
                  <Check size={14} strokeWidth={2.4} className="text-accent" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </PanelSection>
    </PanelShell>
  );
}
