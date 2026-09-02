import type { z } from "zod";
import {
  confirmRender,
  createProject,
  flushWrites,
  focusScene,
  getProjectContext,
  openProject,
  requestRender,
  reviseSceneDraft,
  setPlayback,
  writeStoryboard,
  type ActionResult,
} from "@/lib/studio/actions";
import {
  ConfirmRenderInput,
  CreateProjectInput,
  EmptyInput,
  FocusSceneInput,
  OpenProjectInput,
  PreviewInput,
  RequestRenderInput,
  ReviseSceneInput,
  WriteStoryboardInput,
  explainZodError,
  toolInputJsonSchema,
} from "@/lib/studio/schema";
import type { JsonSchema, ModelContextTool } from "./types";

/**
 * The nine tools PrismLaunch registers on the studio page.
 *
 * Three rules hold across every one of them:
 *
 * 1. **Each tool wraps an existing action.** There is no tool-only code path,
 *    so anything an agent does produces exactly the visible result a human
 *    click would (context/architecture.md invariant 1).
 *
 * 2. **Each executor validates its own input.** Chrome does not check input
 *    against `inputSchema` — verified against a live implementation: missing
 *    required fields and unexpected properties reach the handler untouched.
 *    A validation failure returns a corrective sentence rather than throwing,
 *    because the agent can act on the former (invariant 8).
 *
 * 3. **Anything that writes flushes to disk before returning.** The film lives
 *    in the person's folder, so a tool that says it wrote something must have
 *    written it — an agent reading `project.json` on the next line has to find
 *    what it was just told about.
 *
 * These tools cover what a file cannot do: opening a film on someone's screen,
 * putting a scene in front of them, playing it, proposing a render. An agent
 * with file tools does the authoring by editing `project.json` directly and
 * the studio picks it up within a second — `write_storyboard` exists so that
 * an agent *without* file access is not locked out.
 *
 * Descriptions are authored here as literals and never built from user content
 * (invariant 6).
 *
 * Notably absent: any tool that accepts a draft or approves a render.
 * `acceptDraft`, `keepCurrent` and `approveRender` exist as actions but are
 * deliberately not wrapped, so the agent has no function to call (invariant 2).
 */

type Executor<S extends z.ZodType> = (
  input: z.infer<S>,
) => Promise<ActionResult> | ActionResult;

/**
 * Wrap a Zod schema and an action into a tool. Centralising the parse means a
 * tool cannot accidentally skip validation.
 */
function tool<S extends z.ZodType>(config: {
  name: string;
  description: string;
  schema: S;
  annotations?: ModelContextTool["annotations"];
  execute: Executor<S>;
}): ModelContextTool {
  return {
    name: config.name,
    description: config.description,
    inputSchema: toolInputJsonSchema(config.schema) as JsonSchema,
    ...(config.annotations ? { annotations: config.annotations } : {}),
    execute: async (raw) => {
      const parsed = config.schema.safeParse(raw ?? {});
      if (!parsed.success) {
        return `Invalid input — ${explainZodError(parsed.error)}`;
      }

      // Awaiting here is what guarantees the visible state has already changed
      // by the time the agent reads the result (invariant 3).
      const result = await config.execute(parsed.data);

      // …and this extends the same guarantee to the file on disk.
      if (config.annotations?.readOnlyHint !== true) await flushWrites();

      return result.ok ? result.message : `Could not do that — ${result.message}`;
    },
  };
}

/** One scene as the schema accepts it, as the action wants it. */
function toDraft(scene: z.infer<typeof WriteStoryboardInput>["scenes"][number]) {
  return {
    headline: scene.headline,
    durationFrames: scene.durationFrames,
    motionPreset: scene.motionPreset,
    emphasis: scene.emphasis,
    ...(scene.body ? { body: scene.body } : {}),
    ...(scene.feature ? { feature: scene.feature } : {}),
  };
}

