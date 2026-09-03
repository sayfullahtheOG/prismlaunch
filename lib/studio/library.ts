import { LIBRARY_PREFIX } from "./files";
import { DEFAULT_ANIMATION, DEFAULT_BOX, DEFAULT_MOTION } from "./schema";
import type { ElementDraft } from "@/types/prism";

/**
 * Prebuilt pieces a film can be made from.
 *
 * A launch film is mostly the same few things: a headline in the display
 * face, a supporting line, a small label, an accent, a frame that stands
 * for the product, a call to action. The method (PRISM_METHOD.md §7) says
 * the style stage settles each of these once and everything after is a
 * placement of them. These are those things, ready to become elements;
 * adding one copies it into the film's own elements, where the agent or
 * the person tunes it, and every clip placed from it follows.
 *
 * The Motion pieces are what product films keep rebuilding by hand: a
 * cursor that glides and clicks, the ring under a tap, a typed line, a
 * headline arriving a word at a time, a number counting up, a highlight.
 * Each is an ordinary element with its reveal or motion already set, so
 * adding one and placing it is the whole job.
 *
 * The sounds are files the studio ships under `library/`, served from the
 * site itself, so they work in every workspace with nothing to copy. They
 * were generated with ElevenLabs: the effects with Eleven SFX, cut to their
 * content and levelled; the beds with Eleven Music, thirty seconds each and
 * instrumental, so a film can sit on one without a lyric fighting the
 * headline. A bed longer than the film is cut by the clip, and fades out by
 * default so the cut is not a cliff.
 */

export type LibraryItem = {
  id: string;
  name: string;
  /** One line on what it is for. */
  blurb: string;
  group: "Type" | "Shapes" | "Motion" | "Sound" | "Music";
  draft: ElementDraft;
};

function sound(
  name: string,
  file: string,
  role: "effect" | "music",
  overrides: Partial<Extract<ElementDraft, { kind: "audio" }>> = {},
): Extract<ElementDraft, { kind: "audio" }> {
  return {
    kind: "audio",
    name,
    role,
    src: `${LIBRARY_PREFIX}audio/${file}`,
    startFrom: 0,
    volume: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    playbackRate: 1,
    ...overrides,
  };
}

/** A music bed: under the film, a little quieter, and fading out rather than stopping. */
function bed(name: string, file: string): Extract<ElementDraft, { kind: "audio" }> {
  return sound(name, file, "music", { volume: 0.8, fadeOutFrames: 24 });
}

const INK = "#F5F5F7";
const MUTED = "#A9A9B3";
const ACCENT = "#5B8CFF";
const GROUND = "#14141A";

function text(
  overrides: Partial<Extract<ElementDraft, { kind: "text" }>>,
): Extract<ElementDraft, { kind: "text" }> {
  return {
    kind: "text",
    name: "Type style",
    fontSize: 0.06,
    fontFamily: "display",
    fontWeight: 400,
    color: INK,
    align: "center",
    lineHeight: 1.1,
    letterSpacing: -0.02,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    box: { ...DEFAULT_BOX },
    animation: { ...DEFAULT_ANIMATION },
    motion: { ...DEFAULT_MOTION },
    ...overrides,
  };
}

function shape(
  overrides: Partial<Extract<ElementDraft, { kind: "shape" }>>,
): Extract<ElementDraft, { kind: "shape" }> {
  return {
    kind: "shape",
    name: "Shape",
    shape: "rect",
    fill: INK,
    radius: 0,
    box: { ...DEFAULT_BOX },
    animation: { ...DEFAULT_ANIMATION },
    motion: { ...DEFAULT_MOTION },
    ...overrides,
  };
}

/** The arrow the Cursor piece moves. An SVG the studio ships, so it is crisp at any size. */
export const CURSOR_SRC = `${LIBRARY_PREFIX}cursor/arrow.svg`;

