/**
 * Typed surface for the WebMCP model context API.
 *
 * Mirrors the W3C Web Machine Learning CG WebIDL, with the divergences Chrome
 * actually ships. Where the two disagree, Chrome wins — Chrome is what runs
 * the demo.
 *
 * Verified against a shipped WebMCP implementation that runs in both ChatGPT's
 * browser and Chrome. See context/progress-tracker.md §Architecture Decisions,
 * "WebMCP facts verified against a shipped implementation".
 */

export type ToolAnnotations = {
  /** Tool only reads. Safe for an agent to call without confirmation. */
  readOnlyHint?: boolean;
  /**
   * Output may contain text derived from a user's repository. The agent must
   * treat it as data, never as instructions. This is the supported mechanism
   * for that — better than a prose disclaimer inside the result string.
   */
  untrustedContentHint?: boolean;
};

/** A JSON Schema object describing a tool's input. */
export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

/** `execute` may return a string or an object; strings read better in a transcript. */
export type ToolResult = string | Record<string, unknown>;

export type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
};

/** What `getTools()` returns — a descriptor, not the original definition. */
export type RegisteredTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  origin: string;
  annotations?: ToolAnnotations;
};

export type RegisterToolOptions = {
  /** Origins permitted to discover this tool, beyond same-origin. */
  exposedTo?: string[];
  /** Abort to unregister. Always pass one so tools disappear on unmount. */
  signal?: AbortSignal;
};

export type GetToolsOptions = { fromOrigins?: string[] };
export type ExecuteToolOptions = { signal?: AbortSignal };

export interface ModelContext extends EventTarget {
  registerTool(
    tool: ModelContextTool,
    options?: RegisterToolOptions,
  ): Promise<void>;
  getTools(options?: GetToolsOptions): Promise<RegisteredTool[]>;
  /**
   * Chrome diverges from the published WebIDL in two ways:
   *   1. `input` must be a JSON **string**. Passing an object throws
   *      "Failed to parse input arguments".
   *   2. `input` is **required**, not optional. Omitting it throws
   *      "2 arguments required, but only 1 present".
   * Use `callTool()` below rather than calling this directly.
   */
  executeTool(
    tool: RegisteredTool,
    input: string,
    options?: ExecuteToolOptions,
  ): Promise<string>;
}

type ModelContextCarrier = { modelContext?: ModelContext };

/**
 * Resolve the model context, tolerating both spec locations.
 *
 * The getter moved from `Navigator` to `Document` during 2026 and Chromium 150
 * deprecated the old location, but the origin trial floor still ships the
 * `navigator` spelling — so detect both, current first. Returns null when the
 * browser has no WebMCP at all, which is the common case: only ChatGPT's
 * browser and flagged Chrome/Edge implement it today.
 */
export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;

  const fromDocument = (document as unknown as ModelContextCarrier).modelContext;
  if (fromDocument) return fromDocument;

  const fromNavigator = (navigator as unknown as ModelContextCarrier)
    .modelContext;
  return fromNavigator ?? null;
}

/**
 * The only safe way to invoke a tool across implementations: serialises the
 * input and always passes both arguments, satisfying Chrome while remaining
 * valid for the fallback registry.
 *
 * Chrome does NOT validate input against a tool's `inputSchema` — a missing
 * required field and an unexpected property both reach the handler untouched.
 * Every `execute` must therefore validate its own input with Zod.
 */
export function callTool(
  ctx: ModelContext,
  tool: RegisteredTool,
  input: Record<string, unknown> = {},
  options?: ExecuteToolOptions,
): Promise<string> {
  return ctx.executeTool(tool, JSON.stringify(input), options);
}
