import { z } from "zod";

/**
 * The composition — the single source of truth for the whole product.
 *
 * This is a *file format* as well as a runtime guard. An agent writes
 * `.prismlaunch/<slug>/project.json` with its own file tools;
 * `ProjectFileSchema` is exactly what it must write, and public/SKILL.md is the
 * prose version of the same thing. If the two disagree, this file is right and
 * SKILL.md is stale.
 *
 * ## Why there is no scene structure here
 *
 * There used to be: four scenes, in fixed slots, each with a `headline` and an
 * optional `body`. It was defensible on paper — constraint makes short films
 * good — and wrong in practice. Real promo videos do not have four acts with a
 * title slot in each. They layer type over footage, cut on a beat, hold a
 * single word for two seconds and then stack six things at once. A schema that
 * cannot express that is not a safety rail, it is a smaller product.
 *
 * So the model is a canvas and a stack of tracks, and the agent decides what
 * goes on it. What is still enforced is only what would otherwise produce a
 * broken file or an unrenderable frame: clips inside the composition, no
 * overlaps within a track, bounded counts, valid colours.
 *
 * ## The stack
 *
 * Tracks are ordered front-to-back, matching every editor people already know:
 * the first visual track renders on top. Audio tracks sort below the
 * background, which is where they sit in the timeline UI too.
 *
 *     tracks[0]      visual   ← front
 *     tracks[1]      visual
 *     background              ← always present, always behind every visual
 *     tracks[2]      audio
 *     tracks[3]      audio
 *
 * Everything else derives from here: TypeScript types with `z.infer` (see
 * types/prism.ts), and the JSON Schema handed to agents with `z.toJSONSchema`
 * (see toolInputJsonSchema below).
 *
 * Why one definition matters: WebMCP's `inputSchema` is a *hint to the model*
 * and enforces nothing at runtime — verified against live Chrome, which passes
 * missing required fields and unexpected properties straight through to the
 * handler. Every `execute` therefore re-validates with the same schema the UI
 * uses. Deriving one from the other is what stops them drifting.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;

/** Five minutes at 30fps. A cap, not a target — nothing here wants a long film. */
export const MAX_FRAMES = 9000;
export const MIN_CLIP_FRAMES = 1;

export const MAX_TRACKS = 24;
export const MAX_CLIPS_PER_TRACK = 120;
export const MAX_TEXT_LENGTH = 400;
export const MAX_ELEMENTS = 60;

/**
 * Bumped only when a change would make an older `project.json` unreadable.
 * A file carrying a version we do not know is refused with its number quoted,
 * rather than parsed optimistically into something subtly wrong.
 *
 * v2 replaced the fixed four-scene graph with tracks and clips.
 * v3 added `elements` and `elementId` on clips. A v2 file still opens — it
 * simply has no elements — and is written back as v3.
 */
export const PROJECT_FILE_VERSION = 3;
const READABLE_VERSIONS = [2, PROJECT_FILE_VERSION] as const;

/** The directory an agent writes into, at the root of whatever it is working on. */
export const WORKSPACE_DIR = ".prismlaunch";

/** The one file that defines a composition. */
export const PROJECT_FILE = "project.json";

/** Finished MP4s land here, beside the project that produced them. */
export const RENDERS_DIR = "renders";

/** Images, video and audio the composition refers to, beside the project. */
export const ASSETS_DIR = "assets";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** Six or eight digits — the eighth pair is alpha, which saves a separate field. */
export const ColorSchema = z
  .string()
  .regex(HEX, "expected a hex colour like #1B1614 or #1B1614CC");

/**
 * A clip's position, as fractions of the canvas rather than pixels.
 *
 * Resolution-independent, so the same composition renders correctly at 720p and
 * 4K, and an agent can say `{ x: 0.5, y: 0.5 }` for "centred" without knowing
 * the output size. `x`/`y` are the box's CENTRE, which is what makes centring
 * expressible at all — with a top-left anchor the agent has to subtract half
 * the width, and it will get it wrong.
 *
 * Values outside 0–1 are legal: sliding a title in from off-screen means
 * starting at x = -0.3, and clamping that would break the move.
 */
export const DEFAULT_BOX = {
  x: 0.5,
  y: 0.5,
  width: 0.8,
  height: 0.2,
  rotation: 0,
  opacity: 1,
  tiltX: 0,
  tiltY: 0,
};

export const BoxSchema = z.object({
  x: z.number().min(-2).max(3).default(0.5),
  y: z.number().min(-2).max(3).default(0.5),
  width: z.number().gt(0).max(3).default(0.8),
  height: z.number().gt(0).max(3).default(0.2),
  rotation: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
  /**
   * Perspective, in degrees. `tiltX` leans the box back like a card on a
   * desk; `tiltY` turns it like a door. ±12 reads as a floating product
   * shot, ±30 as a phone flying past. Zero is flat, which is most things.
   */
  tiltX: z.number().min(-85).max(85).default(0),
  tiltY: z.number().min(-85).max(85).default(0),
});

