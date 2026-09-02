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

/**
 * Bumped only when a change would make an older `project.json` unreadable.
 * A file carrying a version we do not know is refused with its number quoted,
 * rather than parsed optimistically into something subtly wrong.
 *
 * v2 replaced the fixed four-scene graph with tracks and clips.
 */
export const PROJECT_FILE_VERSION = 2;

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
};

export const BoxSchema = z.object({
  x: z.number().min(-2).max(3).default(0.5),
  y: z.number().min(-2).max(3).default(0.5),
  width: z.number().gt(0).max(3).default(0.8),
  height: z.number().gt(0).max(3).default(0.2),
  rotation: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
});

/**
 * Enter and exit animations.
 *
 * A closed set rather than freeform keyframes, because these are the moves that
 * read on a short film and an agent choosing between eight named things gets it
 * right far more often than one authoring easing curves. `none` is first so it
 * is the honest default: a clip that should just be there does not animate.
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
]);

export const DEFAULT_ANIMATION: {
  enter: z.infer<typeof TransitionSchema>;
  exit: z.infer<typeof TransitionSchema>;
  enterFrames: number;
  exitFrames: number;
} = {
  enter: "none",
  exit: "none",
  enterFrames: 12,
  exitFrames: 12,
};

export const AnimationSchema = z.object({
  enter: TransitionSchema.default("none"),
  exit: TransitionSchema.default("none"),
  /** How long each transition runs. Clamped against the clip at render time. */
  enterFrames: z.number().int().min(0).max(120).default(12),
  exitFrames: z.number().int().min(0).max(120).default(12),
});

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
   * Agent work arrives as `draft` and a person clears it. The approval boundary
   * lives per clip so a review is about one change rather than the whole film.
   */
  approval: z.enum(["accepted", "draft"]).default("draft"),
  /** What the agent changed, and why. Shown next to the accept button. */
  revisionNote: z.string().max(240).optional(),
  label: z.string().max(60).optional(),
};

const VisualBase = {
  ...ClipBase,
  box: BoxSchema.default(DEFAULT_BOX),
  animation: AnimationSchema.default(DEFAULT_ANIMATION),
};

export const TextClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("text"),
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  /**
   * Font size as a fraction of canvas HEIGHT, not pixels — the same reason the
   * box is normalised. 0.08 is a caption, 0.16 a headline, 0.3 a hero word.
   */
  fontSize: z.number().gt(0).max(1).default(0.09),
  fontFamily: FontFamilySchema.default("display"),
  fontWeight: z.number().int().min(100).max(900).default(600),
  color: ColorSchema.default("#F7F8F8"),
  align: TextAlignSchema.default("center"),
  lineHeight: z.number().min(0.6).max(3).default(1.1),
  letterSpacing: z.number().min(-0.1).max(0.5).default(-0.02),
});

export const ShapeClipSchema = z.object({
  ...VisualBase,
  kind: z.literal("shape"),
  shape: z.enum(["rect", "ellipse"]),
  fill: ColorSchema.default("#FFFFFF"),
  /** Corner radius as a fraction of the shape's smaller side. */
  radius: z.number().min(0).max(0.5).default(0),
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
]);

export const ClipSchema = z.discriminatedUnion("kind", [
  TextClipSchema,
  ShapeClipSchema,
  ImageClipSchema,
  VideoClipSchema,
  AudioClipSchema,
]);

export const VISUAL_CLIP_KINDS = ["text", "shape", "image", "video"] as const;
export const AUDIO_CLIP_KINDS = ["audio"] as const;

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
 * animatic with timing locked to the music, style frames, build, sound,
 * polish. A document can be skipped. This cannot: each stage is a field in
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
  "animatic",
  "style",
  "build",
  "sound",
  "polish",
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
  /** The two or three clips built for real, as the reference for everything else. */
  clipIds: z.array(z.string().max(60)).max(12).default([]),
});

export const BuildStageSchema = z.object({ ...StageBase });

export const SoundStageSchema = z.object({
  ...StageBase,
  /** The filled-in sound plan from the method, as text. */
  plan: z.string().max(1600).optional(),
});

export const PolishStageSchema = z.object({
  ...StageBase,
  /** The pre-ship checklist as the agent ran it — one line per item, with a verdict. */
  checklist: z.array(z.string().max(200)).max(80).default([]),
});

export const ProcessSchema = z.object({
  brief: BriefStageSchema,
  concept: ConceptStageSchema,
  script: ScriptStageSchema,
  animatic: AnimaticStageSchema,
  style: StyleStageSchema,
  build: BuildStageSchema,
  sound: SoundStageSchema,
  polish: PolishStageSchema,
});

/** A fresh process: every stage pending, nothing submitted. */
export const EMPTY_PROCESS: z.infer<typeof ProcessSchema> = {
  brief: { status: "pending" },
  concept: { status: "pending", directions: [] },
  script: { status: "pending", beats: [] },
  animatic: { status: "pending", beats: [] },
  style: { status: "pending", clipIds: [] },
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
      .literal(PROJECT_FILE_VERSION)
      .describe(`File format version. Always ${PROJECT_FILE_VERSION}.`),
    name: z.string().min(1).max(80).describe("Human-readable title."),
    width: z.number().int().min(64).max(4096).default(DEFAULT_WIDTH),
    height: z.number().int().min(64).max(4096).default(DEFAULT_HEIGHT),
    fps: z.number().int().min(1).max(60).default(DEFAULT_FPS),
    durationInFrames: z.number().int().min(1).max(MAX_FRAMES),
    background: BackgroundSchema.default({ kind: "solid", color: "#0A0A0C" }),
    tracks: z.array(TrackSchema).max(MAX_TRACKS).default([]),
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
 * A composition as the app holds it: the file, plus where it came from and what
 * is selected. The extra fields never reach disk — see `toProjectFile`.
 */
export const FilmProjectSchema = z.object({
  file: ProjectFileSchema,
  /** The folder under `.prismlaunch` this was read from. */
  slug: z.string(),
  /** Track or clip id. Null when nothing is selected. */
  selectedId: z.string().nullable(),
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
  return z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
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
