import { ensureModelContext, detectKind, type ContextKind } from "./fallback";
import { buildTools } from "./tools";
import type { ModelContextTool, RegisterToolOptions } from "./types";

/**
 * Register every tool, and return a teardown that removes them.
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

export async function registerPrismTools(): Promise<RegistrationResult | null> {
  // Guarantees a context exists on `document` — the browser's own when it has
  // one, otherwise our in-page shim for browsers that do not.
  const resolved = ensureModelContext();
  if (!resolved) return null;

  const controller = new AbortController();
  const tools = buildTools();

  let registered = 0;
  for (const tool of tools) {
    try {
      const ok = await registerOnModelContext(tool, {
        signal: controller.signal,
      });
      if (ok) registered += 1;
    } catch (error) {
      // One bad tool must not take the rest down — a partial toolset is far
      // more useful than none.
      console.warn(`[prism] failed to register ${tool.name}`, error);
    }
  }

  return {
    kind: detectKind(),
    registered,
    teardown: () => controller.abort(),
  };
}
