import { z } from "zod";
import {
  AnimationSchema,
  AssetPathSchema,
  AudioClipSchema,
  BackgroundSchema,
  BoxSchema,
  CameraMoveSchema,
  DeviceClipSchema,
  ELEMENT_KINDS,
  HtmlClipSchema,
  IconClipSchema,
  ImageClipSchema,
  MAX_CAMERA_MOVES,
  MAX_FRAMES,
  MAX_TEXT_LENGTH,
  MotionSchema,
  ParticlesClipSchema,
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
      "Position and size as fractions of the canvas. x/y are the CENTRE, so { x: 0.5, y: 0.5 } is centred. tiltX/tiltY are perspective degrees: tiltX leans it back like a card on a desk, tiltY turns it like a door; ±12 floats a product shot, ±30 is a phone flying past. Defaults to a centred, flat band.",
    ),
  animation: patchOf(AnimationSchema)
    .optional()
    .describe(
      "How it enters and leaves. enter/exit: none, fade, rise, fall, slide-left, slide-right, scale, blur, pop (out of focus and a touch large, settling — the kinetic word), zoom (through the camera), flip (a card turning up), wipe (a true mask, left to right). travel: how far rise/fall/slides move in canvas fractions (0.03 settles, 0.25 arrives from off-stage). spring: overshoot on the enter, 0–1 (0.3 lands past and settles; never on text). Defaults to no animation.",
    ),
  motion: patchOf(MotionSchema)
    .optional()
    .describe(
      "One move over the clip's life: x/y how far the box travels in canvas fractions, scale what it grows to, frames how long (0 is the whole clip), delay when it starts, easing 'out' | 'in-out' | 'linear', press to dip once on arrival like a click, rotate degrees turned by the end, opacity and blur (0–1) at the end, arc −1..1 to bow the path, spring 0–1 to land past the mark and settle, trail true for a streak behind it. Defaults to still.",
    ),
  shadow: loose(TextClipSchema.shape.shadow)
    .describe("Depth, 0–1: a soft tinted shadow under it. 0.3 a card, 0.6 a phone in the air. Default 0."),
  glow: loose(TextClipSchema.shape.glow)
    .describe("A halo in its own colour, 0–1. Ration it. Default 0."),
  blur: loose(TextClipSchema.shape.blur)
    .describe("Defocus held for the whole clip, 0–1: a wall of text or a screenshot behind the subject. Default 0."),
};

const reveal = {
  reveal: loose(TextClipSchema.shape.reveal)
    .describe(
      "How the words arrive: 'type' a character at a time, 'words' one word after another, 'count' runs the first number in the text up from zero. Defaults to none.",
    ),
  revealFrames: loose(TextClipSchema.shape.revealFrames)
    .describe("How many frames the reveal takes from the clip's first frame; with revealStagger set, how long each word takes. Defaults to 30."),
  revealStagger: loose(TextClipSchema.shape.revealStagger)
    .describe("For 'words': frames between one word starting and the next. 6–9 is a kinetic line; 15 appends a word at a time. 0 spreads the words across revealFrames."),
  revealStyle: loose(TextClipSchema.shape.revealStyle)
    .describe("For 'words': how each word lands — 'rise' (default), 'fade', 'pop' (out of focus and a touch large, settling), 'blur'."),
  caret: loose(TextClipSchema.shape.caret)
    .describe("A blinking text caret after the words. Types along with 'type'."),
};

