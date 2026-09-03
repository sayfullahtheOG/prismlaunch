import { z } from "zod";
import {
  AnimationSchema,
  AssetPathSchema,
  AudioClipSchema,
  BackgroundSchema,
  BoxSchema,
  ELEMENT_KINDS,
  ImageClipSchema,
  MAX_FRAMES,
  MAX_TEXT_LENGTH,
  MotionSchema,
  ShapeClipSchema,
  SlugSchema,
  StageIdSchema,
  TextClipSchema,
  TrackKindSchema,
  VideoClipSchema,
} from "./schema";
import { LIBRARY } from "./library";

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

type StripDefault<F> = F extends z.ZodDefault<infer Inner> ? Inner : F;
type PatchShape<T extends z.ZodRawShape> = { [K in keyof T]: z.ZodOptional<StripDefault<T[K]>> };

/**
 * A field made optional without its default.
 *
 * Zod applies a default to an absent optional field, so `fontSize.optional()`
 * on an update input parsed a missing size as 0.09, and every update_clip
 * quietly reset the size, colour and volume it did not mention. "Send only
 * the fields you are changing" needs the field to stay absent.
 */
function loose<F extends z.ZodType>(field: F): z.ZodOptional<StripDefault<F>> {
  const bare = field instanceof z.ZodDefault ? field.removeDefault() : field;
  return (bare as z.ZodType).optional() as z.ZodOptional<StripDefault<F>>;
}

/** The same for a whole object: every field optional, no field defaulted. */
function patchOf<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<PatchShape<T>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) shape[key] = loose(field as z.ZodType);
  return z.object(shape) as unknown as z.ZodObject<PatchShape<T>>;
}

const visualExtras = {
  box: patchOf(BoxSchema)
    .optional()
    .describe(
      "Position and size as fractions of the canvas. x/y are the CENTRE, so { x: 0.5, y: 0.5 } is centred. Defaults to a centred band.",
    ),
  animation: patchOf(AnimationSchema)
    .optional()
    .describe("How it enters and leaves. Defaults to no animation."),
  motion: patchOf(MotionSchema)
    .optional()
    .describe(
      "One move over the clip's life: x/y how far the box travels in canvas fractions, scale what it grows to, frames how long (0 is the whole clip), delay when it starts, easing 'out' | 'in-out' | 'linear', press to dip once on arrival like a click. Defaults to still.",
    ),
};

const reveal = {
  reveal: loose(TextClipSchema.shape.reveal)
    .describe(
      "How the words arrive: 'type' a character at a time, 'words' one word after another, 'count' runs the first number in the text up from zero. Defaults to none.",
    ),
  revealFrames: loose(TextClipSchema.shape.revealFrames)
    .describe("How many frames the reveal takes from the clip's first frame. Defaults to 30."),
  caret: loose(TextClipSchema.shape.caret)
    .describe("A blinking text caret after the words. Types along with 'type'."),
};

export const AddTextInput = z.object({
  ...timing,
  ...visualExtras,
  text: TextClipSchema.shape.text.describe("The words on screen."),
  fontSize: loose(TextClipSchema.shape.fontSize)
    .describe(
      "As a fraction of canvas height: 0.05 a caption, 0.09 a headline, 0.2 a hero word.",
    ),
  fontFamily: loose(TextClipSchema.shape.fontFamily),
  fontWeight: loose(TextClipSchema.shape.fontWeight)
    .describe("Only has an effect on the 'body' family."),
  color: loose(TextClipSchema.shape.color),
  align: loose(TextClipSchema.shape.align),
  lineHeight: loose(TextClipSchema.shape.lineHeight),
  letterSpacing: loose(TextClipSchema.shape.letterSpacing),
  ...reveal,
});

export const AddShapeInput = z.object({
  ...timing,
  ...visualExtras,
  shape: ShapeClipSchema.shape.shape,
  fill: loose(ShapeClipSchema.shape.fill),
  radius: loose(ShapeClipSchema.shape.radius),
});

export const AddImageInput = z.object({
  ...timing,
  ...visualExtras,
  src: ImageClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/logo.png'. The file has to exist — put it there first.",
  ),
  fit: loose(ImageClipSchema.shape.fit),
  radius: loose(ImageClipSchema.shape.radius),
});

export const AddVideoInput = z.object({
  ...timing,
  ...visualExtras,
  src: VideoClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/screen-capture.mp4'.",
  ),
  fit: loose(VideoClipSchema.shape.fit),
  startFrom: loose(VideoClipSchema.shape.startFrom)
    .describe("Frame to start at inside the source file. Trims its head."),
  volume: loose(VideoClipSchema.shape.volume)
    .describe("0 by default — video on a timeline is usually silent."),
  playbackRate: loose(VideoClipSchema.shape.playbackRate),
});

