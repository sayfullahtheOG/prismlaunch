import type { ArtDirection, Palette } from "@/types/prism";

/**
 * The three art directions.
 *
 * These are *data* — they travel inside the scene graph and are applied as
 * inline styles, because the Remotion renderer has no Tailwind. Never mirror
 * them as CSS classes (context/ui-context.md §Film palettes).
 */
export const PALETTES: Record<ArtDirection, Palette> = {
  "minimal-dark": {
    background: "#0A0A0C",
    primary: "#F5F5F7",
    accent: "#7C6CFF",
    text: "#F5F5F7",
  },
  "electric-editorial": {
    background: "#0D0F1A",
    primary: "#FFFFFF",
    accent: "#00E5A0",
    text: "#E8EAF2",
  },
  /** Light-background direction. Film components must not assume a dark ground. */
  "warm-playful": {
    background: "#FFF8F0",
    primary: "#1B1614",
    accent: "#FF6B35",
    text: "#1B1614",
  },
};

export const ART_DIRECTION_LABELS: Record<ArtDirection, string> = {
  "minimal-dark": "Minimal dark",
  "electric-editorial": "Electric editorial",
  "warm-playful": "Warm playful",
};

export const ART_DIRECTIONS = Object.keys(PALETTES) as ArtDirection[];