/**
 * Enter and exit animations.
 *
 * A closed set rather than freeform keyframes, because these are the moves that
 * read on a short film and an agent choosing between named things gets it
 * right far more often than one authoring easing curves. `none` is first so it
 * is the honest default: a clip that should just be there does not animate.
 *
 * The first eight are the classic grammar. The last four are the kinetic
 * ones every product film made this decade uses: `pop` (a word arriving out
 * of focus and a touch too large, settling), `zoom` (through the camera),
 * `flip` (a card turning up) and `wipe` (a true mask reveal, left to right).
 */
export const TransitionSchema = z.enum([
  "none",
  "fade",
  "rise",
  "fall",
  "slide-left",
  "slide-right",
  "scale",
  "blur",
  "pop",
  "zoom",
  "flip",
  "wipe",
]);

export const DEFAULT_ANIMATION: {
  enter: z.infer<typeof TransitionSchema>;
  exit: z.infer<typeof TransitionSchema>;
  enterFrames: number;
  exitFrames: number;
  travel: number;
  spring: number;
} = {
  enter: "none",
  exit: "none",
  enterFrames: 12,
  exitFrames: 12,
  travel: 0.03,
  spring: 0,
};

export const AnimationSchema = z.object({
  enter: TransitionSchema.default("none"),
  exit: TransitionSchema.default("none"),
  /** How long each transition runs. Clamped against the clip at render time. */
  enterFrames: z.number().int().min(0).max(120).default(12),
  exitFrames: z.number().int().min(0).max(120).default(12),
  /**
   * How far `rise`, `fall` and the slides travel, as a fraction of the
   * canvas. 0.03 settles into place; 0.25 arrives from off-stage, which is
   * what a phone flying into frame wants.
   */
  travel: z.number().min(0).max(1).default(0.03),
  /**
   * Overshoot on the enter. 0 is critically damped: it slows into place.
   * 0.3 lands a hair past and settles back, the way a card dealt onto a
   * table does; 0.6 bounces. Letters are not rubber — keep it off text.
   */
  spring: z.number().min(0).max(1).default(0),
});

/**
 * One move over a clip's life, on top of its enter and exit.
 *
 * Enter and exit get a thing on and off. This is the third move a product
 * film keeps needing: a cursor gliding to a button, a screenshot pushing in
 * slowly, a tap ring growing and going. From where the box is to the box
 * plus `x`/`y`, scaled to `scale` on the way, over `frames` (0 is the whole
 * clip) starting `delay` frames in, and held there after. `press` dips it
 * once as it lands, which is what a click looks like. One move, not a
 * keyframe list, for the same reason the transitions are eight names.
 */
export const MotionEasingSchema = z.enum(["out", "in-out", "linear"]);

export const MotionSchema = z.object({
  x: z.number().min(-3).max(3).default(0),
  y: z.number().min(-3).max(3).default(0),
  scale: z.number().min(0.1).max(6).default(1),
  frames: z.number().int().min(0).max(MAX_FRAMES).default(0),
  delay: z.number().int().min(0).max(MAX_FRAMES).default(0),
  easing: MotionEasingSchema.default("out"),
  press: z.boolean().default(false),
  /** Degrees turned by the end of the move. A card settling, a star spinning. */
  rotate: z.number().min(-1080).max(1080).default(0),
  /** Opacity at the end of the move, as a multiplier of the box's own. 1 leaves it alone. */
  opacity: z.number().min(0).max(1).default(1),
  /** Defocus at the end of the move, 0–1. A background falling out of focus behind the subject. */
  blur: z.number().min(0).max(1).default(0),
  /** Curve of the path: 0 is a straight line, ±0.5 a visible arc, ±1 a swoop. */
  arc: z.number().min(-1).max(1).default(0),
  /** Overshoot at the end of the move, like the enter's. 0 slows in; 0.4 settles past and back. */
  spring: z.number().min(0).max(1).default(0),
  /** Ghosts along the path behind a moving thing — a streak, the way a sparkle leaves one. */
  trail: z.boolean().default(false),
});

export const DEFAULT_MOTION: z.infer<typeof MotionSchema> = {
  x: 0,
  y: 0,
  scale: 1,
  frames: 0,
  delay: 0,
  easing: "out",
  press: false,
  rotate: 0,
  opacity: 1,
  blur: 0,
  arc: 0,
  spring: 0,
  trail: false,
};

/**
 * How a text clip's words arrive, on top of its enter.
 *
 * `type` writes them a character at a time, `words` lands them one after
 * another, `count` runs the first number in them up from zero. The three
 * moves every film with words in it reaches for, and nothing a person has
 * to time by hand.
 */
export const RevealSchema = z.enum(["none", "type", "words", "count"]);

/** How each word lands when the reveal is `words`. `pop` is the kinetic one: out of focus, a touch large, settling. */
export const RevealStyleSchema = z.enum(["rise", "fade", "pop", "blur"]);

export const FontFamilySchema = z.enum(["display", "body", "mono"]);
export const TextAlignSchema = z.enum(["left", "center", "right"]);
export const FitSchema = z.enum(["cover", "contain", "fill"]);

/**
 * A path inside the project's own folder, e.g. `assets/logo.png`.
 *
 * Constrained hard because it is resolved against a `FileSystemDirectoryHandle`:
 * no leading slash, no `..`, no backslashes. A composition can only ever refer
 * to files inside its own directory, so opening someone's project cannot read
 * anything else on their disk.
 */