export const AddAudioInput = z.object({
  ...timing,
  src: AudioClipSchema.shape.src.describe(
    "Path inside the project folder, e.g. 'assets/voiceover.mp3'.",
  ),
  startFrom: loose(AudioClipSchema.shape.startFrom),
  volume: loose(AudioClipSchema.shape.volume),
  fadeInFrames: loose(AudioClipSchema.shape.fadeInFrames),
  fadeOutFrames: loose(AudioClipSchema.shape.fadeOutFrames),
  playbackRate: loose(AudioClipSchema.shape.playbackRate),
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
  box: visualExtras.box,
  animation: visualExtras.animation,
  motion: visualExtras.motion,
  text: loose(TextClipSchema.shape.text),
  fontSize: loose(TextClipSchema.shape.fontSize),
  color: loose(TextClipSchema.shape.color),
  fill: loose(ShapeClipSchema.shape.fill),
  volume: loose(AudioClipSchema.shape.volume),
  ...reveal,
});

export const RemoveClipInput = z.object({
  clipId: z.string().min(1).max(60),
});

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/**
 * One flat shape for every kind of element.
 *
 * A discriminated union would be the honest type, but a tool's input schema
 * is read by a model choosing what to send, and one object whose fields say
 * which kind they belong to is easier to get right than five branches. The
 * executor builds the right element from it and validates that; a missing
 * `src` on an image comes back as a sentence, not a schema mismatch.
 */
const elementIdentity = {
  name: z
    .string()
    .min(1)
    .max(40)
    .describe("What it is for: 'Headline', 'Support', 'Label', 'Accent rule', 'Device frame', 'Product shot', 'Music bed'."),
  role: z
    .string()
    .max(40)
    .optional()
    .describe("A grouping word, optional: 'type', 'device', 'motif', 'product', 'sound'."),
  note: z
    .string()
    .max(240)
    .optional()
    .describe("One sentence on what this element is for. Shown to the person."),
};

const elementFields = {
  // text
  text: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe("text only. Default words. Usually omitted for a type style — the words arrive when it is placed."),
  fontSize: loose(TextClipSchema.shape.fontSize)
    .describe("text only. As a fraction of canvas height: 0.045 a caption, 0.09 a headline, 0.2 a hero word."),
  fontFamily: loose(TextClipSchema.shape.fontFamily).describe("text only."),
  fontWeight: loose(TextClipSchema.shape.fontWeight).describe("text only. Only the 'body' family has weights."),
  color: loose(TextClipSchema.shape.color).describe("text only."),
  align: loose(TextClipSchema.shape.align).describe("text only."),
  lineHeight: loose(TextClipSchema.shape.lineHeight).describe("text only."),
  letterSpacing: loose(TextClipSchema.shape.letterSpacing).describe("text only."),
  reveal: reveal.reveal.describe("text only. 'type', 'words' or 'count'; how the words arrive."),
  revealFrames: reveal.revealFrames.describe("text only. Frames the reveal takes."),
  caret: reveal.caret.describe("text only. A blinking caret after the words."),
  // shape
  shape: loose(ShapeClipSchema.shape.shape).describe("shape only. Defaults to rect."),
  fill: loose(ShapeClipSchema.shape.fill).describe("shape only."),
  radius: loose(ShapeClipSchema.shape.radius)
    .describe("shape, image, video. Corner radius as a fraction of the shorter side; 0.5 rounds a rect into a pill."),
  // media
  src: AssetPathSchema.optional().describe(
    "image, video, audio. Path inside the project folder, e.g. 'assets/app.png'. The file must already be there.",
  ),
  fit: loose(ImageClipSchema.shape.fit).describe("image, video."),
  startFrom: loose(VideoClipSchema.shape.startFrom).describe("video, audio. Frame to start at inside the file."),
  volume: loose(AudioClipSchema.shape.volume).describe("video, audio. Video defaults to 0."),
  playbackRate: loose(AudioClipSchema.shape.playbackRate).describe("video, audio."),
  fadeInFrames: loose(AudioClipSchema.shape.fadeInFrames).describe("audio only."),
  fadeOutFrames: loose(AudioClipSchema.shape.fadeOutFrames).describe("audio only."),
  // visual
  box: patchOf(BoxSchema)
    .optional()
    .describe("Every visual kind. The default position and size, in canvas fractions; a placement can override it."),
  animation: patchOf(AnimationSchema)
    .optional()
    .describe("Every visual kind. The default enter and exit; a placement can override it."),
  motion: patchOf(MotionSchema)
    .optional()
    .describe("Every visual kind. The default move over a clip's life; a placement can override it. See add_text."),
};

export const AddElementInput = z.object({
  kind: z
    .enum(ELEMENT_KINDS)
    .describe("text: a type style. shape: a rule, a block, a dot. image or video: a file in the project folder. audio: a file for an audio track."),
  ...elementIdentity,
  ...elementFields,
});

