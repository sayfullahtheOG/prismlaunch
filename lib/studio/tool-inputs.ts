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