export const AssetPathSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
    "must be a relative path inside the project folder",
  )
  .refine((value) => !value.includes(".."), {
    message: "must not contain ..",
  })
  .refine((value) => !value.includes("//"), {
    message: "must not contain //",
  });

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

const ClipBase = {
  id: z.string().min(1).max(60),
  /** First frame, relative to the composition. */
  from: z.number().int().min(0).max(MAX_FRAMES),
  durationInFrames: z.number().int().min(MIN_CLIP_FRAMES).max(MAX_FRAMES),
  /**
   * A leftover from when every clip carried its own review. The approval
   * boundary lives per STAGE now — the person approves the animatic, the
   * build, the polish — so new clips are simply accepted. The field stays
   * so older films still read, and a legacy draft still shows its badge.
   */
  approval: z.enum(["accepted", "draft"]).default("accepted"),
  /** What the agent changed, and why. Shown next to the accept button. */
  revisionNote: z.string().max(240).optional(),
  label: z.string().max(60).optional(),
  /**
   * The element this clip was placed from, if any. Changing that element
   * changes this clip too — see `updateElement`. Must name an entry in
   * `elements`; `removeElement` clears it rather than leaving it dangling.
   */
  elementId: z.string().max(60).optional(),
};

const VisualBase = {
  ...ClipBase,
  box: BoxSchema.default(DEFAULT_BOX),
  animation: AnimationSchema.default(DEFAULT_ANIMATION),
  motion: MotionSchema.default(DEFAULT_MOTION),
  /**
   * Depth, 0–1. A soft shadow under the thing, tinted by the ground, the
   * way a card floats above a desk. 0.3 is a card; 0.6 a phone in the air.
   */
  shadow: z.number().min(0).max(1).default(0),
  /** A halo in the thing's own colour, 0–1. The one premium light in a frame; ration it. */
  glow: z.number().min(0).max(1).default(0),
  /** Defocus, 0–1, held for the whole clip. A wall of text behind the subject, a screenshot falling back. */
  blur: z.number().min(0).max(1).default(0),
};

export const TextClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("text"),
  /**
   * The words. Wrap a run in asterisks to set it in the accent colour:
   * "Turn *books* into audio" lights one word. That is the two-tone line
   * every kinetic product film is set in.
   */
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  /**
   * Font size as a fraction of canvas HEIGHT, not pixels — the same reason the
   * box is normalised. 0.08 is a caption, 0.16 a headline, 0.3 a hero word.
   */
  fontSize: z.number().gt(0).max(1).default(0.09),
  fontFamily: FontFamilySchema.default("display"),
  fontWeight: z.number().int().min(100).max(900).default(600),
  color: ColorSchema.default("#F7F8F8"),
  /** The colour of the *starred* words. Unset, the stars are just printed. */
  accent: ColorSchema.optional(),
  align: TextAlignSchema.default("center"),
  lineHeight: z.number().min(0.6).max(3).default(1.1),
  letterSpacing: z.number().min(-0.1).max(0.5).default(-0.02),
  reveal: RevealSchema.default("none"),
  /**
   * How many frames the reveal takes, from the clip's first frame. With
   * `revealStagger` set, this is how long each word takes instead.
   */
  revealFrames: z.number().int().min(1).max(600).default(30),
  /** Frames between one word starting and the next, for `words`. 0 spreads them across `revealFrames`. */
  revealStagger: z.number().int().min(0).max(120).default(0),
  revealStyle: RevealStyleSchema.default("rise"),
  /** A text caret after the words: blinking, and typing along with `type`. */
  caret: z.boolean().default(false),
  /** A colour behind the words, filling the box: a button, a chip, a label. */
  fill: ColorSchema.optional(),
  /** Corner radius of that fill, as a fraction of the box's smaller side. 0.5 is a pill. */
  radius: z.number().min(0).max(0.5).default(0),
});

export const ShapeClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("shape"),
  shape: z.enum(["rect", "ellipse"]),
  fill: ColorSchema.default("#FFFFFF"),
  /** A second colour makes the fill a gradient, from `fill` to this, along `fillAngle`. */
  fillTo: ColorSchema.optional(),
  fillAngle: z.number().min(0).max(360).default(180),
  /** Corner radius as a fraction of the shape's smaller side. */
  radius: z.number().min(0).max(0.5).default(0),
});

/**
 * The icons the studio draws itself: crisp at any size, in any colour, and
 * able to draw on stroke by stroke. A check that draws itself under "Done"
 * is the single most reused moment in product film.
 */
export const ICONS = [
  "check",
  "x",
  "plus",
  "minus",
  "arrow-right",
  "arrow-up-right",
  "chevron-right",
  "chevron-down",
  "sparkle",
  "star",
  "heart",
  "bolt",
  "play",
  "search",
  "circle",
  "cursor",
  "hand",
] as const;

export const IconNameSchema = z.enum(ICONS);

export const IconClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("icon"),
  icon: IconNameSchema,
  color: ColorSchema.default("#F7F8F8"),
  /** Stroke width, 0.5–4, for the outlined icons. 2 is the default weight. */
  stroke: z.number().min(0.5).max(4).default(2),
  /** Draw the stroke on over the enter, like a pen. */
  draw: z.boolean().default(false),
});