export const UpdateElementInput = z.object({
  elementId: z.string().min(1).max(60).describe("From get_project_context."),
  name: elementIdentity.name.optional(),
  role: elementIdentity.role,
  note: z
    .string()
    .max(240)
    .optional()
    .describe("One sentence on what you changed and why. Shown on every clip that follows this element."),
  ...elementFields,
});

export const AddFromLibraryInput = z.object({
  itemId: z
    .enum(LIBRARY.map((item) => item.id) as [string, ...string[]])
    .describe(
      "Which prebuilt piece. Motion: cursor, tap-ring, typewriter, word-by-word, counter, highlight. Type: headline, support, label, blank-type. Shapes: accent-rule, device, pill, dot, panel, blank-shape. Sound: sfx-whoosh, sfx-click, sfx-tick, sfx-impact, sfx-rise. Music: bed-calm, bed-upbeat, bed-cinematic.",
    ),
  name: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe("What to call the element. Defaults to the piece's own name."),
  note: z
    .string()
    .max(240)
    .optional()
    .describe("One sentence on what it is for. Shown to the person."),
});

export const RemoveElementInput = z.object({
  elementId: z.string().min(1).max(60),
});

export const PlaceElementInput = z.object({
  elementId: z.string().min(1).max(60).describe("From get_project_context."),
  ...timing,
  text: z
    .string()
    .min(1)
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe("The words, for a text style. Required unless the element has default words."),
  ...visualExtras,
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

export const WaitForDecisionInput = z.object({
  stage: StageIdSchema.optional().describe(
    "Which stage to wait on. Default: the one that is submitted and waiting.",
  ),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(600)
    .optional()
    .describe("How long to wait before returning \"still waiting\", so you can call again. Default 25, kept short so the call fits any harness."),
});

export const CaptureFramesInput = z.object({
  layout: z
    .enum(["sheet", "single"])
    .optional()
    .describe(
      "How the frames come back. \"sheet\" (default): six frames per image as a storyboard page, three across — the cheapest way to read a sequence. \"single\": one image per frame at full width — for looking at one or two moments closely, or if a grid is hard to read. Single costs one image per frame.",
    ),
  every: z
    .number()
    .positive()
    .max(60)
    .optional()
    .describe("Seconds between frames, e.g. 1 for one per second, 0.5 for two. Default 1."),
  from: z
    .number()
    .min(0)
    .max(300)
    .optional()
    .describe("Start of the window, in seconds. Default: the start of the film."),
  to: z
    .number()
    .min(0)
    .max(300)
    .optional()
    .describe("End of the window, in seconds, inclusive. Default: the end of the film."),
  at: z
    .array(z.number().min(0).max(300))
    .max(24)
    .optional()
    .describe("Exact moments in seconds instead of a cadence, e.g. [6, 6.2, 6.4] to watch one transition closely."),
  width: z
    .number()
    .int()
    .min(240)
    .max(960)
    .optional()
    .describe("Width of each frame in pixels. Default 480 on a sheet, 960 for single. Go larger to read small text, smaller for a cheap overview."),
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

export const SubmitStoryboardInput = z.object({
  panels: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        beatId: z.string().max(40).optional().describe("The script beat this boards."),
        label: z.string().min(1).max(40).describe("'Hook', 'Reveal', 'Proof 1'…"),
        frame: z
          .string()
          .min(1)
          .max(280)
          .describe("What is on screen: ground, composition, type role, the product if shown. A sentence a designer could draw from."),
        action: z.string().max(240).optional().describe("What moves, in what order."),
        durationInFrames: z
          .number()
          .int()
          .min(6)
          .max(9000)
          .describe("At 30fps. From the script's seconds, adjusted to the beat grid once you have chosen music."),
        // Defaulted here rather than mapped in the executor, so the parsed
        // panel is already the shape the stage artifact wants.
        transitionIn: z
          .enum(["none", "fade", "rise", "fall", "slide-left", "slide-right", "scale", "blur"])
          .default("fade")
          .describe("Defaults to fade."),
        transitionOut: z
          .enum(["none", "fade", "rise", "fall", "slide-left", "slide-right", "scale", "blur"])
          .default("fade")
          .describe("Defaults to fade."),
        sound: z.string().max(140).optional().describe("What the music or SFX does here."),
        words: z.string().max(160).optional().describe("The on-screen words, if any. Under seven."),
      }),
    )
    .min(2)
    .max(40)
    .describe("One panel per script beat, in order. Board the first, then the last, then fill between."),
  summary,
});

export const LayAnimaticInput = z.object({});

export const SubmitAnimaticInput = z.object({ summary });

export const SubmitStyleFramesInput = z.object({
  look: z
    .enum(["void", "paper", "editorial", "spec", "custom"])
    .describe("Which look from PRISM_METHOD.md §7, or 'custom' if you built your own."),
  elementIds: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(60)
    .describe("The elements the look is made of — at least the headline style. From prism.add_element."),
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
