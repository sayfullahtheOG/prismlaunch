import type { z } from "zod";
import type {
  AnimationSchema,
  AssetPathSchema,
  AudioClipSchema,
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
  DirectionSchema,
  LockedBeatSchema,
  LookSchema,
  StageIdSchema,
  StageStatusSchema,
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

export type TrackKind = z.infer<typeof TrackKindSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Background = z.infer<typeof BackgroundSchema>;

export type StageId = z.infer<typeof StageIdSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export type Process = z.infer<typeof ProcessSchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type ScriptBeat = z.infer<typeof ScriptBeatSchema>;
export type LockedBeat = z.infer<typeof LockedBeatSchema>;
export type Look = z.infer<typeof LookSchema>;

/** What lives in `.prismlaunch/<slug>/project.json`. The agent writes this. */
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

/** The file, plus where it came from and what is selected. Never written to disk. */
export type FilmProject = z.infer<typeof FilmProjectSchema>;

export type ActivityEvent = FilmProject["activity"][number];