/**
 * Particles: a burst of confetti under a "Done", sparkles around a
 * feature, dust rising through a dark frame. Deterministic from `seed`,
 * so the export matches the preview to the pixel.
 */
export const ParticleStyleSchema = z.enum(["confetti", "burst", "sparkles", "rise"]);

export const ParticlesClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("particles"),
  style: ParticleStyleSchema.default("confetti"),
  count: z.number().int().min(1).max(400).default(80),
  colors: z.array(ColorSchema).min(1).max(6).default(["#5B8CFF", "#7CC7FF", "#F5A9E1"]),
  /** How far they fly, 0–1, as a share of the canvas. */
  spread: z.number().min(0).max(1).default(0.6),
  /** How hard they fall. 0 floats; 1 is confetti; 2 is hail. */
  gravity: z.number().min(0).max(2).default(1),
  /** Size of a piece, as a fraction of canvas height. */
  size: z.number().min(0.003).max(0.1).default(0.016),
  seed: z.number().int().min(0).max(9999).default(1),
});

/**
 * A device: a frame around a screenshot. `phone` has a bezel and an island,
 * `browser` a title bar with three dots, `window` a hairline and a shadow,
 * `card` a plain white panel. Without `src`, the screen is `screen`.
 */
export const DeviceKindSchema = z.enum(["phone", "browser", "window", "card"]);

export const DeviceClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("device"),
  device: DeviceKindSchema.default("browser"),
  src: AssetPathSchema.optional(),
  fit: FitSchema.default("cover"),
  /** The screen, when there is no screenshot; the ground the screenshot sits on otherwise. */
  screen: ColorSchema.default("#FFFFFF"),
  /** The bezel, the title bar, the hairline. */
  frame: ColorSchema.default("#111114"),
  radius: z.number().min(0).max(0.5).default(0.06),
});

export const ImageClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("image"),
  src: AssetPathSchema,
  fit: FitSchema.default("cover"),
  radius: z.number().min(0).max(0.5).default(0),
});

export const VideoClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("video"),
  src: AssetPathSchema,
  fit: FitSchema.default("cover"),
  radius: z.number().min(0).max(0.5).default(0),
  /** Where to start inside the source file. Trimming the head of a clip. */
  startFrom: z.number().int().min(0).max(MAX_FRAMES).default(0),
  volume: z.number().min(0).max(1).default(0),
  playbackRate: z.number().min(0.25).max(4).default(1),
});

export const AudioClipSchema = z.object({
  ...ClipBase,
  kind: z.literal("audio"),
  src: AssetPathSchema,
  startFrom: z.number().int().min(0).max(MAX_FRAMES).default(0),
  volume: z.number().min(0).max(1).default(1),
  fadeInFrames: z.number().int().min(0).max(300).default(0),
  fadeOutFrames: z.number().int().min(0).max(300).default(0),
  playbackRate: z.number().min(0.25).max(4).default(1),
});

export const VisualClipSchema = z.discriminatedUnion("kind", [
  TextClipSchema,
  ShapeClipSchema,
  ImageClipSchema,
  VideoClipSchema,
  IconClipSchema,
  ParticlesClipSchema,
  DeviceClipSchema,
]);

export const ClipSchema = z.discriminatedUnion("kind", [
  TextClipSchema,
  ShapeClipSchema,
  ImageClipSchema,
  VideoClipSchema,
  IconClipSchema,
  ParticlesClipSchema,
  DeviceClipSchema,
  AudioClipSchema,
]);

export const VISUAL_CLIP_KINDS = ["text", "shape", "image", "video", "icon", "particles", "device"] as const;
export const AUDIO_CLIP_KINDS = ["audio"] as const;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * The camera: one move at a time, over the whole picture.
 *
 * Every visual layer is drawn, then the camera looks at a point of the
 * canvas at a zoom. A move says where it is looking and how close by the
 * time it is done; between moves it holds. Push into the button as the
 * cursor reaches it, pull back to show the whole window: the two moves that
 * turn a screenshot into a film. Starts at the centre at 1.
 */
export const CameraMoveSchema = z.object({
  /** The frame the move starts on, relative to the composition. */
  from: z.number().int().min(0).max(MAX_FRAMES),
  frames: z.number().int().min(1).max(MAX_FRAMES).default(20),
  /** Where the camera is looking by the end, in canvas fractions. */
  x: z.number().min(-1).max(2).default(0.5),
  y: z.number().min(-1).max(2).default(0.5),
  /** How close: 1 is the whole canvas, 1.6 a push into a region, 0.8 pulled back with the edges showing. */
  scale: z.number().min(0.25).max(8).default(1),
  easing: MotionEasingSchema.default("in-out"),
});