export const AddTextInput = z.object({
  ...timing,
  ...visualExtras,
  text: TextClipSchema.shape.text.describe(
    "The words on screen. Wrap a run in asterisks to set it in `accent`: \"Turn *books* into audio\".",
  ),
  fontSize: loose(TextClipSchema.shape.fontSize)
    .describe(
      "As a fraction of canvas height: 0.05 a caption, 0.09 a headline, 0.2 a hero word.",
    ),
  fontFamily: loose(TextClipSchema.shape.fontFamily),
  fontWeight: loose(TextClipSchema.shape.fontWeight)
    .describe("Only has an effect on the 'body' family."),
  color: loose(TextClipSchema.shape.color),
  accent: loose(TextClipSchema.shape.accent)
    .describe("The colour of the *starred* words — the two-tone line. Unset, the stars are printed."),
  align: loose(TextClipSchema.shape.align),
  lineHeight: loose(TextClipSchema.shape.lineHeight),
  letterSpacing: loose(TextClipSchema.shape.letterSpacing),
  fill: loose(TextClipSchema.shape.fill)
    .describe("A colour behind the words filling the box: a button, a chip. Pair with radius 0.5 for a pill."),
  radius: loose(TextClipSchema.shape.radius)
    .describe("Corner radius of the fill, as a fraction of the box's shorter side. 0.5 is a pill."),
  ...reveal,
});

export const AddShapeInput = z.object({
  ...timing,
  ...visualExtras,
  shape: ShapeClipSchema.shape.shape,
  fill: loose(ShapeClipSchema.shape.fill),
  fillTo: loose(ShapeClipSchema.shape.fillTo)
    .describe("A second colour makes the fill a gradient, from fill to this, along fillAngle."),
  fillAngle: loose(ShapeClipSchema.shape.fillAngle)
    .describe("Degrees. 90 runs left to right, 180 top to bottom. Default 180."),
  radius: loose(ShapeClipSchema.shape.radius),
});

const iconFields = {
  icon: loose(IconClipSchema.shape.icon)
    .describe("Which icon: check, x, plus, minus, arrow-right, arrow-up-right, chevron-right, chevron-down, sparkle, star, heart, bolt, play, search, circle, cursor, hand. sparkle, star, heart, bolt, play and cursor are filled; the rest are outlines."),
  stroke: loose(IconClipSchema.shape.stroke)
    .describe("Stroke width for the outlined icons, 0.5–4. Default 2."),
  draw: loose(IconClipSchema.shape.draw)
    .describe("true draws the stroke on over the enter, like a pen — a check drawing itself under \"Done\"."),
};

export const AddIconInput = z.object({
  ...timing,
  ...visualExtras,
  icon: IconClipSchema.shape.icon.describe(iconFields.icon.description ?? ""),
  color: loose(IconClipSchema.shape.color),
  stroke: iconFields.stroke,
  draw: iconFields.draw,
});

const particleFields = {
  style: loose(ParticlesClipSchema.shape.style)
    .describe("confetti (up from the box centre, falling and spinning), burst (every direction), sparkles (twinkling points inside the box), rise (drifting up through the box). Default confetti."),
  count: loose(ParticlesClipSchema.shape.count).describe("How many pieces, 1–400. 90 is a payoff; 24 is sparkles. Default 80."),
  colors: loose(ParticlesClipSchema.shape.colors)
    .describe("One to six hex colours the pieces are drawn from. Default the accent blue, its light, and a pink."),
  spread: loose(ParticlesClipSchema.shape.spread).describe("How far they fly, 0–1 of the canvas. Default 0.6."),
  gravity: loose(ParticlesClipSchema.shape.gravity).describe("How hard they fall, 0–2. 0 floats. Default 1."),
  size: loose(ParticlesClipSchema.shape.size).describe("Size of a piece as a fraction of canvas height. Default 0.016."),
  seed: loose(ParticlesClipSchema.shape.seed).describe("Any integer; the same seed is the same burst every time."),
};

export const AddParticlesInput = z.object({
  ...timing,
  ...visualExtras,
  ...particleFields,
});

const deviceFields = {
  device: loose(DeviceClipSchema.shape.device)
    .describe("phone (bezel and island), browser (title bar with three dots), window (a hairline and a shadow), card (a plain white panel). Default browser."),
  screen: loose(DeviceClipSchema.shape.screen)
    .describe("The screen colour when there is no screenshot, and the ground under one. Default white."),
  frame: loose(DeviceClipSchema.shape.frame).describe("The bezel, the title bar, the hairline. Default near-black."),
};

