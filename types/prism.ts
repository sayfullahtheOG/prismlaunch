import type { z } from "zod";
import type {
  ActivityEventSchema,
  ApprovalStateSchema,
  ArtDirectionSchema,
  BriefSchema,
  ComponentCandidateSchema,
  EmphasisSchema,
  FilmProjectSchema,
  MotionPresetSchema,
  PaletteSchema,
  ProductManifestSchema,
  SceneIdSchema,
  SceneSchema,
  SceneTemplateSchema,
  SourceEvidenceSchema,
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
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type ComponentCandidate = z.infer<typeof ComponentCandidateSchema>;
export type ProductManifest = z.infer<typeof ProductManifestSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type FilmProject = z.infer<typeof FilmProjectSchema>;
