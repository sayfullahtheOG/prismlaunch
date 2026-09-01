import { ensureModelContext, detectKind, type ContextKind } from "./fallback";
import { buildTools } from "./tools";

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

export async function registerPrismTools(): Promise<RegistrationResult | null> {
  const resolved = ensureModelContext();
  if (!resolved) return null;

  const { ctx } = resolved;
  const controller = new AbortController();
  const tools = buildTools();

  let registered = 0;
  for (const tool of tools) {
    try {
      await ctx.registerTool(tool, { signal: controller.signal });
      registered += 1;
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
