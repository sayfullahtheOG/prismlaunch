import { z } from "zod";
import {
  AnimationSchema,
  AudioClipSchema,
  BackgroundSchema,
  BoxSchema,
  ImageClipSchema,
  MAX_FRAMES,
  ShapeClipSchema,
  SlugSchema,
  TextClipSchema,
  TrackKindSchema,
  VideoClipSchema,
} from "./schema";

/**
 * One schema per tool.
 *
 * These drive both the `inputSchema` an agent sees (via `toolInputJsonSchema`)
 * and the runtime `.parse()` inside each executor. They live apart from
 * schema.ts because they answer a different question: that file describes what
 * a composition IS, this one describes what an agent may ask for.
 *
 * `.describe()` matters more than usual here. It becomes the JSON Schema
 * description the model reads when deciding how to call the tool, so it is the
 * cheapest place in the codebase to prevent a malformed call — cheaper than a
 * validation message, because the agent never makes the mistake.
 */

export const EmptyInput = z.object({});

export const OpenProjectInput = z.object({
  slug: SlugSchema.describe(
    "Folder name under .prismlaunch, as listed by get_project_context.",
  ),
});

export const CreateProjectInput = z.object({
  slug: SlugSchema.describe(
    "Folder name to create under .prismlaunch, e.g. 'vector-launch'.",
  ),
  name: z
    .string()
    .min(1)
    .max(80)
    .describe("Human-readable title, e.g. 'Vector launch video'."),
  durationSeconds: z
    .number()
    .min(0.5)
    .max(300)
    .optional()
    .describe(
      "Usually omit this. A new composition starts with no runtime and grows automatically as you place clips, so you do not have to guess a length up front.",
    ),
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  fps: z.number().int().min(1).max(60).optional().describe("Defaults to 30."),
  background: BackgroundSchema.optional(),
});

export const AddTrackInput = z.object({
  kind: TrackKindSchema.describe(
    "'visual' for anything you can see, 'audio' for music, voiceover or effects. Visual tracks stack above the background, audio below it.",
  ),
  name: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe("What this layer is for, e.g. 'Titles' or 'Voiceover'."),
});

export const TrackIdInput = z.object({
  trackId: z.string().min(1).max(60).describe("From get_project_context."),
});

export const UpdateTrackInput = z.object({
  trackId: z.string().min(1).max(60),
  name: z.string().min(1).max(40).optional(),
  hidden: z
    .boolean()
    .optional()
    .describe("Hides a visual track, mutes an audio one."),
  volume: z.number().min(0).max(1).optional(),
});

export const MoveTrackInput = z.object({
  trackId: z.string().min(1).max(60),
  direction: z
    .enum(["forward", "back"])
    .describe(
      "'forward' moves the layer towards the front of the picture, 'back' behind its neighbours. Cannot cross between visual and audio.",
    ),
});

/**
 * A clip as an agent submits it.
 *
 * `id` and `approval` are deliberately absent. The id is minted by the app so
 * an agent cannot collide with something already in the file, and the approval
 * state is not the agent's to set — everything it adds is a draft.
 */
const timing = {
  trackId: z
    .string()
    .min(1)
    .max(60)
    .describe("Which layer to put it on. From get_project_context."),
  from: z
    .number()
    .int()
    .min(0)
    .max(MAX_FRAMES)
    .describe("First frame. Multiply seconds by the composition's fps."),
  durationInFrames: z
    .number()
    .int()
    .min(1)
    .max(MAX_FRAMES)
    .describe("How long it stays. Again in frames, not seconds."),
  label: z
    .string()
    .max(60)
    .optional()
    .describe("A short name for the timeline chip. Optional."),
  note: z
    .string()
    .max(240)
    .optional()
    .describe("One sentence on what this is for. Shown to the person on review."),
};

const visualExtras = {
  box: BoxSchema.partial()
    .optional()
    .describe(
      "Position and size as fractions of the canvas. x/y are the CENTRE, so { x: 0.5, y: 0.5 } is centred. Defaults to a centred band.",
    ),
  animation: AnimationSchema.partial()
    .optional()
    .describe("How it enters and leaves. Defaults to no animation."),
};

