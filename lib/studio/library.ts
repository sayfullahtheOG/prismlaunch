import { LIBRARY_PREFIX } from "./files";
import { DEFAULT_ANIMATION, DEFAULT_BOX } from "./schema";
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
 * The sounds are files the studio ships under `library/`, served from the
 * site itself, so they work in every workspace with nothing to copy. The
 * effects are synthesised (scripts/make-sfx.mjs): short, dry, and honest
 * about being effects rather than recordings.
 */

export type LibraryItem = {
  id: string;
  name: string;
  /** One line on what it is for. */
  blurb: string;
  group: "Type" | "Shapes" | "Sound";
  draft: ElementDraft;
};

function sound(
  name: string,
  file: string,
  role: string,
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
  };
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
    box: { ...DEFAULT_BOX },
    animation: { ...DEFAULT_ANIMATION },
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
    ...overrides,
  };
}

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
    id: "sfx-whoosh",
    name: "Whoosh",
    blurb: "Air moving, 0.6s. Under a slide or a wipe.",
    group: "Sound",
    draft: sound("Whoosh", "whoosh.wav", "effect"),
  },
  {
    id: "sfx-click",
    name: "Click",
    blurb: "A short mechanical click, 0.1s. A button, a cut.",
    group: "Sound",
    draft: sound("Click", "click.wav", "effect"),
  },
  {
    id: "sfx-tick",
    name: "Tick",
    blurb: "A softer, higher click, 0.08s. Keystrokes, list items landing.",
    group: "Sound",
    draft: sound("Tick", "tick.wav", "effect"),
  },
  {
    id: "sfx-impact",
    name: "Impact",
    blurb: "A low hit that falls away, 0.9s. The downbeat under a reveal.",
    group: "Sound",
    draft: sound("Impact", "impact.wav", "effect"),
  },
  {
    id: "sfx-rise",
    name: "Rise",
    blurb: "Noise opening up over 1.6s and stopping. The beat before the reveal.",
    group: "Sound",
    draft: sound("Rise", "rise.wav", "effect"),
  },
];

export const LIBRARY_GROUPS = ["Type", "Shapes", "Sound"] as const;
