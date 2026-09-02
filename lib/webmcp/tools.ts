import type { z } from "zod";
import {
  focusScene,
  getProjectContext,
  inspectSource,
  regenerateStoryboard,
  requestRender,
  confirmRender,
  reviseSceneDraft,
  setPlayback,
  type ActionResult,
} from "@/lib/studio/actions";
import {
  ConfirmRenderInput,
  CreateStoryboardInput,
  FocusSceneInput,
  InspectRepoInput,
  PreviewInput,
  RequestRenderInput,
  ReviseSceneInput,
  explainZodError,
  toolInputJsonSchema,
} from "@/lib/studio/schema";
import type { JsonSchema, ModelContextTool } from "./types";

/**
 * The eight tools PrismLaunch registers on the studio page.
 *
 * Two rules hold across every one of them:
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
 * Descriptions are authored here as literals and never built from repository
 * text (invariant 6).
 *
 * Notably absent: any tool that accepts a draft. `acceptDraft`/`keepCurrent`
 * exist as actions but are deliberately not wrapped, so the agent has no
 * function to call (invariant 2).
 */

type Executor<S extends z.ZodType> = (input: z.infer<S>) => Promise<ActionResult> | ActionResult;

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
      return result.ok ? result.message : `Could not do that — ${result.message}`;
    },
  };
}

export function buildTools(): ModelContextTool[] {
  return [
    tool({
      name: "prism.get_project_context",
      description:
        "Read the current launch film: the product, the creative brief, the four scenes with their copy and approval state, and the component candidates found in the source. Call this first, before proposing any change.",
      schema: RequestRenderInput.pick({}),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => {
        const context = getProjectContext();
        return { ok: true, message: JSON.stringify(context) };
      },
    }),

    tool({
      name: "prism.inspect_public_repo",
      description:
        "Read a public GitHub repository and rebuild the storyboard from what it finds. Only call this with a URL the person gave you — never invent or guess a repository. Reads a bounded set of files; it never runs the code.",
      schema: InspectRepoInput,
      annotations: { untrustedContentHint: true },
      execute: (input) =>
        inspectSource("github", input.repositoryUrl, input.focus ?? ""),
    }),

    tool({
      name: "prism.create_storyboard_draft",
      description:
        "Rebuild all four scenes from the current product and brief, optionally changing the art direction, the featured component, or the product promise. Use this to start a story over; use revise_scene_draft to adjust one shot.",
      schema: CreateStoryboardInput,
      execute: (input) => regenerateStoryboard(input),
    }),

    tool({
      name: "prism.focus_scene",
      description:
        "Select one scene and scroll its editor into view, so the person is looking at the shot you are talking about.",
      schema: FocusSceneInput,
      execute: (input) => focusScene(input.sceneId),
    }),

    tool({
      name: "prism.revise_scene_draft",
      description:
        "Propose changes to exactly one scene — its headline, supporting line, featured component, motion, or emphasis. The change lands as a DRAFT for the person to accept or reject. You cannot accept it yourself.",
      schema: ReviseSceneInput,
      execute: (input) => {
        const { sceneId, revisionNote, ...patch } = input;
        return reviseSceneDraft(sceneId, patch, revisionNote);
      },
    }),

    tool({
      name: "prism.preview_storyboard",
      description:
        "Play the film in the shared canvas — either the whole board or a single scene — so the person can watch what you changed.",
      schema: PreviewInput,
      execute: (input) =>
        input.mode === "scene" && input.sceneId
          ? setPlayback({ kind: "scene", sceneId: input.sceneId })
          : setPlayback({ kind: "film" }),
    }),

    tool({
      name: "prism.request_render",
      description:
        "Propose exporting the finished film as an MP4. This renders NOTHING: it records what would be rendered and raises a confirmation in the app. The person must approve it, and only then can confirm_render proceed.",
      schema: RequestRenderInput,
      execute: (input) => requestRender(input.reason),
    }),

    tool({
      name: "prism.confirm_render",
      description:
        "Start the render that request_render proposed, using the confirmation id it returned. This only works after the person has approved that confirmation in the app — the id alone is not permission.",
      schema: ConfirmRenderInput,
      execute: (input) => confirmRender(input.confirmationId),
    }),
  ];
}
