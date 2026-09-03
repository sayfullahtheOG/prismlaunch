import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquirePrismTools,
  PRISM_TOOLSETS,
  releasePrismTools,
} from "@/lib/webmcp/register";
import { buildTools } from "@/lib/webmcp/tools";

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
  registerTool: (tool: { name: string }, options?: { signal?: AbortSignal }) => Promise<void>;
};

function stubDocument(): { calls: string[]; duplicates: string[] } {
  const names = new Set<string>();
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
      options?.signal?.addEventListener("abort", () => names.delete(tool.name));
    },
  };
  vi.stubGlobal("document", { modelContext: registry });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("window", { location: { origin: "http://test" } });
  return { calls, duplicates };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the shared registration", () => {
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
