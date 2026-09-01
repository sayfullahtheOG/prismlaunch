import { z } from "zod";

/**
 * The scene graph — the single source of truth for the whole product.
 *
 * The canvas preview, the scene inspector, the WebMCP tool executors, and the
 * render route all consume exactly these schemas. There is no second
 * definition of the graph anywhere: TypeScript types are derived with
 * `z.infer` (see types/prism.ts), and the JSON Schema handed to agents is
 * derived with `z.toJSONSchema` (see toolInputJsonSchema below).
 *
 * Why one definition matters: WebMCP's `inputSchema` is a *hint to the model*
 * and enforces nothing at runtime — verified against live Chrome, which passes
 * missing required fields and unexpected properties straight through to the
 * handler. Every `execute` therefore re-validates with the same schema the UI
 * uses. Deriving one from the other is what stops them drifting.
 *
 * See context/architecture.md §Invariants 8 and 9.
 */

export const FPS = 24;

/** Per-scene duration bounds, in frames at 24fps (3s–6s). */
export const MIN_SCENE_FRAMES = 72;
export const MAX_SCENE_FRAMES = 144;

/** The finished film must land in this window. */
export const MIN_FILM_SECONDS = 16;
export const MAX_FILM_SECONDS = 22;

export const HEADLINE_MAX = 56;
export const BODY_MAX = 110;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ArtDirectionSchema = z.enum([
  "minimal-dark",
  "electric-editorial",
  "warm-playful",
]);

export const SceneTemplateSchema = z.enum([
  "kinetic-type",
  "product-reveal",
  "component-spotlight",
  "outcome-cta",
]);

export const MotionPresetSchema = z.enum(["drift", "snap", "orbit"]);

export const ApprovalStateSchema = z.enum(["accepted", "draft"]);

export const EmphasisSchema = z.enum([
  "problem",
  "product",
  "feature",
  "outcome",
]);

export const SceneIdSchema = z.enum([
  "scene-01",
  "scene-02",
  "scene-03",
  "scene-04",
]);

/**
 * Scene order is fixed and derivable from the id, but carried explicitly so a
 * scene is meaningful on its own in a tool result.
 */
export const SceneOrderSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

// ---------------------------------------------------------------------------
// Leaf objects
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

export const PaletteSchema = z.object({
  background: z.string().regex(HEX, "expected a 6-digit hex colour"),
  primary: z.string().regex(HEX, "expected a 6-digit hex colour"),
  accent: z.string().regex(HEX, "expected a 6-digit hex colour"),
  text: z.string().regex(HEX, "expected a 6-digit hex colour"),
});

/**
 * Everything here is derived from a user's repository and is therefore
 * untrusted. It is truncated and escaped at the extraction layer
 * (lib/source/sanitize.ts); the caps below are a second line of defence so an
 * oversized snippet can never reach a tool result or the DOM.
 */
export const SourceEvidenceSchema = z.object({
  path: z.string().min(1).max(300),
  exportName: z.string().max(120).optional(),
  snippet: z.string().max(400),
  reason: z.string().max(240),
});

export const ComponentCandidateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  label: z.string().min(1).max(80),
  kind: z.enum(["page", "component", "feature"]),
  evidence: z.array(SourceEvidenceSchema).max(5),
  visualTokens: z.array(z.string().max(40)).max(8),
});

export const ProductManifestSchema = z.object({
  source: z.enum(["demo", "github-public", "local"]),
  repository: z
    .object({
      owner: z.string().max(120),
      repo: z.string().max(120),
      defaultBranch: z.string().max(120),
    })
    .optional(),
  productName: z.string().min(1).max(80),
  description: z.string().max(300),
  framework: z.enum(["next", "react", "unknown"]),
  componentCandidates: z.array(ComponentCandidateSchema).max(6),
  inspectionWarnings: z.array(z.string().max(240)).max(10),
});

