import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquirePrismTools,
  PRISM_TOOLSETS,
  registerPrismTools,
  releasePrismTools,
} from "@/lib/webmcp/register";
import { buildTools } from "@/lib/webmcp/tools";
import type { ModelContextTool } from "@/lib/webmcp/types";
import { readGuides } from "./guide-setup";

/**
 * One registration, however many components ask.
 *
 * Two mounts of useWebMcp used to run two full registrations over the same
 * names. A real registry throws on duplicates, so the runs alternated
 * failures and the survivor held half the tools — in Chrome and in ChatGPT.
 * These pin the fix: acquires share one run, and the teardown waits for the
 * last release.
 */

type Registry = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

function stubDocument() {
  const names = new Set<string>();
  const tools = new Map<string, ModelContextTool>();
  const calls: string[] = [];
  const duplicates: string[] = [];
  const registry: Registry = {
    registerTool: async (tool, options) => {
      calls.push(tool.name);
      if (names.has(tool.name)) {
        duplicates.push(tool.name);
        throw new Error(`duplicate ${tool.name}`);
      }
      names.add(tool.name);
      tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => {
        names.delete(tool.name);
        tools.delete(tool.name);
      });
    },
  };
  vi.stubGlobal("document", { modelContext: registry });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("window", { location: { origin: "http://test" } });
  return { calls, duplicates, tools };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the shared registration", () => {
  it("preserves delivered guides through real toolset switches and resets after teardown", async () => {
    const registry = stubDocument();
    const registration = await registerPrismTools();
    try {
      await readGuides([...registry.tools.values()]);
      for (const toolset of Object.keys(PRISM_TOOLSETS)) {
        await registry.tools.get("prism.use_toolset")!.execute({ toolset });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(registry.tools.has("prism.read_guide")).toBe(true);
        const result = await registry.tools.get("prism.get_project_context")!.execute({});
        expect(JSON.parse(String(result)).agentGuidance.requiredBeforeWork).toEqual([]);
      }
    } finally {
      registration?.teardown();
    }
    const fresh = await registerPrismTools();
    try {
      const result = await registry.tools.get("prism.get_project_context")!.execute({});
      expect(JSON.parse(String(result)).agentGuidance.requiredBeforeWork).toHaveLength(2);
      expect(registry.duplicates).toEqual([]);
    } finally {
      fresh?.teardown();
    }
  });

  it("registers one workflow toolset for two holders, with no duplicates", async () => {
    const registry = stubDocument();

    const [first, second] = await Promise.all([acquirePrismTools(), acquirePrismTools()]);
    expect(first).toBe(second);
    expect(first?.registered).toBe(PRISM_TOOLSETS.workflow.length + 1);
    expect(first?.failed).toEqual([]);
    expect(registry.duplicates).toEqual([]);
    expect(registry.calls.length).toBe(PRISM_TOOLSETS.workflow.length + 1);

    // The first release keeps the tools; the last tears them down, and a
    // fresh acquire after that is a new registration.
    releasePrismTools();
    await Promise.resolve();
    releasePrismTools();
    await Promise.resolve();

    const third = await acquirePrismTools();
    expect(third).not.toBe(first);
    expect(third?.registered).toBe(PRISM_TOOLSETS.workflow.length + 1);
    expect(registry.duplicates).toEqual([]);
    releasePrismTools();
    await Promise.resolve();
  });

  it("keeps every operation reachable while each advertised toolset stays bounded", () => {
    const tools = buildTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const reachable = new Set(Object.values(PRISM_TOOLSETS).flat());

    expect([...reachable].sort()).toEqual(tools.map((tool) => tool.name).sort());
    for (const [name, names] of Object.entries(PRISM_TOOLSETS)) {
      const descriptors = names.map((toolName) => byName.get(toolName));
      expect(descriptors.every(Boolean), `${name} contains only registered tools`).toBe(true);
      expect(
        new TextEncoder().encode(JSON.stringify(descriptors)).byteLength,
        `${name} metadata budget`,
      ).toBeLessThan(30_000);
    }
  });
});
