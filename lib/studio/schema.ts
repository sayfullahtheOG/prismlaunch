import { z } from "zod";

/**
 * The scene graph — the single source of truth for the whole product.
 *
 * These schemas are now a *file format* as well as a runtime guard. An agent
 * writes `.prismlaunch/<slug>/project.json` with its own file tools;
 * `ProjectFileSchema` is exactly what it must write, and public/SKILL.md is
 * the prose version of the same thing. If the two ever disagree, this file is
 * right and SKILL.md is stale.
 *
 * PrismLaunch has no model of its own and does not read anyone's source. The
 * agent decides what the film says; we validate the structure, render it,
 * hold the approval gate, and write the result back to disk.
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

/**
 * Bumped only when a change would make an older `project.json` unreadable.
 * A file carrying a version we do not know is refused with its number quoted,
 * rather than parsed optimistically into something subtly wrong.
 */
export const PROJECT_FILE_VERSION = 1;

/** The directory an agent writes into, at the root of whatever it is working on. */
export const WORKSPACE_DIR = ".prismlaunch";

/** The one file that defines a film. */
export const PROJECT_FILE = "project.json";

/** Finished MP4s land here, beside the project that produced them. */
export const RENDERS_DIR = "renders";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ArtDirectionSchema = z.enum([
  "minimal-dark",
  "electric-editorial",
  "warm-playful",
]);

/**
 * Four templates in a fixed order. Renamed from `component-spotlight`: the app
 * no longer reads anyone's source, so a scene spotlights a *feature the agent
 * names*, not a component we found.
 */
export const SceneTemplateSchema = z.enum([
  "kinetic-type",
  "product-reveal",
  "feature-spotlight",
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
 * What the spotlight scene is about.
 *
 * `visualTokens` are short words the renderer arranges into a suggestion of an
 * interface — "command", "search", "results" draws something palette-shaped.
 * They are decoration, not a screenshot, and the film never claims otherwise.
 */
export const FeatureSchema = z.object({
  label: z.string().min(1).max(40),
  visualTokens: z.array(z.string().min(1).max(24)).max(6).default([]),
});

export const ProductSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).default(""),
});

export const BriefSchema = z.object({
  promise: z.string().min(1).max(160),
  artDirection: ArtDirectionSchema,
});

/**
 * The session log. Not written to disk — it describes what happened in this
 * tab, not what the film is. The file is the film; this is the account of who
 * touched it while you were watching.
 */
export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  origin: z.enum(["human", "agent", "disk"]),
  /** Tool name for agent events, plain label for the others. */
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
  /** Required on `feature-spotlight`, meaningless elsewhere. */
  feature: FeatureSchema.optional(),
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
 * Constraint is what makes the output good, and it is most of what PrismLaunch
 * contributes now that the agent writes the words: exactly four scenes, in a
 * fixed template order, totalling 16–22 seconds. There is no reordering and no
 * fifth scene. An agent that tries to write a nine-minute slideshow gets a
 * validation error naming the rule it broke.
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
      { id: "scene-03", order: 3, template: "feature-spotlight" },
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

    // The spotlight scene is the only one that needs more than words.
    const spotlight = scenes[2];
    if (spotlight && spotlight.template === "feature-spotlight" && !spotlight.feature) {
      ctx.addIssue({
        code: "custom",
        path: [2, "feature"],
        message:
          "scene-03 needs a feature: { label, visualTokens } naming what it shows",
      });
    }

    const seconds = scenes.reduce((sum, s) => sum + s.durationFrames, 0) / FPS;
    if (seconds < MIN_FILM_SECONDS || seconds > MAX_FILM_SECONDS) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: `film must run ${MIN_FILM_SECONDS}–${MAX_FILM_SECONDS}s, got ${seconds.toFixed(1)}s`,
      });
    }
  });

// ---------------------------------------------------------------------------
// The file on disk
// ---------------------------------------------------------------------------

/**
 * `.prismlaunch/<slug>/project.json`, in full.
 *
 * This is the contract between the agent and the app. It holds only what the
 * film IS — no selection state, no session history, nothing about the browser
 * — so two people opening the same folder see the same film, and a diff of
 * this file is a diff of the video.
 */
export const ProjectFileSchema = z.object({
  version: z
    .literal(PROJECT_FILE_VERSION)
    .describe("File format version. Always 1."),
  name: z.string().min(1).max(80).describe("Human-readable title for the film."),
  product: ProductSchema,
  brief: BriefSchema,
  scenes: SceneGraphSchema,
});