export const MAX_CAMERA_MOVES = 60;

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/**
 * An element is a clip without a place on the timeline.
 *
 * PRISM_METHOD.md §7 says a style frame must settle the ground, the ink, the
 * accent, the one family that owns headlines, the size for each type role,
 * the margins, how the product is shown, and the recurring motif — and that
 * everything built afterwards is an *application* of those decisions, not a
 * new one. Elements are where those decisions live in the file: a Headline
 * style, a Support style, an accent rule, a device frame, the product
 * screenshot, the music bed. Build is then placing them, not re-deciding
 * them clip by clip, which is how a film ends up with four sizes of the same
 * headline.
 *
 * Structurally each is the matching clip schema minus placement — no start,
 * no length, no approval, no label — plus a name. A text element's `text` is
 * optional because a type style is reused with different words; the words
 * arrive when it is placed.
 */
const PLACEMENT = {
  id: true,
  from: true,
  durationInFrames: true,
  approval: true,
  revisionNote: true,
  label: true,
  elementId: true,
} as const;

const ElementBase = {
  id: z.string().min(1).max(60),
  /** What it is for — "Headline", "Accent rule", "Device frame", "Music bed". */
  name: z.string().min(1).max(40),
  /** An optional grouping word: "type", "device", "motif", "product", "sound". */
  role: z.string().max(40).optional(),
};

export const TextElementSchema = TextClipSchema.omit(PLACEMENT).extend({
  ...ElementBase,
  /** Default words. A type style usually has none; a logo lockup has fixed ones. */
  text: z.string().max(MAX_TEXT_LENGTH).optional(),
});
export const ShapeElementSchema = ShapeClipSchema.omit(PLACEMENT).extend(ElementBase);
export const ImageElementSchema = ImageClipSchema.omit(PLACEMENT).extend(ElementBase);
export const VideoElementSchema = VideoClipSchema.omit(PLACEMENT).extend(ElementBase);
export const IconElementSchema = IconClipSchema.omit(PLACEMENT).extend(ElementBase);
export const ParticlesElementSchema = ParticlesClipSchema.omit(PLACEMENT).extend(ElementBase);
export const DeviceElementSchema = DeviceClipSchema.omit(PLACEMENT).extend(ElementBase);
export const AudioElementSchema = AudioClipSchema.omit(PLACEMENT).extend(ElementBase);

export const ElementSchema = z.discriminatedUnion("kind", [
  TextElementSchema,
  ShapeElementSchema,
  ImageElementSchema,
  VideoElementSchema,
  IconElementSchema,
  ParticlesElementSchema,
  DeviceElementSchema,
  AudioElementSchema,
]);

export const ELEMENT_KINDS = ["text", "shape", "image", "video", "icon", "particles", "device", "audio"] as const;

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const TrackKindSchema = z.enum(["visual", "audio"]);

/**
 * One row in the timeline.
 *
 * Clips within a track may not overlap — that is what a track *is*, one thing
 * at a time in this lane. Overlapping two titles means putting them on two
 * tracks, which is also how you decide which is in front.
 */
export const TrackSchema = z
  .object({
    id: z.string().min(1).max(60),
    kind: TrackKindSchema,
    name: z.string().min(1).max(40),
    /** Hidden for visual tracks, muted for audio. One flag, two words. */
    hidden: z.boolean().default(false),
    locked: z.boolean().default(false),
    /** Applied to every clip in the track. Audio tracks use it as a mixer fader. */
    volume: z.number().min(0).max(1).default(1),
    clips: z.array(ClipSchema).max(MAX_CLIPS_PER_TRACK).default([]),
  })
  .superRefine((track, ctx) => {
    for (const clip of track.clips) {
      const isAudio = clip.kind === "audio";
      if (isAudio !== (track.kind === "audio")) {
        ctx.addIssue({
          code: "custom",
          path: ["clips"],
          message: `a ${track.kind} track cannot hold a ${clip.kind} clip`,
        });
        return;
      }
    }

    const sorted = [...track.clips].sort((a, b) => a.from - b.from);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      if (previous.from + previous.durationInFrames > current.from) {
        ctx.addIssue({
          code: "custom",
          path: ["clips"],
          message: `clips "${previous.id}" and "${current.id}" overlap — put one on another track`,
        });
        return;
      }
    }
  });

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

/**
 * The one layer that always exists.
 *
 * Plain by design and never a clip: it spans the whole composition, it cannot
 * be moved or deleted, and everything visual sits on top of it. Editable, but
 * only in the ways a ground should be.
 */
export const BackgroundSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("solid"),
    color: ColorSchema.default("#0A0A0C"),
  }),
  z.object({
    kind: z.literal("gradient"),
    from: ColorSchema.default("#0A0A0C"),
    to: ColorSchema.default("#1B1B22"),
    angle: z.number().min(0).max(360).default(160),
  }),
]);

// ---------------------------------------------------------------------------
// The process
// ---------------------------------------------------------------------------

/**
 * The pipeline, as state in the file.
 *
 * PRISM_METHOD.md describes how a film gets made: brief, concept, script,
 * storyboard, animatic with timing locked to the music, style frames, build,
 * sound, polish. A document can be skipped. This cannot: each stage is a field in
 * `project.json`, the agent submits an artifact into it, the person approves
 * or sends it back with a note, and the tools for a later stage refuse until
 * the earlier one is approved.
 *
 * The person is never gated — they can approve, reopen or skip anything. Only
 * the agent is held to the order. That is the contract in one sentence:
 * the agent follows the process, the person owns it.
 *
 * The one hard lock is timing. When the animatic is approved, every visual
 * clip's window is snapshotted into `animatic.beats`, and from then on an
 * agent may only place visual clips *inside* one of those windows. Filling
 * slots is the build stage; moving them is a decision the person makes.
 */

