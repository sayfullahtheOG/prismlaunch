import type { Reveal } from "@/types/prism";

/**
 * Words arriving.
 *
 * Pure functions of the text and how far along the reveal is, so the export
 * and the preview agree to the frame, and a test can ask what the fourth
 * frame of a typed line says without a browser.
 */

/** 0 at the clip's first frame, 1 once `revealFrames` have passed. */
export function revealProgress(frame: number, revealFrames: number): number {
  if (revealFrames <= 0) return 1;
  return Math.min(1, Math.max(0, frame / revealFrames));
}

/** The characters written so far. Whole characters: never half an emoji. */
export function typedText(text: string, progress: number): string {
  const chars = [...text];
  return chars.slice(0, Math.round(chars.length * progress)).join("");
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/;

/**
 * The first number in the text, run from zero up to itself.
 *
 * Keeps the text's own formatting: thousands separators if it had them, the
 * same number of decimals, and everything around the number as it was, so
 * "10,000+ users" reads "0+ users" and then "10,000+ users".
 */
export function countText(text: string, progress: number): string {
  const match = NUMBER.exec(text);
  if (!match) return text;
  const source = match[0];
  const grouped = source.includes(",");
  const decimals = source.includes(".") ? source.length - source.indexOf(".") - 1 : 0;
  const target = Number(source.replace(/,/g, ""));
  if (!Number.isFinite(target)) return text;

  const eased = 1 - Math.pow(1 - progress, 3);
  let out = (target * eased).toFixed(decimals);
  if (grouped) {
    const [whole, fraction] = out.split(".");
    out = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
  }
  return text.slice(0, match.index) + out + text.slice(match.index + source.length);
}

/** Words and the whitespace between them, in order, so the layout is the same as the plain text's. */
export function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

export function isSpace(part: string): boolean {
  return /^\s+$/.test(part);
}

const STAGGER = 0.7;

/**
 * How far along word `index` of `count` is when the whole reveal is at
 * `progress`. They start in turn across the first seventy percent and each
 * takes the remaining thirty, eased out, so the last word lands as the
 * reveal ends and no word pops.
 */
export function wordProgress(index: number, count: number, progress: number): number {
  const start = count <= 1 ? 0 : (index / (count - 1)) * STAGGER;
  const local = Math.min(1, Math.max(0, (progress - start) / (1 - STAGGER)));
  return 1 - Math.pow(1 - local, 3);
}

/** Steady while typing; blinks twice a second once the words are in. */
export function caretVisible(frame: number, fps: number, typing: boolean): boolean {
  if (typing) return true;
  const period = Math.max(1, Math.round(fps / 2));
  return frame % (period * 2) < period;
}

export function revealed(reveal: Reveal, text: string, progress: number): string {
  switch (reveal) {
    case "type":
      return typedText(text, progress);
    case "count":
      return countText(text, progress);
    default:
      return text;
  }
}
