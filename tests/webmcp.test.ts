import { afterEach, describe, expect, it, vi } from "vitest";
import { acquirePrismTools, releasePrismTools } from "@/lib/webmcp/register";

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
  it("registers once for two holders, all tools, no duplicates", async () => {
    const registry = stubDocument();

    const [first, second] = await Promise.all([acquirePrismTools(), acquirePrismTools()]);
    expect(first).toBe(second);
    expect(first?.registered).toBe(40);
    expect(first?.failed).toEqual([]);
    expect(registry.duplicates).toEqual([]);
    expect(registry.calls.length).toBe(40);

    // The first release keeps the tools; the last tears them down, and a
    // fresh acquire after that is a new registration.
    releasePrismTools();
    await Promise.resolve();
    releasePrismTools();
    await Promise.resolve();

    const third = await acquirePrismTools();
    expect(third).not.toBe(first);
    expect(third?.registered).toBe(40);
    expect(registry.duplicates).toEqual([]);
    releasePrismTools();
    await Promise.resolve();
  });
});
