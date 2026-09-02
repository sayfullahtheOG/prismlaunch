import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  explainZodError,
  ProjectFileSchema,
  PROJECT_FILE_VERSION,
  WORKSPACE_DIR,
} from "@/lib/studio/schema";

/**
 * SKILL.md is the product's real interface.
 *
 * An agent reads it once and then writes `project.json` from memory of it, so
 * a wrong example there is worse than a wrong comment — it becomes a broken
 * file on someone's disk, and the person blames the app. These tests treat the
 * document as code: the JSON in it is parsed and validated against the same
 * schema the app uses, and the rules it states are checked against the
 * constants they describe.
 *
 * If this file fails, SKILL.md is lying. Fix the document, not the test.
 */

const SKILL = readFileSync(join(process.cwd(), "public", "SKILL.md"), "utf8");

/** Every fenced ```json block, in order. */
function jsonBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```json\n([\s\S]*?)```/g)].map(
    (match) => match[1]!,
  );
}

describe("public/SKILL.md", () => {
  it("has front matter naming the skill", () => {
    expect(SKILL.startsWith("---\n")).toBe(true);
    expect(SKILL).toMatch(/^name: prismlaunch$/m);
    expect(SKILL).toMatch(/^description: .{40,}$/m);
  });

  it("contains exactly one example project file", () => {
    expect(jsonBlocks(SKILL)).toHaveLength(1);
  });

  /** The load-bearing assertion: what we tell agents to write must be legal. */
  it("shows an example that the schema accepts", () => {
    const raw = JSON.parse(jsonBlocks(SKILL)[0]!);
    const parsed = ProjectFileSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(
        `The example in SKILL.md is not a valid project file: ${explainZodError(parsed.error)}`,
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("shows an example whose clips are all drafts", () => {
    // The document tells agents never to write "accepted". The example has to
    // model that, or it teaches the opposite of what it says.
    const parsed = ProjectFileSchema.parse(JSON.parse(jsonBlocks(SKILL)[0]!));
    const approvals = parsed.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.approval),
    );

    expect(approvals.length).toBeGreaterThan(0);
    expect(approvals.every((approval) => approval === "draft")).toBe(true);
  });

  /**
   * The example has to demonstrate the two rules people get wrong, or it is
   * teaching by omission: visual tracks before audio ones, and simultaneous
   * clips on separate tracks rather than overlapping on one.
   */
  it("shows a stack that demonstrates the ordering rules", () => {
    const parsed = ProjectFileSchema.parse(JSON.parse(jsonBlocks(SKILL)[0]!));

    expect(parsed.tracks.filter((t) => t.kind === "visual").length).toBeGreaterThan(1);
    expect(parsed.tracks.some((t) => t.kind === "audio")).toBe(true);
    expect(parsed.tracks[parsed.tracks.length - 1]!.kind).toBe("audio");
  });

  it("quotes the version and folder the code actually uses", () => {
    const raw = JSON.parse(jsonBlocks(SKILL)[0]!) as { version: number };
    expect(raw.version).toBe(PROJECT_FILE_VERSION);
    expect(SKILL).toContain(`${WORKSPACE_DIR}/`);
  });

  it("documents every tool the app registers, and no others", async () => {
    const { buildTools } = await import("@/lib/webmcp/tools");
    const registered = buildTools().map((tool) => tool.name);

    const documented = [
      ...SKILL.matchAll(/`(prism\.[a-z_]+)`/g),
    ].map((match) => match[1]!);

    for (const name of registered) {
      expect(documented, `${name} is registered but absent from SKILL.md`).toContain(
        name,
      );
    }
    for (const name of new Set(documented)) {
      expect(registered, `${name} is in SKILL.md but not registered`).toContain(
        name,
      );
    }
  });

  it("states the approval boundary rather than leaving it implicit", () => {
    expect(SKILL).toMatch(/cannot accept your own work/i);
    expect(SKILL).toMatch(/always write `?draft`?/i);
  });
});
