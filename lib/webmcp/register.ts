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

  const controller = new AbortController();
  const tools = buildTools();

  let registered = 0;
  const failed: string[] = [];
  for (const tool of tools) {
    try {
      const ok = await registerOnModelContext(tool, {
        signal: controller.signal,
      });
      if (ok) registered += 1;
      else failed.push(tool.name);
    } catch (error) {
      // One bad tool must not take the rest down — a partial toolset is far
      // more useful than none. But a refusal is a fact about this browser
      // the person needs to see, so it is carried out, not just logged.
      failed.push(tool.name);
      console.warn(`[prism] failed to register ${tool.name}`, error);
    }
  }

  return {
    kind: detectKind(),
    registered,
    failed,
    teardown: () => controller.abort(),
  };
}
