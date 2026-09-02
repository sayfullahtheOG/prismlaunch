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
 * method's authority behind it.
 *
 * These tests treat the document as code. If one fails, the document is
 * lying about the tool. Fix the document.
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

  /** The pipeline is the spine; every stage the process research named is here. */
  it("walks the whole pipeline in order", () => {
    const stages = [
      "Brief",
      "Immersion",
      "Concept",
      "Script",
      "Storyboard",
      "Animatic",
      "Style frames",
      "Build",
      "Sound",
      "Polish",
    ];
    let cursor = 0;
    for (const stage of stages) {
      const at = METHOD.indexOf(`| **${stage}**`, cursor);
      expect(at, `${stage} is missing from the pipeline table or out of order`).toBeGreaterThan(-1);
      cursor = at;
    }
  });

  it("names every section an agent would look for", () => {
    for (const heading of [
      "## 1. The pipeline",
      "## 3. Concept",
      "## 4. Structure, the hook and the pace",
      "## 5. Script",
      "## 6. Storyboard and animatic",
      "## 7. Look",
      "## 8. Motion",
      "## 9. Sound",
      "## 10. Build",
      "## 11. Review",
      "## 12. Working with the person",
      "## 13. The tells",
      "## 14. Before you propose the render",
    ]) {
      expect(METHOD, `missing "${heading}"`).toContain(heading);
    }
  });

  /**
   * Every transition the method tells an agent to use has to be one the
   * renderer knows. The table in §8 is the authority an agent copies from.
   */
  it("only recommends transitions the renderer implements", () => {
    const table = METHOD.slice(
      METHOD.indexOf("### The eight transitions"),
      METHOD.indexOf("**Grammar: pick two.**"),
    );
    const named = [...table.matchAll(/\| \*\*([a-z-]+(?: \/ [a-z-]+)?)\*\*/g)].flatMap(
      (match) => match[1]!.split(" / "),
    );

    expect(named.length).toBeGreaterThanOrEqual(7);
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

  /** Every hex in the four looks is copied verbatim into clips. */
  it("uses only colours the schema accepts", () => {
    const hexes = [...METHOD.matchAll(/`(#[0-9A-Fa-f]{3,8})`/g)].map((m) => m[1]!);
    expect(hexes.length).toBeGreaterThan(20);

    for (const hex of hexes) {
      // "#000000" and "#FFFFFF" appear only as things NOT to use; they still
      // have to parse, or the warning itself would be malformed.
      expect(ColorSchema.safeParse(hex).success, `${hex} is not a valid colour`).toBe(true);
    }
  });

  /** Font families the looks name have to be ones the renderer loads. */
  it("names only the three loaded font families", () => {
    const looks = METHOD.slice(
      METHOD.indexOf("### Four looks"),
      METHOD.indexOf("### Style frames"),
    );
    expect(looks).toMatch(/Inter/);
    expect(looks).toMatch(/Instrument Serif|display \(Instrument Serif\)/);
    expect(looks).toMatch(/mono/);
    expect(looks).not.toMatch(/Helvetica|SF Pro|Geist|Söhne|Berkeley/);
  });

  it("only refers to tools that are registered", () => {
    const registered = new Set(buildTools().map((tool) => tool.name));
    const mentioned = [...METHOD.matchAll(/`(prism\.[a-z_]+)`/g)].map((m) => m[1]!);

    expect(mentioned.length).toBeGreaterThan(0);
    for (const name of mentioned) {
      expect(registered.has(name), `${name} is in the method but not registered`).toBe(true);
    }
  });

  /**
   * The hold-time formula is the one rule an agent applies to every text clip.
   * It has to be stated once, consistently, in a form that can be computed.
   */
  it("states one hold-time formula and uses it in the checklist", () => {
    expect(METHOD).toContain("holdFrames = 21 + (characters × 2.7)");
    expect(METHOD).toContain("21 + chars × 2.7");
  });

  /** The frame-locked tempo table has to agree with arithmetic. */
  it("has a tempo table that is actually frame-locked at 30fps", () => {
    const rows = [...METHOD.matchAll(/^\| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(6);

    for (const row of rows) {
      const bpm = Number(row[1]);
      const perBeat = Number(row[2]);
      const perBar = Number(row[3]);
      expect(1800 / bpm, `${bpm} BPM is not frame-locked`).toBe(perBeat);
      expect(perBar).toBe(perBeat * 4);
    }
  });

  /**
   * Two things the method must never do: hand the agent a way around the
   * approval boundary, or endorse the one gradient it exists to prevent.
   */
  it("keeps the approval boundary and the purple gradient where they belong", () => {
    expect(METHOD).toMatch(/only they can approve the render/);
    expect(METHOD).not.toMatch(/prism\.(accept|approve|reject)/);

    const looks = METHOD.slice(METHOD.indexOf("### Four looks"), METHOD.indexOf("### Style frames"));
    expect(looks).not.toMatch(/#7C3AED|#2563EB|#8B5CF6|#6366F1/i);
  });

  it("carries its sources", () => {
    const urls = [...METHOD.matchAll(/https?:\/\/[^\s)]+/g)];
    expect(urls.length).toBeGreaterThan(30);
  });
});
