import type { IconName } from "@/types/prism";

/**
 * The icons the studio draws itself.
 *
 * Each is a path in a 24×24 box, drawn here rather than loaded, so an icon
 * clip is crisp at any size, takes any colour, and can draw itself on
 * stroke by stroke — the check that appears under "Done" is the most
 * reused moment in product film, and it should never be a PNG. Outlined
 * icons are stroked with round caps; the filled ones are the marks that
 * are read as a silhouette (a star, a sparkle, a play button, a cursor).
 */
export type IconShape = { d: string; filled: boolean };

export const ICON_PATHS: Record<IconName, IconShape> = {
  check: { d: "M5 12.5l4.5 4.5L19 7", filled: false },
  x: { d: "M6 6l12 12M18 6L6 18", filled: false },
  plus: { d: "M12 5v14M5 12h14", filled: false },
  minus: { d: "M5 12h14", filled: false },
  "arrow-right": { d: "M4 12h16M13 5l7 7-7 7", filled: false },
  "arrow-up-right": { d: "M7 17L17 7M8 7h9v9", filled: false },
  "chevron-right": { d: "M9 5l7 7-7 7", filled: false },
  "chevron-down": { d: "M5 9l7 7 7-7", filled: false },
  sparkle: {
    d: "M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z",
    filled: true,
  },
  star: {
    d: "M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 6 21l1.3-6.8-5-4.7 6.8-.8z",
    filled: true,
  },
  heart: {
    d: "M12 20.5s-8-5.2-8-11A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5c0 5.8-8 11-8 11z",
    filled: true,
  },
  bolt: { d: "M13 2L4 14h7l-1 8 9-12h-7l1-8z", filled: true },
  play: { d: "M7 4.5v15l12-7.5z", filled: true },
  search: { d: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.5-4.5", filled: false },
  circle: { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", filled: false },
  cursor: { d: "M5.5 3.5l13 8.5-5.8 1.4 3.6 6.4-2.6 1.4-3.6-6.4L5.5 19z", filled: true },
  hand: {
    d: "M9 11.5V5.5a1.5 1.5 0 0 1 3 0v5m0-3.5a1.5 1.5 0 0 1 3 0v4m0-2.5a1.5 1.5 0 0 1 3 0v6.5a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.9-2.5l-3-4.2a1.5 1.5 0 0 1 2.3-1.9L9 15V11.5",
    filled: false,
  },
};

/**
 * How much of the stroke is drawn at one frame of a draw-on: the whole
 * path by `frames`, eased so the pen slows as it finishes. A filled icon
 * has no stroke to draw, so it fades in over the same frames instead.
 */
export function drawProgress(frame: number, frames: number): number {
  const p = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
  return 1 - Math.pow(1 - p, 2);
}
