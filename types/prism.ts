import type { z } from "zod";
import type {
  AnimationSchema,
  AssetPathSchema,
  AudioClipSchema,
  AudioElementSchema,
  ElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  TextElementSchema,
  VideoElementSchema,
  BackgroundSchema,
  BoxSchema,
  ClipSchema,
  ColorSchema,
  FilmProjectSchema,
  FitSchema,
  FontFamilySchema,
  ImageClipSchema,
  ProcessSchema,
  ProjectFileSchema,
  ScriptBeatSchema,
  SelectionSchema,
  DirectionSchema,
  LockedBeatSchema,
  LookSchema,
  MotionSchema,
  RevealSchema,
  StageIdSchema,
  StageStatusSchema,
  StoryboardPanelSchema,
  ShapeClipSchema,
  TextAlignSchema,
  TextClipSchema,
  TrackKindSchema,
  TrackSchema,
  TransitionSchema,
  VideoClipSchema,
  VisualClipSchema,
} from "@/lib/studio/schema";

/**
 * Every type in the product is inferred from a Zod schema — nothing here is
 * hand-written. If you find yourself declaring an interface that mirrors a
 * schema, the schema is the one that should change.
 *
 * See context/code-standards.md §TypeScript Standards.
 */

export type Color = z.infer<typeof ColorSchema>;
export type Box = z.infer<typeof BoxSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type Motion = z.infer<typeof MotionSchema>;
export type Reveal = z.infer<typeof RevealSchema>;
export type FontFamily = z.infer<typeof FontFamilySchema>;
export type TextAlign = z.infer<typeof TextAlignSchema>;
export type Fit = z.infer<typeof FitSchema>;
export type AssetPath = z.infer<typeof AssetPathSchema>;

export type TextClip = z.infer<typeof TextClipSchema>;
export type ShapeClip = z.infer<typeof ShapeClipSchema>;
export type ImageClip = z.infer<typeof ImageClipSchema>;
export type VideoClip = z.infer<typeof VideoClipSchema>;
export type AudioClip = z.infer<typeof AudioClipSchema>;
export type VisualClip = z.infer<typeof VisualClipSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type ClipKind = Clip["kind"];

/**
 * A clip before it has an id — what `createClip` mints one for.
 *
 * Spelled out per kind rather than as `Omit<Clip, "id">`, because `Omit` on
 * a union keeps only the keys every member shares and loses `text`, `src`
 * and the rest. This distributes.
 */
export type ClipDraft = {
  [K in ClipKind]: Omit<Extract<Clip, { kind: K }>, "id">;
}[ClipKind];

export type TextElement = z.infer<typeof TextElementSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type VideoElement = z.infer<typeof VideoElementSchema>;
export type AudioElement = z.infer<typeof AudioElementSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type ElementKind = Element["kind"];

/** An element before it has an id. Distributive, for the same reason as `ClipDraft`. */
export type ElementDraft = {
  [K in ElementKind]: Omit<Extract<Element, { kind: K }>, "id">;
}[ElementKind];

export type TrackKind = z.infer<typeof TrackKindSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Background = z.infer<typeof BackgroundSchema>;

export type StageId = z.infer<typeof StageIdSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export type Process = z.infer<typeof ProcessSchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type ScriptBeat = z.infer<typeof ScriptBeatSchema>;
export type LockedBeat = z.infer<typeof LockedBeatSchema>;
export type StoryboardPanel = z.infer<typeof StoryboardPanelSchema>;
export type Look = z.infer<typeof LookSchema>;

/** What lives in `.prismlaunch/<slug>/project.json`. The agent writes this. */
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

/** The file, plus where it came from and what is selected. Never written to disk. */
export type FilmProject = z.infer<typeof FilmProjectSchema>;

export type Selection = z.infer<typeof SelectionSchema>;

export type ActivityEvent = FilmProject["activity"][number];