export const STAGES = [
  "brief",
  "concept",
  "script",
  "storyboard",
  "style",
  "animatic",
  "polish",
  "build",
] as const;

export const StageIdSchema = z.enum(STAGES);

export const StageStatusSchema = z.enum([
  "pending",
  "submitted",
  "changes-requested",
  "approved",
]);

const StageBase = {
  status: StageStatusSchema.default("pending"),
  /** The agent's one line on what it did and why. Shown beside the artifact. */
  summary: z.string().max(300).optional(),
  /** The person's feedback, written when they send the stage back. */
  note: z.string().max(600).optional(),
};

export const BriefStageSchema = z.object({
  ...StageBase,
  audience: z.string().max(200).optional(),
  message: z.string().max(200).optional(),
  feeling: z.string().max(40).optional(),
  lengthSeconds: z.number().min(5).max(180).optional(),
  /** Immersion's output: the one thing true here and false everywhere else. */
  truth: z.string().max(240).optional(),
  /** The single interaction that, seen once, explains the whole product. */
  demoMoment: z.string().max(240).optional(),
});

export const DirectionSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(60),
  /** The idea in one sentence. No "and". */
  line: z.string().min(1).max(200),
  /** Which angle produced it — "the enemy", "before/after", "the contrast"… */
  angle: z.string().max(40).optional(),
  /** The one-word feeling it is going for. */
  feel: z.string().max(24).optional(),
  /** Out of 12, from the six tests in the method. */
  score: z.number().int().min(0).max(12).optional(),
});

export const ConceptStageSchema = z.object({
  ...StageBase,
  directions: z.array(DirectionSchema).max(4).default([]),
  recommended: z.string().max(40).optional(),
  /** Set by the person on approval. Which one the film is. */
  chosen: z.string().max(40).optional(),
});

export const ScriptBeatSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  /** On-screen text, or the VO line. Under seven words if on screen. */
  words: z.string().max(160),
  seconds: z.number().min(0.3).max(20),
  /** What the sound does here. */
  sound: z.string().max(140).optional(),
});

export const ScriptStageSchema = z.object({
  ...StageBase,
  beats: z.array(ScriptBeatSchema).max(14).default([]),
  voiceover: z.string().max(800).optional(),
});

/**
 * One storyboard panel — a beat, described before it exists on the timeline.
 *
 * The five fields a motion-graphics board carries: what is in the frame, what
 * moves, how long, how it comes in and goes out, and what the sound does. In
 * frames rather than seconds because this is what `lay_animatic` transcribes
 * onto the timeline, and the timeline counts frames.
 */
export const StoryboardPanelSchema = z.object({
  id: z.string().min(1).max(40),
  /** The script beat this boards. */
  beatId: z.string().max(40).optional(),
  label: z.string().min(1).max(40),
  /** What is on screen: composition, ground, type role, the product if shown. */
  frame: z.string().min(1).max(280),
  /** The events, in order: what arrives, what it does, what leaves, with frames. */
  action: z.string().max(240).optional(),
  /** What is still on screen when the next panel starts — the object that carries the cut. */
  handoff: z.string().max(140).optional(),
  /** The sum of the events' frames, not a budget chosen first. */
  durationInFrames: z.number().int().min(6).max(MAX_FRAMES),
  transitionIn: TransitionSchema.default("fade"),
  transitionOut: TransitionSchema.default("fade"),
  /** The music or effect at this beat. */
  sound: z.string().max(140).optional(),
  /** The on-screen words, if any. Under seven. */
  words: z.string().max(160).optional(),
});

export const StoryboardStageSchema = z.object({
  ...StageBase,
  panels: z.array(StoryboardPanelSchema).max(40).default([]),
});

/** A beat's window, frozen when the animatic is approved. */
export const LockedBeatSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().max(60),
  from: z.number().int().min(0).max(MAX_FRAMES),
  durationInFrames: z.number().int().min(1).max(MAX_FRAMES),
});

export const AnimaticStageSchema = z.object({
  ...StageBase,
  /** Empty until approval; then the timing lock. */
  beats: z.array(LockedBeatSchema).max(40).default([]),
});

export const LookSchema = z.enum(["void", "paper", "editorial", "spec", "custom"]);

export const StyleStageSchema = z.object({
  ...StageBase,
  look: LookSchema.optional(),
  /** The elements the look is made of: the type roles, the accent, the device, the motif. */
  elementIds: z.array(z.string().max(60)).max(MAX_ELEMENTS).default([]),
  /** The two or three clips built for real, as the reference for everything else. */
  clipIds: z.array(z.string().max(60)).max(12).default([]),
});

export const BuildStageSchema = z.object({ ...StageBase });

/** A retired stage, kept so films written before sound merged into polish still read. */
export const SoundStageSchema = z.object({
  ...StageBase,
  plan: z.string().max(1600).optional(),
});

