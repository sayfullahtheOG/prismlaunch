import type { Background } from "@/types/prism";

/**
 * Which ink survives on a ground.
 *
 * The boards and the animatic's placeholder clips are roughs: they carry no
 * colour decision of their own, so their ink has to answer the film's
 * background or a light ground erases them — white words on a near-white
 * film was the first agent-built board's fate. Relative luminance (WCAG's
 * coefficients) decides; a gradient is judged by the mean of its stops.
 */

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
}

/** 0 for black, 1 for white. Alpha, if the hex has it, is ignored: the ground behind it is unknown. */
export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  const six = raw.length >= 6 ? raw : raw.slice(0, 3).split("").map((c) => c + c).join("");
  const r = parseInt(six.slice(0, 2), 16);
  const g = parseInt(six.slice(2, 4), 16);
  const b = parseInt(six.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return 0;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function isLightGround(background: Background): boolean {
  const luminance =
    background.kind === "solid"
      ? relativeLuminance(background.color)
      : (relativeLuminance(background.from) + relativeLuminance(background.to)) / 2;
  return luminance > 0.35;
}

/** The rough's inks: full for words, faint for captions. */
export function roughInk(background: Background): { ink: string; faint: string } {
  return isLightGround(background)
    ? { ink: "#14141A", faint: "#14141A80" }
    : { ink: "#F5F5F7", faint: "#F5F5F780" };
}