export function buildTools(): ModelContextTool[] {
  return [
    tool({
      name: "prism.get_project_context",
      description:
        "Where things stand: whether the person has linked a project folder, which films are in it, and — if one is open — its four scenes, their copy, and which are still unreviewed drafts. Call this first, before anything else. If no folder is linked it tells you what the person has to click.",
      schema: EmptyInput,
      annotations: { readOnlyHint: true },
      execute: () => ({ ok: true, message: JSON.stringify(getProjectContext()) }),
    }),

    tool({
      name: "prism.create_project",
      description:
        "Create a new film at .prismlaunch/<slug>/project.json in the linked folder and open it. Writes four empty placeholder scenes for you to fill — it does not write any copy. Needs a folder to be linked first.",
      schema: CreateProjectInput,
      execute: (input) =>
        createProject({
          slug: input.slug,
          name: input.name,
          productName: input.productName,
          promise: input.promise,
          ...(input.productDescription
            ? { productDescription: input.productDescription }
            : {}),
          ...(input.artDirection ? { artDirection: input.artDirection } : {}),
        }),
    }),

    tool({
      name: "prism.open_project",
      description:
        "Show a film that already exists in the linked folder, by its folder name. Use the slugs from get_project_context.",
      schema: OpenProjectInput,
      execute: (input) => openProject(input.slug),
    }),

    tool({
      name: "prism.write_storyboard",
      description:
        "Write all four scenes at once: the hook, the product reveal, one feature, the outcome. Four scenes together because the film is one argument and the 16–22 second budget belongs to the set. Scene 3 needs a `feature`. Everything lands as a DRAFT for the person to accept — you cannot accept it yourself. If you have file tools you can edit project.json directly instead; the studio picks it up within a second.",
      schema: WriteStoryboardInput,
      execute: (input) => {
        // Destructured rather than mapped: the schema guarantees four, and a
        // cast would be the only other way to tell TypeScript that.
        const [one, two, three, four] = input.scenes;
        return writeStoryboard(
          [toDraft(one), toDraft(two), toDraft(three), toDraft(four)],
          input.note,
        );
      },
    }),

    tool({
      name: "prism.revise_scene",
      description:
        "Change exactly one scene — its headline, supporting line, featured detail, motion, or emphasis. The change lands as a DRAFT for the person to accept or reject. You cannot accept it yourself.",
      schema: ReviseSceneInput,
      execute: (input) => {
        const { sceneId, revisionNote, ...patch } = input;
        return reviseSceneDraft(sceneId, patch, revisionNote);
      },
    }),

    tool({
      name: "prism.focus_scene",
      description:
        "Select one scene and put it in front of the person, so you are both looking at the shot you are talking about.",
      schema: FocusSceneInput,
      annotations: { readOnlyHint: true },
      execute: (input) => focusScene(input.sceneId),
    }),

    tool({
      name: "prism.preview_storyboard",
      description:
        "Play the film on the person's screen — the whole board or a single scene. Use this after writing, so they watch what you made rather than reading your description of it.",
      schema: PreviewInput,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        input.mode === "scene" && input.sceneId
          ? setPlayback({ kind: "scene", sceneId: input.sceneId })
          : setPlayback({ kind: "film" }),
    }),

    tool({
      name: "prism.request_render",
      description:
        "Propose exporting the finished film as an MP4. This renders NOTHING: it records what would be rendered and raises a confirmation in the app. The person must approve it, and only then can confirm_render proceed. Fails while any scene is still an unreviewed draft.",
      schema: RequestRenderInput,
      execute: (input) => requestRender(input.reason),
    }),

    tool({
      name: "prism.confirm_render",
      description:
        "Start the render that request_render proposed, using the confirmation id it returned. This only works after the person has approved that confirmation in the app — the id alone is not permission, and retrying will not change that. The MP4 is encoded in their browser and saved into the project folder.",
      schema: ConfirmRenderInput,
      execute: (input) => confirmRender(input.confirmationId),
    }),
  ];
}