export const AddTextInput = z.object({
  ...timing,
  ...visualExtras,
  text: TextClipSchema.shape.text.describe("The words on screen."),
  fontSize: TextClipSchema.shape.fontSize
    .optional()
    .describe(
      "As a fraction of canvas height: 0.05 a caption, 0.09 a headline, 0.2 a hero word.",
    ),
  fontFamily: TextClipSchema.shape.fontFamily.optional(),
  fontWeight: TextClipSchema.shape.fontWeight
    .optional()
    .describe("Only has an effect on the 'body' family."),
  color: TextClipSchema.shape.color.optional(),
  align: TextClipSchema.shape.align.optional(),
  lineHeight: TextClipSchema.shape.lineHeight.optional(),
  letterSpacing: TextClipSchema.shape.letterSpacing.optional(),
});

export const AddShapeInput = z.object({
  ...timing,
  ...visualExtras,
  shape: ShapeClipSchema.shape.shape,
  fill: ShapeClipSchema.shape.fill.optional(),
  radius: ShapeClipSchema.shape.radius.optional(),
});

export const AddImageInput = z.object({
  ...timing,
  ...visualExtras,
  src: ImageClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/logo.png'. The file has to exist — put it there first.",
  ),
  fit: ImageClipSchema.shape.fit.optional(),
  radius: ImageClipSchema.shape.radius.optional(),
});

export const AddVideoInput = z.object({
  ...timing,
  ...visualExtras,
  src: VideoClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/screen-capture.mp4'.",
  ),
  fit: VideoClipSchema.shape.fit.optional(),
  startFrom: VideoClipSchema.shape.startFrom
    .optional()
    .describe("Frame to start at inside the source file. Trims its head."),
  volume: VideoClipSchema.shape.volume
    .optional()
    .describe("0 by default — video on a timeline is usually silent."),
  playbackRate: VideoClipSchema.shape.playbackRate.optional(),
});

export const AddAudioInput = z.object({
  ...timing,
  src: AudioClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/voiceover.mp3'.",
  ),
  startFrom: AudioClipSchema.shape.startFrom.optional(),
  volume: AudioClipSchema.shape.volume.optional(),
  fadeInFrames: AudioClipSchema.shape.fadeInFrames.optional(),
  fadeOutFrames: AudioClipSchema.shape.fadeOutFrames.optional(),
  playbackRate: AudioClipSchema.shape.playbackRate.optional(),
});

export const UpdateClipInput = z.object({
  clipId: z.string().min(1).max(60).describe("From get_project_context."),
  note: z
    .string()
    .min(1)
    .max(240)
    .describe("One sentence on what you changed and why. Shown to the person."),
  from: z.number().int().min(0).max(MAX_FRAMES).optional(),
  durationInFrames: z.number().int().min(1).max(MAX_FRAMES).optional(),
  box: BoxSchema.partial().optional(),
  animation: AnimationSchema.partial().optional(),
  text: TextClipSchema.shape.text.optional(),
  fontSize: TextClipSchema.shape.fontSize.optional(),
  color: TextClipSchema.shape.color.optional(),
  fill: ShapeClipSchema.shape.fill.optional(),
  volume: AudioClipSchema.shape.volume.optional(),
});

export const RemoveClipInput = z.object({
  clipId: z.string().min(1).max(60),
});

export const SetBackgroundInput = z.object({
  background: BackgroundSchema,
});

export const SetDurationInput = z.object({
  durationSeconds: z
    .number()
    .min(0.5)
    .max(300)
    .describe("New length of the whole composition."),
});

export const SeekInput = z.object({
  seconds: z
    .number()
    .min(0)
    .max(300)
    .describe("Where to put the playhead, so the person sees that moment."),
});

export const PreviewInput = z.object({
  play: z
    .boolean()
    .default(true)
    .describe("True to start playing, false to pause."),
  fromSeconds: z
    .number()
    .min(0)
    .max(300)
    .optional()
    .describe("Jump here first. Omit to play from where the playhead is."),
});

