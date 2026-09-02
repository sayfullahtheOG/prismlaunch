"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import {
  detectKind,
  ensureModelContext,
  type ContextKind,
} from "@/lib/webmcp/fallback";
import { callTool, getModelContext, type RegisteredTool } from "@/lib/webmcp/types";
import { explainZodError, toolInputJsonSchema } from "@/lib/studio/schema";

/**
 * A deliberately trivial tool, used to prove the whole WebMCP round-trip
 * before any product code depends on it: register → discover → execute →
 * unregister. If this page works, Phase 3 is a matter of writing more tools.
 */
const EchoInput = z.object({
  message: z.string().min(1).max(80).describe("Text to echo back"),
});

const BADGE: Record<ContextKind, { text: string; className: string }> = {
  native: {
    text: "native modelContext — external agents can see these tools",
    className: "border-ok/40 bg-ok/10 text-ok",
  },
  fallback: {
    text: "fallback registry — in-page only, invisible to external agents",
    className: "border-brand/30 bg-brand-soft text-brand",
  },
  absent: {
    text: "no modelContext in this browser",
    className: "border-draft-line bg-draft-soft text-draft",
  },
};

export function WebMcpProbe() {
  const [kind, setKind] = useState<ContextKind>("absent");
  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const say = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const refresh = useCallback(async () => {
    const ctx = getModelContext();
    if (!ctx) {
      setKind("absent");
      setTools([]);
      return;
    }
    setKind(detectKind());
    try {
      setTools(await ctx.getTools());
    } catch (error) {
      say(`getTools() failed: ${String(error)}`);
    }
  }, [say]);

  useEffect(() => {
    const resolved = ensureModelContext();
    if (!resolved) return;

    const { ctx } = resolved;
    // One controller per mount. Aborting it unregisters every tool below, so
    // stale tools never outlive the page (architecture.md invariant 11).
    const controller = new AbortController();

    // Same canonical call as lib/webmcp/register.ts:
    //   document.modelContext.registerTool({ name, description, inputSchema, execute })
    void (document.modelContext ?? ctx)
      .registerTool(
        {
          name: "prism.echo",
          description:
            "Echo a short message back. Exists only to prove the WebMCP round-trip.",
          inputSchema: toolInputJsonSchema(EchoInput) as never,
          annotations: { readOnlyHint: true },
          execute: async (input) => {
            // Chrome validates nothing against inputSchema — a missing required
            // field arrives untouched. Every executor guards its own input.
            const parsed = EchoInput.safeParse(input);
            if (!parsed.success) {
              return `Invalid input — ${explainZodError(parsed.error)}`;
            }
            return `PrismLaunch heard: ${parsed.data.message}`;
          },
        },
        { signal: controller.signal },
      )
      .then(() => void refresh());

    const onChange = () => void refresh();
    ctx.addEventListener("toolchange", onChange);

    return () => {
      ctx.removeEventListener("toolchange", onChange);
      controller.abort();
    };
  }, [refresh]);

  const selfTest = useCallback(async () => {
    const ctx = getModelContext();
    if (!ctx) {
      say("no modelContext — cannot self-test");
      return;
    }
    setLog([]);

    try {
      const found = await ctx.getTools();
      say(`getTools() → [${found.map((t) => t.name).join(", ") || "none"}]`);

      const echo = found.find((t) => t.name === "prism.echo");
      if (!echo) {
        say("prism.echo not registered");
        return;
      }

      // Happy path.
      say(`executeTool(valid) → ${await callTool(ctx, echo, { message: "hello" })}`);

      // The case Chrome does NOT catch for us: a required field is missing, and
      // it reaches the handler anyway. The executor's own Zod parse is what
      // turns that into a corrective message instead of a crash.
      say(`executeTool(missing field) → ${await callTool(ctx, echo, {})}`);
    } catch (error) {
      say(`self-test failed: ${String(error)}`);
    }
  }, [say]);

  const badge = BADGE[kind];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">WebMCP probe</h1>
        <p className="mt-1 text-sm text-muted">
          Proves register → discover → execute → unregister before any product
          code depends on it. Not part of the product surface.
        </p>
      </header>

      <span
        className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {badge.text}
      </span>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
          Registered tools ({tools.length})
        </h2>
        {tools.length === 0 ? (
          <p className="text-sm text-muted">none discovered</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tools.map((tool) => (
              <li
                key={tool.name}
                className="rounded-card border border-line bg-surface p-3"
              >
                <code className="font-mono text-xs text-brand">{tool.name}</code>
                <p className="mt-1 text-xs text-muted">{tool.description}</p>
                <p className="mt-1 font-mono text-[10.5px] text-faint">
                  origin {tool.origin}
                  {tool.annotations?.readOnlyHint ? " · readOnlyHint" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => void selfTest()}
        className="w-fit rounded-ctl bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Run self-test
      </button>

      {log.length > 0 ? (
        <pre className="thin-scroll overflow-x-auto rounded-card bg-ink p-3 font-mono text-[11.5px] leading-relaxed text-white">
          {log.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}