export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  origin: z.enum(["human", "agent"]),
  /** Tool name for agent events, plain label for human ones. */
  label: z.string().min(1).max(120),
  detail: z.string().max(240),
  at: z.string().min(1).max(40),
  sceneId: SceneIdSchema.optional(),
  /** A proposal the agent cannot carry out alone — e.g. a render request. */
  blocked: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export const SceneSchema = z.object({
  id: SceneIdSchema,
  order: SceneOrderSchema,
  template: SceneTemplateSchema,
  durationFrames: z
    .number()
    .int()
    .min(MIN_SCENE_FRAMES)
    .max(MAX_SCENE_FRAMES),
  headline: z.string().min(1).max(HEADLINE_MAX),
  body: z.string().max(BODY_MAX).optional(),
  componentId: z.string().max(80).optional(),
  motionPreset: MotionPresetSchema,
  emphasis: EmphasisSchema,
  approval: ApprovalStateSchema,
  /** What the agent changed. Present only while `approval === "draft"`. */
  revisionNote: z.string().max(240).optional(),
  /** Kept so "Keep current" can restore, and so the diff is showable. */
  previousHeadline: z.string().max(HEADLINE_MAX).optional(),
});

/**
 * The fixed four-scene structure.
 *
 * Constraint is what makes the output good in the available time: exactly four
 * scenes, in a fixed template order, totalling 16–22 seconds. There is no
 * reordering and no fifth scene (context/project-overview.md §Scope).
 */
export const SceneGraphSchema = z
  .array(SceneSchema)
  .length(4)
  .superRefine((scenes, ctx) => {
    const EXPECTED: ReadonlyArray<{
      id: string;
      order: number;
      template: string;
    }> = [
      { id: "scene-01", order: 1, template: "kinetic-type" },
      { id: "scene-02", order: 2, template: "product-reveal" },
      { id: "scene-03", order: 3, template: "component-spotlight" },
      { id: "scene-04", order: 4, template: "outcome-cta" },
    ];

    EXPECTED.forEach((expected, index) => {
      const scene = scenes[index];
      if (!scene) return;
      if (scene.id !== expected.id || scene.order !== expected.order) {
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `scene ${index + 1} must be ${expected.id} with order ${expected.order}`,
        });
      }
      if (scene.template !== expected.template) {
        ctx.addIssue({
          code: "custom",
          path: [index, "template"],
          message: `${expected.id} must use the ${expected.template} template`,
        });
      }
    });

    const seconds = scenes.reduce((sum, s) => sum + s.durationFrames, 0) / FPS;
    if (seconds < MIN_FILM_SECONDS || seconds > MAX_FILM_SECONDS) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: `film must run ${MIN_FILM_SECONDS}–${MAX_FILM_SECONDS}s, got ${seconds.toFixed(1)}s`,
      });
    }
  });

export const BriefSchema = z.object({
  promise: z.string().min(1).max(160),
  selectedComponentIds: z.array(z.string().max(80)).max(3),
  artDirection: ArtDirectionSchema,
});

/**
 * `component-spotlight` is the only template that requires a component, and
 * that component must actually exist in the manifest. This can only be checked
 * once the scenes and the manifest are together, so it lives here rather than
 * on SceneSchema.
 */
export const FilmProjectSchema = z
  .object({
    id: z.string().min(1),
    product: ProductManifestSchema,
    brief: BriefSchema,
    scenes: SceneGraphSchema,
    activeSceneId: SceneIdSchema,
    activity: z.array(ActivityEventSchema).max(200),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((project, ctx) => {
    const known = new Set(
      project.product.componentCandidates.map((candidate) => candidate.id),
    );

    project.scenes.forEach((scene, index) => {
      if (scene.template !== "component-spotlight") return;

      if (!scene.componentId) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "componentId"],
          message: "component-spotlight requires a componentId",
        });
        return;
      }

      if (!known.has(scene.componentId)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "componentId"],
          message: `unknown componentId "${scene.componentId}" — not in the manifest`,
        });
      }
    });
  });

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
 * Tool executors return this instead of throwing: the spec's contract is that
 * a tool surfaces a meaningful validation failure rather than silently
 * truncating or failing opaquely.
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