export const LIBRARY: readonly LibraryItem[] = [
  {
    id: "headline",
    name: "Headline",
    blurb: "The one line, in the display face, large and centred.",
    group: "Type",
    draft: text({ name: "Headline", role: "headline", fontSize: 0.09, lineHeight: 1.05 }),
  },
  {
    id: "support",
    name: "Support line",
    blurb: "The sentence under the headline, quieter and in the body face.",
    group: "Type",
    draft: text({
      name: "Support",
      role: "support",
      fontFamily: "body",
      fontSize: 0.032,
      color: MUTED,
      letterSpacing: 0,
      lineHeight: 1.4,
      box: { ...DEFAULT_BOX, y: 0.64 },
    }),
  },
  {
    id: "label",
    name: "Label",
    blurb: "A small mono caption: a feature name, a shortcut, a number.",
    group: "Type",
    draft: text({
      name: "Label",
      role: "label",
      fontFamily: "mono",
      fontSize: 0.02,
      fontWeight: 500,
      color: MUTED,
      letterSpacing: 0.08,
      lineHeight: 1,
      box: { ...DEFAULT_BOX, y: 0.12 },
    }),
  },
  {
    id: "blank-type",
    name: "Blank type style",
    blurb: "Start from nothing but the display face.",
    group: "Type",
    draft: text({ name: "Style" }),
  },
  {
    id: "accent-rule",
    name: "Accent rule",
    blurb: "A short line in the accent colour, for underlining a word or dividing a frame.",
    group: "Shapes",
    draft: shape({
      name: "Accent rule",
      role: "accent",
      fill: ACCENT,
      box: { ...DEFAULT_BOX, width: 0.08, height: 0.006, y: 0.58 },
    }),
  },
  {
    id: "device",
    name: "Device frame",
    blurb: "A dark rounded panel that stands for a screen; the product goes on it.",
    group: "Shapes",
    draft: shape({
      name: "Device",
      role: "device",
      fill: GROUND,
      radius: 0.04,
      box: { ...DEFAULT_BOX, width: 0.72, height: 0.62, y: 0.55 },
    }),
  },
  {
    id: "pill",
    name: "Pill",
    blurb: "A button shape for a call to action, with a label placed over it.",
    group: "Shapes",
    draft: shape({
      name: "Pill",
      role: "cta",
      fill: INK,
      radius: 0.5,
      box: { ...DEFAULT_BOX, width: 0.18, height: 0.07, y: 0.72 },
    }),
  },
  {
    id: "dot",
    name: "Dot",
    blurb: "A small accent circle: a cursor, a status light, a bullet.",
    group: "Shapes",
    draft: shape({
      name: "Dot",
      role: "accent",
      shape: "ellipse",
      fill: ACCENT,
      box: { ...DEFAULT_BOX, width: 0.02, height: 0.036 },
    }),
  },
  {
    id: "panel",
    name: "Full panel",
    blurb: "A rectangle over the whole frame, for a wipe or a colour beat.",
    group: "Shapes",
    draft: shape({ name: "Panel", fill: GROUND, box: { ...DEFAULT_BOX, width: 1, height: 1 } }),
  },
  {
    id: "blank-shape",
    name: "Blank shape",
    blurb: "A rectangle, and nothing decided about it.",
    group: "Shapes",
    draft: shape({ name: "Shape" }),
  },
  {
    id: "cursor",
    name: "Cursor",
    blurb: "An arrow that glides to a spot and clicks. Move X and Y say where the button is.",
    group: "Motion",
    draft: {
      kind: "image",
      name: "Cursor",
      role: "cursor",
      src: CURSOR_SRC,
      fit: "contain",
      radius: 0,
      box: { ...DEFAULT_BOX, x: 0.4, y: 0.62, width: 0.03, height: 0.0533 },
      animation: { ...DEFAULT_ANIMATION, enter: "fade", exit: "fade", enterFrames: 6, exitFrames: 6 },
      motion: { ...DEFAULT_MOTION, x: 0.12, y: -0.08, frames: 24, delay: 8, easing: "in-out", press: true },
    },
  },
  {
    id: "tap-ring",
    name: "Tap ring",
    blurb: "A ring that grows from a point and fades, 0.4s. Under a cursor's click or a finger's tap.",
    group: "Motion",
    draft: shape({
      name: "Tap ring",
      role: "cursor",
      shape: "ellipse",
      fill: ACCENT,
      box: { ...DEFAULT_BOX, width: 0.03, height: 0.0533, opacity: 0.45 },
      animation: { ...DEFAULT_ANIMATION, exit: "fade", exitFrames: 8 },
      motion: { ...DEFAULT_MOTION, scale: 2.4, frames: 12 },
    }),
  },
  {
    id: "typewriter",
    name: "Typewriter",
    blurb: "Mono words typed out behind a caret, 1.2s. A prompt, a command, a line of code.",
    group: "Motion",
    draft: text({
      name: "Typewriter",
      role: "type",
      text: "$ npx prismlaunch --film launch",
      fontFamily: "mono",
      fontSize: 0.045,
      fontWeight: 500,
      align: "left",
      letterSpacing: 0,
      lineHeight: 1.3,
      reveal: "type",
      revealFrames: 36,
      caret: true,
      box: { ...DEFAULT_BOX, width: 0.7, height: 0.12 },
    }),
  },
  {
    id: "word-by-word",
    name: "Word by word",
    blurb: "A headline whose words land one after another over a second.",
    group: "Motion",
    draft: text({
      name: "Word by word",
      role: "headline",
      text: "Every word lands on its own",
      fontSize: 0.09,
      lineHeight: 1.05,
      reveal: "words",
      revealFrames: 30,
    }),
  },
  {
    id: "counter",
    name: "Counter",
    blurb: "A number that counts up from zero to itself in 1.5s, keeping its commas. Users, stars, hours saved.",
    group: "Motion",
    draft: text({
      name: "Counter",
      role: "figure",
      text: "10,000+",
      fontSize: 0.16,
      fontWeight: 600,
      reveal: "count",
      revealFrames: 45,
      box: { ...DEFAULT_BOX, height: 0.3 },
    }),
  },
  {
    id: "highlight",
    name: "Highlight",
    blurb: "A soft accent block that comes up behind a feature, to point at it without an arrow.",
    group: "Motion",
    draft: shape({
      name: "Highlight",
      role: "accent",
      fill: ACCENT,
      radius: 0.2,
      box: { ...DEFAULT_BOX, width: 0.3, height: 0.1, opacity: 0.22 },
      animation: { ...DEFAULT_ANIMATION, enter: "scale", exit: "fade", enterFrames: 10, exitFrames: 8 },
    }),
  },
  {
    id: "sfx-whoosh",
    name: "Whoosh",
    blurb: "Air moving past, 0.9s. Under a slide or a wipe.",
    group: "Sound",
    draft: sound("Whoosh", "whoosh.wav", "effect"),
  },
  {
    id: "sfx-click",
    name: "Click",
    blurb: "A short mechanical click, 0.4s. A button, a cut.",
    group: "Sound",
    draft: sound("Click", "click.wav", "effect"),
  },
  {
    id: "sfx-tick",
    name: "Tick",
    blurb: "A small wooden tick, 0.3s. Keystrokes, list items landing.",
    group: "Sound",
    draft: sound("Tick", "tick.wav", "effect"),
  },
  {
    id: "sfx-impact",
    name: "Impact",
    blurb: "A low hit that falls away, 1s. The downbeat under a reveal.",
    group: "Sound",
    draft: sound("Impact", "impact.wav", "effect"),
  },
  {
    id: "sfx-rise",
    name: "Rise",
    blurb: "Noise opening up over a second and stopping. The beat before the reveal.",
    group: "Sound",
    draft: sound("Rise", "rise.wav", "effect"),
  },
  {
    id: "bed-calm",
    name: "Calm bed",
    blurb: "Warm pads and a sparse piano at 80 BPM, 30s. For a film that explains.",
    group: "Music",
    draft: bed("Calm bed", "bed-calm.mp3"),
  },
  {
    id: "bed-upbeat",
    name: "Upbeat bed",
    blurb: "Plucked synths over a driving kick at 120 BPM, 30s. For a film that moves.",
    group: "Music",
    draft: bed("Upbeat bed", "bed-upbeat.mp3"),
  },
  {
    id: "bed-cinematic",
    name: "Cinematic bed",
    blurb: "Strings and sub swells that build for 30s. For a film with one big reveal.",
    group: "Music",
    draft: bed("Cinematic bed", "bed-cinematic.mp3"),
  },
];

