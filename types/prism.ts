import type { z } from "zod";
import type {
  ActivityEventSchema,
  ApprovalStateSchema,
  ArtDirectionSchema,
  BriefSchema,
  EmphasisSchema,
  FeatureSchema,
  FilmProjectSchema,
  MotionPresetSchema,
  PaletteSchema,
  ProductSchema,
  ProjectFileSchema,
  SceneIdSchema,
  SceneSchema,
  SceneTemplateSchema,
} from "@/lib/studio/schema";

/**
 * Every type in the product is inferred from a Zod schema — nothing here is
 * hand-written. If you find yourself declaring an interface that mirrors a
 * schema, the schema is the one that should change.
 *
 * See context/code-standards.md §TypeScript Standards.
 */

export type ArtDirection = z.infer<typeof ArtDirectionSchema>;
export type SceneTemplate = z.infer<typeof SceneTemplateSchema>;
export type MotionPreset = z.infer<typeof MotionPresetSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type Emphasis = z.infer<typeof EmphasisSchema>;
export type SceneId = z.infer<typeof SceneIdSchema>;

export type Palette = z.infer<typeof PaletteSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

/** What lives in `.prismlaunch/<slug>/project.json`. The agent writes this. */
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

/** The file, plus where it came from and what is selected. Never written to disk. */
export type FilmProject = z.infer<typeof FilmProjectSchema>;
