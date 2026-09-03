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

// ---------------------------------------------------------------------------
// Two-tone lines
// ---------------------------------------------------------------------------

export type Run = { text: string; accent: boolean };

const STARRED = /\*([^*\n]+)\*/g;

/**
 * "Turn *books* into audio" as runs: the starred ones are the accent's.
 *
 * A lone asterisk, or an empty pair, is printed as it is — the markup only
 * claims a star that closes. This is the whole of the two-tone line that
 * every kinetic product film is set in: one colour for the words, another
 * for the one that matters.
 */
export function accentRuns(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of text.matchAll(STARRED)) {
    const at = match.index;
    if (at > last) runs.push({ text: text.slice(last, at), accent: false });
    runs.push({ text: match[1]!, accent: true });
    last = at + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), accent: false });
  return runs.length > 0 ? runs : [{ text, accent: false }];
}

/** The words with the stars taken out, for the reveals that print one colour. */
export function stripAccents(text: string): string {
  return accentRuns(text)
    .map((run) => run.text)
    .join("");
}

export type WordPart = { part: string; accent: boolean; space: boolean };

/** The words and their whitespace, each knowing whether it is the accent's. */
export function markedWords(text: string): WordPart[] {
  const out: WordPart[] = [];
  for (const run of accentRuns(text)) {
    for (const part of splitWords(run.text)) {
      out.push({ part, accent: run.accent, space: isSpace(part) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Word by word
// ---------------------------------------------------------------------------

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

/**
 * The same, in frames, with an explicit gap between words.
 *
 * With `stagger` set, word `index` starts `index × stagger` frames in and
 * takes `revealFrames` to land — which is how a line is appended to, one
 * word every fifteen frames, each in six. Without it, the proportional
 * scheme above spreads the words across `revealFrames`.
 */
export function wordProgressAt(
  index: number,
  count: number,
  frame: number,
  revealFrames: number,
  stagger: number,
): number {
  if (stagger <= 0) return wordProgress(index, count, revealProgress(frame, revealFrames));
  const local = Math.min(1, Math.max(0, (frame - index * stagger) / Math.max(1, revealFrames)));
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