export const PolishStageSchema = z.object({
  ...StageBase,
  /** The pre-ship checklist as the agent ran it — one line per item, with a verdict. */
  checklist: z.array(z.string().max(200)).max(80).default([]),
  /**
   * The sound, rethought against the person's notes: the filled-in plan from
   * the method. Sound stopped being its own stage — it starts at the
   * animatic and is revisited here, before the build executes it.
   */
  soundPlan: z.string().max(1600).optional(),
});

/**
 * Every stage defaults independently, not just the process as a whole.
 *
 * A stage added later — the storyboard was — must not make every file written
 * before it unreadable. Defaulting only the outer object handled a file with
 * no `process` at all and refused one with a process missing one key, which
 * is exactly the file the previous build wrote. This is the fix: each stage
 * fills itself in as pending when absent.
 */
export const ProcessSchema = z.object({
  brief: BriefStageSchema.default({ status: "pending" }),
  concept: ConceptStageSchema.default({ status: "pending", directions: [] }),
  script: ScriptStageSchema.default({ status: "pending", beats: [] }),
  storyboard: StoryboardStageSchema.default({ status: "pending", panels: [] }),
  animatic: AnimaticStageSchema.default({ status: "pending", beats: [] }),
  style: StyleStageSchema.default({ status: "pending", elementIds: [], clipIds: [] }),
  build: BuildStageSchema.default({ status: "pending" }),
  sound: SoundStageSchema.default({ status: "pending" }),
  polish: PolishStageSchema.default({ status: "pending", checklist: [] }),
});

/** A fresh process: every stage pending, nothing submitted. */
export const EMPTY_PROCESS: z.infer<typeof ProcessSchema> = {
  brief: { status: "pending" },
  concept: { status: "pending", directions: [] },
  script: { status: "pending", beats: [] },
  storyboard: { status: "pending", panels: [] },
  animatic: { status: "pending", beats: [] },
  style: { status: "pending", elementIds: [], clipIds: [] },
  build: { status: "pending" },
  sound: { status: "pending" },
  polish: { status: "pending", checklist: [] },
};

// ---------------------------------------------------------------------------
// The file on disk
// ---------------------------------------------------------------------------

/**
 * `.prismlaunch/<slug>/project.json`, in full.
 *
 * This is the contract between the agent and the app. It holds only what the
 * film IS — no selection, no session history, nothing about the browser — so
 * two people opening the same folder see the same film, and a diff of this file
 * is a diff of the video.
 */
export const ProjectFileSchema = z
  .object({
    version: z
      .literal(READABLE_VERSIONS)
      .describe(`File format version. Write ${PROJECT_FILE_VERSION}.`)
      // A v2 file is a v3 file with no elements. Reading it up rather than
      // refusing it is what "versioned" is for; it is written back as v3.
      .transform(() => PROJECT_FILE_VERSION),
    name: z.string().min(1).max(80).describe("Human-readable title."),
    width: z.number().int().min(64).max(4096).default(DEFAULT_WIDTH),
    height: z.number().int().min(64).max(4096).default(DEFAULT_HEIGHT),
    fps: z.number().int().min(1).max(60).default(DEFAULT_FPS),
    durationInFrames: z.number().int().min(1).max(MAX_FRAMES),
    background: BackgroundSchema.default({ kind: "solid", color: "#0A0A0C" }),
    /** The library the film is built from. See the Elements section above. */
    elements: z.array(ElementSchema).max(MAX_ELEMENTS).default([]),
    tracks: z.array(TrackSchema).max(MAX_TRACKS).default([]),
    /** The camera's moves, in order. Empty is a still camera on the whole canvas. */
    camera: z.array(CameraMoveSchema).max(MAX_CAMERA_MOVES).default([]),
    /**
     * Defaulted, so a file written before this existed still opens — every
     * stage simply reads as pending. Not a version bump: nothing old becomes
     * unreadable, it just has less in it.
     */
    process: ProcessSchema.default(EMPTY_PROCESS),
  })
  .superRefine((project, ctx) => {
    // Visual tracks must precede audio ones, so the array order IS the stacking
    // order and the timeline can render the list top to bottom without sorting.
    let seenAudio = false;
    project.tracks.forEach((track, index) => {
      if (track.kind === "audio") seenAudio = true;
      else if (seenAudio) {
        ctx.addIssue({
          code: "custom",
          path: ["tracks", index],
          message:
            "visual tracks must come before audio tracks — the array order is the stacking order",
        });
      }
    });

    const ids = new Set<string>();
    for (const element of project.elements) {
      if (ids.has(element.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["elements"],
          message: `duplicate element id "${element.id}"`,
        });
      }
      ids.add(element.id);
    }
    const elementIds = new Set(project.elements.map((element) => element.id));

    for (const track of project.tracks) {
      if (ids.has(track.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["tracks"],
          message: `duplicate track id "${track.id}"`,
        });
      }
      ids.add(track.id);

      for (const clip of track.clips) {
        if (ids.has(clip.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["tracks"],
            message: `duplicate clip id "${clip.id}"`,
          });
        }
        ids.add(clip.id);

        if (clip.elementId !== undefined && !elementIds.has(clip.elementId)) {
          ctx.addIssue({
            code: "custom",
            path: ["tracks"],
            message: `clip "${clip.id}" is placed from element "${clip.elementId}", which is not in elements`,
          });
        }

        if (clip.from + clip.durationInFrames > project.durationInFrames) {
          ctx.addIssue({
            code: "custom",
            path: ["tracks"],
            message: `clip "${clip.id}" ends at frame ${clip.from + clip.durationInFrames}, past the composition's ${project.durationInFrames}`,
          });
        }
      }
    }
  });

