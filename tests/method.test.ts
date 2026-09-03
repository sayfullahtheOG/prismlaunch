import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ColorSchema, TransitionSchema } from "@/lib/studio/schema";
import { buildTools } from "@/lib/webmcp/tools";

/**
 * PRISM_METHOD.md is the product.
 *
 * SKILL.md tells an agent how the tool works; this document tells it what to
 * make. An agent reads it once and then writes clips from memory of it, so a
 * transition name that does not exist, a hex the schema rejects, or a tool
 * that is not registered becomes a broken file on someone's disk with the
 * method's authority behind it. And it is read into a context window, so it
 * has to stay short enough to be read whole.
 *
 * These tests treat the document as code. If one fails, the document is
 * lying about the tool, or has grown past what an agent can hold. Fix the
 * document.
 */

const METHOD = readFileSync(join(process.cwd(), "public", "PRISM_METHOD.md"), "utf8");
const SKILL = readFileSync(join(process.cwd(), "public", "SKILL.md"), "utf8");

describe("public/PRISM_METHOD.md", () => {
  it("is a skill: front matter with a name and a real description", () => {
    expect(METHOD.startsWith("---\n")).toBe(true);
    expect(METHOD).toMatch(/^name: prism-method$/m);
    expect(METHOD).toMatch(/^description: .{80,}$/m);
  });

  it("is reached from SKILL.md before an agent builds anything", () => {
    expect(SKILL).toContain("PRISM_METHOD.md");
    expect(SKILL).toMatch(/## Before you build anything/);
  });

  /** Short enough to be read whole: the old version burned a fifth of a context window. */
  it("stays concise", () => {
    expect(METHOD.split("\n").length).toBeLessThan(480);
    expect(METHOD.length).toBeLessThan(28_000);
  });

  it("leads with the two rules that kill slop, then the rest", () => {
    for (const heading of [
      "## 1. Events, not slides",
      "## 2. Objects cross the cuts",
      "## 3. The other rules",
      "## 4. The process",
      "## 5. Brief, assets, concept",
      "## 6. Words",
      "## 7. Look",
      "## 8. Motion",
      "## 9. Sound",
      "## 10. Storyboard, animatic, build",
      "## 11. The tells",
      "## 12. Before you propose the render",
    ]) {
      expect(METHOD, `missing "${heading}"`).toContain(heading);
    }
    expect(METHOD.indexOf("## 1. Events")).toBeLessThan(METHOD.indexOf("## 4. The process"));
  });

  /** The pipeline table names the app's eight stages, in the app's order. */
  it("walks the app's stages in order", () => {
    const stages = ["Brief", "Concept", "Script", "Storyboard", "Style frames", "Animatic", "Polish", "Build"];
    let cursor = 0;
    for (const stage of stages) {
      const at = METHOD.indexOf(`| **${stage}**`, cursor);
      expect(at, `${stage} is missing from the pipeline table or out of order`).toBeGreaterThan(-1);
      cursor = at;
    }
  });

  /** The rules the method exists for have to be stated as rules, with numbers. */
  it("states the pace and continuity rules with their numbers", () => {
    expect(METHOD).toMatch(/Two events per second/);
    expect(METHOD).toContain("holdFrames = 12 + characters × 2");
    expect(METHOD).toContain("12 + chars × 2");
    expect(METHOD).toMatch(/handoff/);
    expect(METHOD).toMatch(/may start in one section and\s+end in the next/);
    expect(METHOD).toMatch(/never a hold/);
  });

  /**
   * Every transition the method tells an agent to use has to be one the
   * renderer knows, and every one the renderer has must be in the table.
   */
  it("only recommends transitions the renderer implements, and all of them", () => {
    const table = METHOD.slice(METHOD.indexOf("### Transitions"), METHOD.indexOf("### Recipes"));
    const named = [...table.matchAll(/\| \*\*([a-z-]+(?: \/ [a-z-]+)?)\*\*/g)].flatMap(
      (match) => match[1]!.split(" / "),
    );

    expect(named.length).toBeGreaterThanOrEqual(12);
    for (const name of named) {
      expect(
        TransitionSchema.safeParse(name).success,
        `"${name}" is not a transition the renderer has`,
      ).toBe(true);
    }
    for (const option of TransitionSchema.options) {
      expect(table, `the table never mentions "${option}"`).toContain(option);
    }
  });

  /** Every hex in the looks is copied verbatim into clips. */
  it("uses only colours the schema accepts", () => {
    const hexes = [...METHOD.matchAll(/`(#[0-9A-Fa-f]{3,8})`/g)].map((m) => m[1]!);
    expect(hexes.length).toBeGreaterThan(15);
    for (const hex of hexes) {
      expect(ColorSchema.safeParse(hex).success, `${hex} is not a valid colour`).toBe(true);
    }
  });

  /** Font families the looks name have to be ones the renderer loads. */
  it("names only the three loaded font families", () => {
    const looks = METHOD.slice(METHOD.indexOf("**Four looks.**"), METHOD.indexOf("**End card"));
    expect(looks).toMatch(/Inter/);
    expect(looks).toMatch(/Instrument Serif/);
    expect(looks).toMatch(/mono/);
    expect(looks).not.toMatch(/Helvetica|SF Pro|Geist|Söhne|Berkeley/);
  });

  it("only refers to tools that are registered", () => {
    const registered = new Set(buildTools().map((tool) => tool.name));
    const mentioned = [...METHOD.matchAll(/`(prism\.[a-z_]+)`/g)].map((m) => m[1]!);

    expect(mentioned.length).toBeGreaterThan(5);
    for (const name of mentioned) {
      expect(registered.has(name), `${name} is in the method but not registered`).toBe(true);
    }
  });

  /** The frame-locked tempo table has to agree with arithmetic. */
  it("has a tempo table that is actually frame-locked at 30fps", () => {
    const rows = [...METHOD.matchAll(/^\| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(5);

    for (const row of rows) {
      const bpm = Number(row[1]);
      const perBeat = Number(row[2]);
      const perBar = Number(row[3]);
      const eightBars = Number(row[4]);
      expect(1800 / bpm, `${bpm} BPM is not frame-locked`).toBe(perBeat);
      expect(perBar).toBe(perBeat * 4);
      expect(eightBars).toBe(perBar * 8);
    }
  });

  /**
   * Two things the method must never do: hand the agent a way around the
   * approval boundary, or endorse the one gradient it exists to prevent.
   */
  it("keeps the approval boundary and the purple gradient where they belong", () => {
    expect(METHOD).toMatch(/only they can approve the render/);
    expect(METHOD).not.toMatch(/prism\.(accept|approve|reject)/);

    const looks = METHOD.slice(METHOD.indexOf("**Four looks.**"), METHOD.indexOf("**End card"));
    expect(looks).not.toMatch(/#7C3AED|#2563EB|#8B5CF6|#6366F1/i);
  });

  it("carries its sources", () => {
    const urls = [...METHOD.matchAll(/https?:\/\/[^\s)]+/g)];
    expect(urls.length).toBeGreaterThan(15);
  });
});
