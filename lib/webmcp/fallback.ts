import type {
  ExecuteToolOptions,
  ModelContext,
  ModelContextTool,
  RegisteredTool,
  RegisterToolOptions,
} from "./types";
import { getModelContext } from "./types";

/**
 * A minimal same-page ModelContext, installed only when the browser has none.
 *
 * Why it exists: only ChatGPT's browser and flagged Chrome/Edge implement
 * WebMCP today. Without a fallback, nothing in the page can exercise its own
 * tools in any other browser — which makes the spike page untestable and
 * blocks a self-test during development.
 *
 * What it deliberately does NOT do: make tools visible to external agents.
 * That requires the browser's own implementation. This registry serves exactly
 * one consumer — this page — and the status UI must never report it as native
 * support, or we would be claiming reach we do not have.
 */
class FallbackModelContext extends EventTarget implements ModelContext {
  readonly #tools = new Map<string, ModelContextTool>();

  async registerTool(
    tool: ModelContextTool,
    options?: RegisterToolOptions,
  ): Promise<void> {
    if (options?.signal?.aborted) return;

    this.#tools.set(tool.name, tool);

    options?.signal?.addEventListener("abort", () => {
      // Only remove the entry if it is still OURS. React invokes effects twice
      // in development, so an older controller can abort after a newer
      // registration has already replaced the same tool name — deleting by
      // name alone would silently unregister the live tool and leave the page
      // with zero tools while still reporting success.
      if (this.#tools.get(tool.name) !== tool) return;
      this.#tools.delete(tool.name);
      this.dispatchEvent(new Event("toolchange"));
    });

    this.dispatchEvent(new Event("toolchange"));
  }

  // Origin filtering is meaningless here — this registry only ever holds tools
  // registered by this page — so GetToolsOptions is accepted and ignored.
  async getTools(): Promise<RegisteredTool[]> {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      ...(tool.title !== undefined ? { title: tool.title } : {}),
      description: tool.description,
      ...(tool.inputSchema !== undefined
        ? { inputSchema: tool.inputSchema }
        : {}),
      origin: window.location.origin,
      ...(tool.annotations !== undefined
        ? { annotations: tool.annotations }
        : {}),
    }));
  }

  /**
   * Matches Chrome's contract — a JSON string — so callers have one code path
   * regardless of which registry they got. An object is tolerated too, since
   * being stricter than Chrome here would buy nothing.
   */
  async executeTool(
    tool: RegisteredTool,
    input: string | Record<string, unknown> = {},
    options?: ExecuteToolOptions,
  ): Promise<string> {
    const found = this.#tools.get(tool.name);
    if (!found) throw new Error(`unknown tool: ${tool.name}`);
    if (options?.signal?.aborted) throw new Error("aborted");

    let parsed: Record<string, unknown>;
    if (typeof input === "string") {
      try {
        parsed = input === "" ? {} : (JSON.parse(input) as Record<string, unknown>);
      } catch {
        throw new Error("Failed to parse input arguments");
      }
    } else {
      parsed = input;
    }

    const result = await found.execute(parsed);
    return typeof result === "string" ? result : JSON.stringify(result);
  }
}

export type ContextKind = "native" | "fallback" | "absent";

const FLAG = "__prismLaunchFallback";

/** True when the context on this document is ours, not the browser's. */
export function isFallbackInstalled(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean((document as unknown as Record<string, unknown>)[FLAG]);
}

export function detectKind(): ContextKind {
  if (!getModelContext()) return "absent";
  return isFallbackInstalled() ? "fallback" : "native";
}

/**
 * Returns the native context untouched when present. Otherwise installs the
 * fallback on `document.modelContext` and returns that.
 */
export function ensureModelContext(): {
  ctx: ModelContext;
  kind: ContextKind;
} | null {
  if (typeof document === "undefined") return null;

  const native = getModelContext();
  if (native) return { ctx: native, kind: detectKind() };

  const ctx = new FallbackModelContext();
  Object.defineProperty(document, "modelContext", {
    value: ctx,
    writable: false,
    configurable: true,
  });
  Object.defineProperty(document, FLAG, {
    value: true,
    writable: false,
    configurable: true,
  });

  return { ctx, kind: "fallback" };
}