export const LIBRARY_GROUPS = ["Type", "Shapes", "Motion", "Sound", "Music"] as const;

/** Whether a piece does anything over time: a move, a reveal, or an enter and exit. */
export function isAnimated(draft: ElementDraft): boolean {
  if (!("motion" in draft)) return false;
  const { motion, animation } = draft;
  if (motion.x !== 0 || motion.y !== 0 || motion.scale !== 1 || motion.press) return true;
  if (draft.kind === "text" && draft.reveal !== "none") return true;
  return animation.enter !== "none" || animation.exit !== "none";
}

/**
 * How long a preview of a piece runs, in frames at 30 a second: its move
 * or its reveal, whichever is longer, then a beat to see where it landed.
 * A move that runs "for the whole clip" is given a short clip.
 */
export function previewFrames(draft: ElementDraft): number {
  if (!("motion" in draft)) return 30;
  const { motion, animation } = draft;
  let end = animation.enterFrames;
  if (motion.x !== 0 || motion.y !== 0 || motion.scale !== 1 || motion.press) {
    end = Math.max(end, motion.delay + (motion.frames || 24) + (motion.press ? 8 : 0));
  }
  if (draft.kind === "text" && draft.reveal !== "none") end = Math.max(end, draft.revealFrames);
  return Math.max(30, end + 12);
}