/**
 * A film as the app holds it: the file, plus where it came from and what is
 * selected. The extra fields never reach disk — see `toProjectFile`.
 */
export const FilmProjectSchema = ProjectFileSchema.extend({
  /** The folder under `.prismlaunch` this was read from. */
  slug: SlugSchema,
  activeSceneId: SceneIdSchema,
  activity: z.array(ActivityEventSchema).max(200),
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

// ---------------------------------------------------------------------------
// WebMCP tool inputs
// ---------------------------------------------------------------------------

/**
 * One schema per tool. These drive both the `inputSchema` an agent sees
 * (via `toolInputJsonSchema`) and the runtime `.parse()` inside each executor.
 *
 * `.describe()` matters more than usual here: it becomes the JSON Schema
 * description the model reads when deciding how to call the tool, so it is the
 * cheapest place to prevent a malformed call.
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
  productName: z.string().min(1).max(60).describe("What the product is called."),
  productDescription: z
    .string()
    .max(300)
    .optional()
    .describe("One or two sentences on what the product does."),
  promise: z
    .string()
    .min(1)
    .max(160)
    .describe("The one sentence the film has to land."),
  artDirection: ArtDirectionSchema.optional().describe(
    "Visual treatment. Defaults to minimal-dark.",
  ),
});

/** A scene as an agent submits it — no approval state; the app decides that. */
const SceneDraftInput = z.object({
  headline: z
    .string()
    .min(1)
    .max(HEADLINE_MAX)
    .describe(`The scene's main line. At most ${HEADLINE_MAX} characters.`),
  body: z
    .string()
    .max(BODY_MAX)
    .optional()
    .describe(`Optional supporting line. At most ${BODY_MAX} characters.`),
  durationFrames: z
    .number()
    .int()
    .min(MIN_SCENE_FRAMES)
    .max(MAX_SCENE_FRAMES)
    .describe(
      `How long the scene runs, in frames at ${FPS}fps. ${MIN_SCENE_FRAMES}–${MAX_SCENE_FRAMES}. The four must total ${MIN_FILM_SECONDS}–${MAX_FILM_SECONDS} seconds.`,
    ),
  motionPreset: MotionPresetSchema.describe(
    "drift is slow and premium, snap is decisive, orbit is playful.",
  ),
  emphasis: EmphasisSchema,
  feature: FeatureSchema.optional().describe(
    "Required on scene-03 only: what the spotlight shows.",
  ),
});

export const WriteStoryboardInput = z.object({
  scenes: z
    .tuple([
      SceneDraftInput,
      SceneDraftInput,
      SceneDraftInput,
      SceneDraftInput,
    ])
    .describe(
      "All four scenes in order: the hook, the product reveal, one feature, the outcome.",
    ),
  note: z
    .string()
    .max(240)
    .optional()
    .describe("One sentence on your approach. Shown to the human."),
});

export const ReviseSceneInput = z.object({
  sceneId: SceneIdSchema.describe("Which scene to revise."),
  headline: z
    .string()
    .min(1)
    .max(HEADLINE_MAX)
    .optional()
    .describe(`The scene's main line. At most ${HEADLINE_MAX} characters.`),
  body: z
    .string()
    .max(BODY_MAX)
    .optional()
    .describe(`Optional supporting line. At most ${BODY_MAX} characters.`),
  feature: FeatureSchema.optional().describe(
    "Only meaningful on the feature-spotlight scene.",
  ),
  motionPreset: MotionPresetSchema.optional(),
  emphasis: EmphasisSchema.optional(),
  revisionNote: z
    .string()
    .min(1)
    .max(240)
    .describe("One sentence on what you changed and why. Shown to the human."),
});

export const FocusSceneInput = z.object({
  sceneId: SceneIdSchema.describe("Which of the four scenes to select."),
});

export const PreviewInput = z.object({
  mode: z
    .enum(["scene", "film"])
    .default("film")
    .describe("Play just the active scene, or the whole board."),
  sceneId: SceneIdSchema.optional().describe(
    "Scene to play. Required when mode is 'scene'.",
  ),
});

export const RequestRenderInput = z.object({
  reason: z
    .string()
    .max(200)
    .optional()
    .describe("Why you think the film is ready. Shown to the human."),
});

export const ConfirmRenderInput = z.object({
  confirmationId: z
    .string()
    .min(1)
    .max(120)
    .describe("The id request_render returned. Only works once a human approves it."),
});