/**
 * What the inspector is looking at.
 *
 * One value, five shapes. A clip or a track in the timeline, a storyboard
 * panel in the boards, an element in the library, or the background — which
 * has no id because there is exactly one. Tab state, never written to disk.
 */
export const SelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clip"), id: z.string().min(1) }),
  z.object({ kind: z.literal("track"), id: z.string().min(1) }),
  z.object({ kind: z.literal("panel"), id: z.string().min(1) }),
  z.object({ kind: z.literal("element"), id: z.string().min(1) }),
  z.object({ kind: z.literal("background") }),
]);

/**
 * A composition as the app holds it: the file, plus where it came from and what
 * is selected. The extra fields never reach disk — see `toProjectFile`.
 */
export const FilmProjectSchema = z.object({
  file: ProjectFileSchema,
  /** The folder under `.prismlaunch` this was read from. */
  slug: z.string(),
  selection: SelectionSchema.nullable(),
  activity: z
    .array(
      z.object({
        id: z.string().min(1),
        origin: z.enum(["human", "agent", "disk"]),
        label: z.string().min(1).max(120),
        detail: z.string().max(240),
        at: z.string().min(1).max(40),
        blocked: z.boolean().optional(),
      }),
    )
    .max(200),
});

/**
 * A project's folder name under `.prismlaunch`, and its identity everywhere.
 *
 * Constrained hard because it is interpolated into a filesystem path: no dots,
 * no slashes, no leading dash, so it cannot climb out of the workspace or
 * collide with a hidden file.
 */
export const SlugSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "use lowercase letters, digits and dashes, starting with a letter or digit",
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Turn a Zod schema into the JSON Schema a WebMCP tool advertises.
 *
 * Chrome performs no validation against this, so it is documentation for the
 * model — not a runtime guard. The matching `.parse()` in the executor is the
 * guard. `io: "input"` keeps the schema describing what the tool accepts
 * rather than what it returns.
 */
export function toolInputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return sanitizeJsonSchema(
    z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>,
  ) as Record<string, unknown>;
}

/**
 * Keep a tool's inputSchema to the JSON Schema core every host accepts.
 *
 * ChatGPT's WebMCP validates schemas on registerTool and refuses ones it
 * does not like — half this app's tools failed to register there, silently,
 * while every one worked in Chrome and in the shim. Zod's conversion is
 * correct JSON Schema, but correctness is not the bar; acceptance is. So:
 * only `type`, `description`, `properties`, `required`, `items`, `enum` and
 * `anyOf` survive. `oneOf` becomes `anyOf`, `const` becomes a one-value
 * `enum`, and numeric and length bounds are folded into the description,
 * where the model reads them anyway. The executor's own `.parse()` still
 * enforces the real constraints.
 */
const SCHEMA_KEEP = new Set(["type", "description", "properties", "required", "items", "enum"]);

export function sanitizeJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeJsonSchema);
  if (node === null || typeof node !== "object") return node;
  const record = node as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!SCHEMA_KEEP.has(key)) continue;
    if (key === "properties" && value !== null && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([name, child]) => [
          name,
          sanitizeJsonSchema(child),
        ]),
      );
    } else if (key === "items") {
      out.items = sanitizeJsonSchema(value);
    } else {
      out[key] = value;
    }
  }

  const variants = record.anyOf ?? record.oneOf;
  if (Array.isArray(variants)) out.anyOf = variants.map(sanitizeJsonSchema);
  if ("const" in record) out.enum = [record.const];

  const hints = boundsHint(record);
  if (hints) {
    out.description = out.description ? `${out.description} ${hints}` : hints;
  }
  return out;
}

/** "(3–600)" and its kin: the dropped bounds, said where the model reads. */
function boundsHint(record: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const min = record.minimum ?? record.exclusiveMinimum;
  const max = record.maximum;
  if (min !== undefined && max !== undefined) parts.push(`${min}–${max}`);
  else if (min !== undefined) parts.push(`min ${min}`);
  else if (max !== undefined) parts.push(`max ${max}`);
  if (record.maxLength !== undefined) parts.push(`up to ${record.maxLength} chars`);
  if (record.minItems !== undefined || record.maxItems !== undefined) {
    parts.push(`${record.minItems ?? 0}–${record.maxItems ?? "many"} items`);
  }
  if (
    record.default !== undefined &&
    typeof record.description === "string" &&
    !/default/i.test(record.description)
  ) {
    parts.push(`defaults to ${JSON.stringify(record.default)}`);
  }
  return parts.length > 0 ? `(${parts.join("; ")})` : null;
}

/**
 * Flatten a Zod error into a short, corrective sentence an agent can act on.
 *
 * Tool executors and the file reader both return this instead of throwing: an
 * agent that wrote a bad `project.json` needs to be told which field is wrong,
 * not handed a stack trace.
 */
export function explainZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