export const AddDeviceInput = z.object({
  ...timing,
  ...visualExtras,
  ...deviceFields,
  src: AssetPathSchema.optional().describe(
    "The screenshot, a path inside the project folder like 'assets/app.png'. Optional; without it the screen is the `screen` colour.",
  ),
  fit: loose(DeviceClipSchema.shape.fit),
  radius: loose(DeviceClipSchema.shape.radius).describe("Corner radius as a fraction of the shorter side. Default 0.06; a phone wants ~0.14."),
});

const htmlFields = {
  html: HtmlClipSchema.shape.html.describe(
    "One self-contained snippet: markup with an inline <style>. No scripts, no external files; images by their assets/ path. Fonts: var(--font-body), var(--font-display), var(--font-mono). Bring it alive with data-in=\"12\" (arrives at frame 12; add rise, fade or blur after the frame for the style, pop is the default), data-out=\"80\", data-press=\"40\" (a click), data-lift=\"30\" (a hover), data-count=\"12\" (its number counts up over 30 frames), data-type=\"12\" (its text types); var(--frame) is the current frame for your own CSS.",
  ),
  width: loose(HtmlClipSchema.shape.width).describe(
    "The width the snippet was written for, in CSS px; it is scaled so that width fills the box. Default 800.",
  ),
};

export const AddHtmlInput = z.object({
  ...timing,
  ...visualExtras,
  ...htmlFields,
});

