import { ensureModelContext, detectKind, type ContextKind } from "./fallback";
import { buildTools } from "./tools";
import type { ModelContextTool, RegisterToolOptions } from "./types";

export const PRISM_TOOLSETS = {
  workflow: [
    "prism.get_project_context",
    "prism.create_project",
    "prism.open_project",
    "prism.submit_brief",
    "prism.submit_concepts",
    "prism.submit_script",
    "prism.submit_storyboard",
    "prism.lay_animatic",
    "prism.submit_animatic",
    "prism.submit_style_frames",
    "prism.submit_build",
    "prism.submit_polish",
    "prism.wait_for_decision",
  ],
  graphics: [
    "prism.get_project_context",
    "prism.add_track",
    "prism.update_track",
    "prism.move_track",
    "prism.remove_track",
    "prism.add_text",
    "prism.add_shape",
    "prism.add_icon",
    "prism.add_particles",
  ],
  media: [
    "prism.get_project_context",
    "prism.add_html",
    "prism.add_device",
    "prism.add_image",
    "prism.add_video",
    "prism.add_audio",
  ],
  elements: [
    "prism.get_project_context",
    "prism.add_element",
    "prism.update_element",
    "prism.remove_element",
    "prism.add_from_library",
    "prism.place_element",
  ],
  edit: [
    "prism.get_project_context",
    "prism.update_clip",
    "prism.remove_clip",
    "prism.set_background",
    "prism.set_camera",
    "prism.set_duration",
    "prism.seek",
    "prism.preview",
    "prism.capture_frames",
    "prism.request_render",
    "prism.confirm_render",
  ],
} as const;

export type PrismToolset = keyof typeof PRISM_TOOLSETS;
const TOOLSET_NAMES = Object.keys(PRISM_TOOLSETS) as PrismToolset[];
export const PRISM_TOOLSET_SWITCH = "prism.use_toolset";

function toolsetSwitcher(activate: (toolset: PrismToolset) => void): ModelContextTool {
  return {
    name: PRISM_TOOLSET_SWITCH,
    description:
      "Switch the visible PrismLaunch tools. workflow: project and 8 stages; graphics: tracks, text, shapes, icons, particles; media: HTML, devices, image, video, audio; elements: reusable styles/library/place; edit: update clips, canvas, preview, capture and render. Call again whenever another set is needed, then fetch tools again.",
    inputSchema: {
      type: "object",
      properties: {
        toolset: {
          type: "string",
          enum: TOOLSET_NAMES,
          description: "Tool group to expose.",
        },
      },
      required: ["toolset"],
    },
    execute: async (input) => {
      const toolset = input.toolset;
      if (typeof toolset !== "string" || !TOOLSET_NAMES.includes(toolset as PrismToolset)) {
        return `Invalid input — toolset must be one of: ${TOOLSET_NAMES.join(", ")}.`;
      }

      // Let the current call finish before unregistering the tool that serves it.
      setTimeout(() => activate(toolset as PrismToolset), 0);
      return `Switching to the ${toolset} toolset. Fetch tools again before the next call.`;
    },
  };
}

/**
 * Register one bounded toolset, and return a teardown that removes it.
 *
 * One AbortController for the whole set: aborting it unregisters all of them
 * at once, so tools never outlive the page that backs them. A stale tool
 * pointing at a dead store is worse than no tool
 * (context/architecture.md invariant 11).
 *
 * Called only from the studio client component — never inside an iframe, since
 * ChatGPT does not discover framed tools and fails silently (invariant 17).
 */
export type RegistrationResult = {
  kind: ContextKind;
  registered: number;
  /** Tools the browser refused to register, by name. Shown, never swallowed. */
  failed: string[];
  teardown: () => void;
};

/**
 * The canonical WebMCP registration call.
 *
 * Written against `document.modelContext` directly, which is the current spec
 * location and the shape the API is documented in:
 *
 *     document.modelContext.registerTool({ name, description, inputSchema, execute })
 *
 * `navigator.modelContext` is the deprecated alias that Chrome 149 — the
 * origin-trial floor — still ships, so it is tried second rather than being
 * hidden behind a resolver. Keeping both branches explicit means the call site
 * reads the way the spec does instead of dereferencing an opaque variable.
 */
async function registerOnModelContext(
  tool: ModelContextTool,
  options: RegisterToolOptions,
): Promise<boolean> {
  if (document.modelContext) {
    await document.modelContext.registerTool(tool, options);
    return true;
  }

  if (navigator.modelContext) {
    await navigator.modelContext.registerTool(tool, options);
    return true;
  }

  return false;
}

/**
 * The page's one registration, shared by every component that wants to know
 * about it.
 *
 * `useWebMcp` is called from more than one component, and each mount used
 * to run its own full registration. Two loops interleaved over the same 37
 * names; a real registry throws on a duplicate, so each loop lost the names
 * the other had just taken — an exact alternation, 18 landed and 19
 * "refused", in Chrome and in ChatGPT alike — and the losing loop's
 * teardown then unregistered its half. The shim replaced duplicates
 * silently, which is why it never showed locally (it throws now too).
 *
 * So the registration is a refcounted singleton: the first acquire starts
 * it, later acquires share it, and the teardown runs only when the last
 * holder releases — deferred a microtask, so React Strict Mode's synchronous
 * unmount-remount reuses the registration instead of tearing it down and
 * racing a second one.
 */
let shared: Promise<RegistrationResult | null> | null = null;
let holders = 0;
/** The previous registration's teardown, still finishing. A new one waits for it. */
let draining: Promise<void> = Promise.resolve();

export function acquirePrismTools(): Promise<RegistrationResult | null> {
  holders += 1;
  if (!shared) {
    // Behind the drain, so a page that re-mounts never races its own
    // teardown: the old names must be gone before the new run takes them.
    shared = draining.then(() => registerPrismTools());
  }
  return shared;
}

export function releasePrismTools(): void {
  holders -= 1;
  const current = shared;
  queueMicrotask(() => {
    if (holders === 0 && shared === current && current) {
      shared = null;
      draining = current.then((result) => {
        result?.teardown();
      });
    }
  });
}

export async function registerPrismTools(): Promise<RegistrationResult | null> {
  // Guarantees a context exists on `document` — the browser's own when it has
  // one, otherwise our in-page shim for browsers that do not.
  const resolved = ensureModelContext();
  if (!resolved) return null;

  const tools = new Map(buildTools().map((tool) => [tool.name, tool]));
  let controller: AbortController | null = null;
  let stopped = false;

  async function activate(toolset: PrismToolset): Promise<{ registered: number; failed: string[] }> {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const names = PRISM_TOOLSETS[toolset];
    const selected = names.map((name) => tools.get(name)).filter(Boolean) as ModelContextTool[];
    selected.push(toolsetSwitcher((next) => {
      if (!stopped) void activate(next);
    }));

    let registered = 0;
    const failed: string[] = [];
    for (const tool of selected) {
      try {
        const ok = await registerOnModelContext(tool, { signal });
        if (ok) registered += 1;
        else failed.push(tool.name);
      } catch (error) {
        failed.push(tool.name);
        console.warn(`[prism] failed to register ${tool.name}`, error);
      }
    }
    return { registered, failed };
  }

  const initial = await activate("workflow");

  return {
    kind: detectKind(),
    ...initial,
    teardown: () => {
      stopped = true;
      controller?.abort();
    },
  };
}
