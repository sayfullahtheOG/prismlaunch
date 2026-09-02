import { describe, expect, it } from "vitest";
import { pickLanding } from "@/lib/studio/landing";
import type { ProjectEntry } from "@/lib/workspace/fs";

/**
 * Linking a folder has to end with a composition open, or the setup dialog
 * stays up after the click that was supposed to finish it. This is the rule
 * for which one.
 */

function entry(overrides: Partial<ProjectEntry>): ProjectEntry {
  return { slug: "x", name: "X", problem: null, modifiedAt: 0, ...overrides };
}

describe("pickLanding", () => {
  it("creates a blank composition in an empty folder", () => {
    expect(pickLanding([])).toEqual({ kind: "create" });
  });

  it("opens the only composition", () => {
    expect(pickLanding([entry({ slug: "one" })])).toEqual({ kind: "open", slug: "one" });
  });

  it("opens the most recently edited one when there are several, whatever order they arrive in", () => {
    const landing = pickLanding([
      entry({ slug: "old", modifiedAt: 10 }),
      entry({ slug: "newest", modifiedAt: 30 }),
      entry({ slug: "middle", modifiedAt: 20 }),
    ]);
    expect(landing).toEqual({ kind: "open", slug: "newest" });
  });

  it("skips compositions that do not read", () => {
    const landing = pickLanding([
      entry({ slug: "broken", name: null, problem: "process.storyboard: expected object", modifiedAt: 99 }),
      entry({ slug: "empty-dir", name: null, problem: null }),
      entry({ slug: "fine", modifiedAt: 5 }),
    ]);
    expect(landing).toEqual({ kind: "open", slug: "fine" });
  });

  it("creates a blank one when nothing reads, rather than showing a list of problems", () => {
    const landing = pickLanding([
      entry({ slug: "broken", name: null, problem: "version: expected 2 or 3" }),
    ]);
    expect(landing).toEqual({ kind: "create" });
  });
});