export const SetCameraInput = z.object({
  moves: z
    .array(
      z.object({
        from: CameraMoveSchema.shape.from.describe("The composition frame the move starts on."),
        frames: loose(CameraMoveSchema.shape.frames).describe("How long the move takes. 15–24 for a push. Default 20."),
        x: loose(CameraMoveSchema.shape.x).describe("Where the camera looks by the end, in canvas fractions. Default 0.5."),
        y: loose(CameraMoveSchema.shape.y).describe("Default 0.5."),
        scale: loose(CameraMoveSchema.shape.scale).describe("How close: 1 the whole canvas, 1.6 a push into a region, 0.8 pulled back. Default 1."),
        easing: loose(CameraMoveSchema.shape.easing).describe("'in-out' (default), 'out' or 'linear'."),
      }),
    )
    .max(MAX_CAMERA_MOVES)
    .describe(
      "Every move of the camera, in order; this replaces the whole list. The camera holds between moves and starts at the centre at ×1. An empty list stills it. At most four in a film, none faster than 15 frames.",
    ),
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

/**
 * Every property a clip has, patchable. A tool that can set a colour but
 * not a font family sends the agent back to deleting and re-adding, which
 * loses the id, the approval trail and the person's patience.
 */
export const UpdateClipInput = z.object({
  clipId: z.string().min(1).max(60).describe("From get_project_context."),
  note: z
    .string()
    .min(1)
    .max(240)
    .describe("One sentence on what you changed and why. Shown to the person."),
  trackId: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe("Move the clip to this layer. Audio stays on audio layers, visuals on visual ones."),
  from: z.number().int().min(0).max(MAX_FRAMES).optional(),
  durationInFrames: z.number().int().min(1).max(MAX_FRAMES).optional(),
  label: z.string().max(60).optional(),
  box: visualExtras.box,
  animation: visualExtras.animation,
  motion: visualExtras.motion,
  shadow: visualExtras.shadow,
  glow: visualExtras.glow,
  blur: visualExtras.blur,
  text: loose(TextClipSchema.shape.text),
  fontSize: loose(TextClipSchema.shape.fontSize),
  fontFamily: loose(TextClipSchema.shape.fontFamily),
  fontWeight: loose(TextClipSchema.shape.fontWeight),
  color: loose(TextClipSchema.shape.color).describe("text, icon."),
  accent: loose(TextClipSchema.shape.accent).describe("text: the colour of the *starred* words."),
  align: loose(TextClipSchema.shape.align),
  lineHeight: loose(TextClipSchema.shape.lineHeight),
  letterSpacing: loose(TextClipSchema.shape.letterSpacing),
  ...reveal,
  shape: loose(ShapeClipSchema.shape.shape),
  fill: loose(ShapeClipSchema.shape.fill).describe("shape; text (a colour behind the words)."),
  fillTo: loose(ShapeClipSchema.shape.fillTo).describe("shape: the gradient's second colour."),
  fillAngle: loose(ShapeClipSchema.shape.fillAngle).describe("shape: the gradient's angle."),
  radius: loose(ShapeClipSchema.shape.radius).describe("shape, text fill, image, video, device."),
  src: AssetPathSchema.optional().describe("Swap the file behind an image, video, audio or device clip."),
  fit: loose(ImageClipSchema.shape.fit),
  startFrom: loose(VideoClipSchema.shape.startFrom),
  volume: loose(AudioClipSchema.shape.volume),
  playbackRate: loose(AudioClipSchema.shape.playbackRate),
  fadeInFrames: loose(AudioClipSchema.shape.fadeInFrames),
  fadeOutFrames: loose(AudioClipSchema.shape.fadeOutFrames),
  icon: iconFields.icon.describe("icon: which one."),
  stroke: iconFields.stroke.describe("icon: stroke width."),
  draw: iconFields.draw.describe("icon: draw the stroke on over the enter."),
  style: particleFields.style.describe("particles: confetti, burst, sparkles, rise."),
  count: particleFields.count.describe("particles."),
  colors: particleFields.colors.describe("particles."),
  spread: particleFields.spread.describe("particles."),
  gravity: particleFields.gravity.describe("particles."),
  size: particleFields.size.describe("particles."),
  seed: particleFields.seed.describe("particles."),
  device: deviceFields.device.describe("device: phone, browser, window, card."),
  screen: deviceFields.screen.describe("device: the screen colour."),
  frame: deviceFields.frame.describe("device: the bezel colour."),
  html: loose(HtmlClipSchema.shape.html).describe("html: the snippet. See add_html."),
  width: htmlFields.width.describe("html: the width the snippet was written for, in px."),
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
  color: loose(TextClipSchema.shape.color).describe("text, icon."),
  accent: loose(TextClipSchema.shape.accent).describe("text only. The colour of the *starred* words."),
  align: loose(TextClipSchema.shape.align).describe("text only."),
  lineHeight: loose(TextClipSchema.shape.lineHeight).describe("text only."),
  letterSpacing: loose(TextClipSchema.shape.letterSpacing).describe("text only."),
  reveal: reveal.reveal.describe("text only. 'type', 'words' or 'count'; how the words arrive."),
  revealFrames: reveal.revealFrames.describe("text only. Frames the reveal takes; per word with revealStagger."),
  revealStagger: reveal.revealStagger.describe("text only. Frames between words for 'words'."),
  revealStyle: reveal.revealStyle.describe("text only. rise, fade, pop or blur."),
  caret: reveal.caret.describe("text only. A blinking caret after the words."),
  // shape
  shape: loose(ShapeClipSchema.shape.shape).describe("shape only. Defaults to rect."),
  fill: loose(ShapeClipSchema.shape.fill).describe("shape; text (a colour behind the words)."),
  fillTo: loose(ShapeClipSchema.shape.fillTo).describe("shape only. The gradient's second colour."),
  fillAngle: loose(ShapeClipSchema.shape.fillAngle).describe("shape only. The gradient's angle."),
  radius: loose(ShapeClipSchema.shape.radius)
    .describe("shape, text fill, image, video, device. Corner radius as a fraction of the shorter side; 0.5 rounds a rect into a pill."),
  // media
  src: AssetPathSchema.optional().describe(
    "image, video, audio, device. Path inside the project folder, e.g. 'assets/app.png'. The file must already be there.",
  ),
  fit: loose(ImageClipSchema.shape.fit).describe("image, video, device."),
  startFrom: loose(VideoClipSchema.shape.startFrom).describe("video, audio. Frame to start at inside the file."),
  volume: loose(AudioClipSchema.shape.volume).describe("video, audio. Video defaults to 0."),
  playbackRate: loose(AudioClipSchema.shape.playbackRate).describe("video, audio."),
  fadeInFrames: loose(AudioClipSchema.shape.fadeInFrames).describe("audio only."),
  fadeOutFrames: loose(AudioClipSchema.shape.fadeOutFrames).describe("audio only."),
  // icon, particles, device
  icon: iconFields.icon.describe("icon only. Which one."),
  stroke: iconFields.stroke.describe("icon only."),
  draw: iconFields.draw.describe("icon only. Draw the stroke on over the enter."),
  style: particleFields.style.describe("particles only. confetti, burst, sparkles, rise."),
  count: particleFields.count.describe("particles only."),
  colors: particleFields.colors.describe("particles only."),
  spread: particleFields.spread.describe("particles only."),
  gravity: particleFields.gravity.describe("particles only."),
  size: particleFields.size.describe("particles only."),
  seed: particleFields.seed.describe("particles only."),
  device: deviceFields.device.describe("device only. phone, browser, window, card."),
  screen: deviceFields.screen.describe("device only."),
  frame: deviceFields.frame.describe("device only."),
  html: loose(HtmlClipSchema.shape.html).describe("html only. The snippet — see add_html for the data attributes that make it move."),
  width: htmlFields.width.describe("html only. The width the snippet was written for, in px."),
  // visual
  box: patchOf(BoxSchema)
    .optional()
    .describe("Every visual kind. The default position and size, in canvas fractions, with tiltX/tiltY in degrees; a placement can override it."),
  animation: patchOf(AnimationSchema)
    .optional()
    .describe("Every visual kind. The default enter and exit, with travel and spring; a placement can override it."),
  motion: patchOf(MotionSchema)
    .optional()
    .describe("Every visual kind. The default move over a clip's life; a placement can override it. See add_text."),
  shadow: visualExtras.shadow.describe("Every visual kind. Depth, 0–1."),
  glow: visualExtras.glow.describe("Every visual kind. A halo, 0–1."),
  blur: visualExtras.blur.describe("Every visual kind. Defocus, 0–1."),
};

export const AddElementInput = z.object({
  kind: z
    .enum(ELEMENT_KINDS)
    .describe("text: a type style. shape: a rule, a block, a dot, a gradient bar. image or video: a file in the project folder. icon: a check, an arrow, a sparkle. particles: confetti, a burst, sparkles. device: a phone, browser, window or card around a screenshot. html: a component of the product rebuilt from its source, alive frame by frame. audio: a file for an audio track."),
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
      "Which prebuilt piece. Motion: cursor, hand-cursor, tap-ring, typewriter, word-by-word, kinetic-line, counter, progress-bar, check, sparkle-trail, confetti, sparkles, live-card, highlight. Type: headline, support, label, blank-type. Shapes: accent-rule, device, phone, browser, window, card, pill, button, gradient-bar, dot, panel, blank-shape. Sound: sfx-whoosh, sfx-click, sfx-tick, sfx-typing, sfx-impact, sfx-rise. Music: bed-calm, bed-upbeat, bed-cinematic, bed-bright (120 BPM), bed-minimal (90 BPM).",
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
          .describe("Out of 12, from the six tests in PRISM_METHOD.md §5."),
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
        action: z
          .string()
          .max(240)
          .optional()
          .describe("The events, in order, with frames: what arrives, what it does, what leaves. 'Line pops in 6f, holds 18f, out 5f; phone flies in 20f, drifts.'"),
        handoff: z
          .string()
          .max(140)
          .optional()
          .describe("What is still on screen when the next panel starts — the object that carries the cut. 'The phone, flying left, dragging the bar.'"),
        durationInFrames: z
          .number()
          .int()
          .min(6)
          .max(9000)
          .describe("At 30fps: the SUM of the events' frames in `action`, never a budget chosen first. Then nudged onto the beat grid once you have chosen music."),
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

export const SubmitPolishInput = z.object({
  checklist: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(80)
    .describe("Each line of the §12 checklist you ran against the rough, with its verdict: '✓ two events per second', '✗ the cut at f240 has no handoff — the phone now carries it'."),
  soundPlan: z
    .string()
    .max(1600)
    .optional()
    .describe("The sound, rethought against the person's notes: the filled-in plan from PRISM_METHOD.md §9. The build places it."),
  summary,
});