export const RequestRenderInput = z.object({
  reason: z
    .string()
    .max(200)
    .optional()
    .describe("Why you think it is ready. Shown to the human."),
});

export const ConfirmRenderInput = z.object({
  confirmationId: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "The id request_render returned. Only works once a human approves it.",
    ),
});

// ---------------------------------------------------------------------------
// The process
// ---------------------------------------------------------------------------

/**
 * One submit tool per stage. Each carries the stage's artifact plus a one-line
 * `summary` the person reads beside it. None carries a status: an agent
 * submits, and only the person approves.
 */

const summary = z
  .string()
  .max(300)
  .optional()
  .describe("One sentence on what you did and why. Shown to the person beside the artifact.");

export const SubmitBriefInput = z.object({
  audience: z
    .string()
    .min(1)
    .max(200)
    .describe("One kind of person, specifically. Not 'developers'."),
  message: z
    .string()
    .min(1)
    .max(200)
    .describe("The one sentence the film has to land. No commas, no 'and'."),
  feeling: z
    .string()
    .min(1)
    .max(40)
    .describe("One word: what they should feel. Relief, envy, recognition, calm."),
  lengthSeconds: z
    .number()
    .min(5)
    .max(180)
    .describe("15 is one idea, 30 is one idea with a turn, 45 is an idea with an escalation."),
  summary,
});

export const SubmitConceptsInput = z.object({
  directions: z
    .array(
      z.object({
        id: z.string().min(1).max(40).describe("Short handle, e.g. 'c1'."),
        title: z.string().min(1).max(60),
        line: z
          .string()
          .min(1)
          .max(200)
          .describe("The idea in one sentence with no 'and'."),
        angle: z
          .string()
          .max(40)
          .optional()
          .describe("Which lever produced it: 'the enemy', 'before/after', 'the contrast'…"),
        feel: z.string().max(24).optional().describe("The one-word feeling."),
        score: z
          .number()
          .int()
          .min(0)
          .max(12)
          .optional()
          .describe("Out of 12, from the six tests in PRISM_METHOD.md §3."),
      }),
    )
    .min(2)
    .max(4)
    .describe("Two to four directions. Three is right. Generated from 8–12 angles, not the first one."),
  recommended: z.string().min(1).max(40).describe("The id of the one you recommend."),
  summary,
});

export const SubmitScriptInput = z.object({
  beats: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().min(1).max(40).describe("'Hook', 'Reveal', 'Proof 1'…"),
        words: z
          .string()
          .max(160)
          .describe("The on-screen text, or the VO line. Under seven words if on screen."),
        seconds: z.number().min(0.3).max(20),
        sound: z.string().max(140).optional().describe("What the music or SFX does here."),
      }),
    )
    .min(2)
    .max(14)
    .describe("The film, beat by beat. Five to seven for 30 seconds."),
  voiceover: z
    .string()
    .max(800)
    .optional()
    .describe("The full VO if there is one. Never the same words as on screen."),
  summary,
});

export const SubmitAnimaticInput = z.object({ summary });

export const SubmitStyleFramesInput = z.object({
  look: z
    .enum(["void", "paper", "editorial", "spec", "custom"])
    .describe("Which look from PRISM_METHOD.md §7, or 'custom' if you built your own."),
  clipIds: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(12)
    .describe("The clips you built for real — the hook, the reveal, the endcard. Everything else copies these."),
  summary,
});

export const SubmitBuildInput = z.object({ summary });

export const SubmitSoundInput = z.object({
  plan: z
    .string()
    .max(1600)
    .optional()
    .describe("The filled-in sound plan from PRISM_METHOD.md §9, as text."),
  summary,
});

export const SubmitPolishInput = z.object({
  checklist: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(80)
    .describe("Each line of the §14 checklist you ran, with its verdict: '✓ first frame has content', '✗ two clips exit at 12f — fixed'."),
  summary,
});
