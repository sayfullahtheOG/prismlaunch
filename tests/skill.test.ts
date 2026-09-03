import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assembleProject } from "@/lib/studio/modular";
import {
  explainZodError,
  ProjectFileSchema,
  PROJECT_FILE_VERSION,
  WORKSPACE_DIR,
  StoryboardVisualSchema,
} from "@/lib/studio/schema";

/**
 * SKILL.md is the product's real interface.
 *
 * An agent reads it once and then writes the film's files from memory of it,
 * so a wrong example there is worse than a wrong comment — it becomes a
 * broken file on someone's disk, and the person blames the app. These tests
 * treat the document as code: the JSON in it is parsed, assembled the way
 * the studio assembles a folder, and validated against the same schema the
 * app uses, and the rules it states are checked against the constants they
 * describe.
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

type Part = { id: string } & Record<string, unknown>;

/**
 * The example the way the studio reads it: the first block is
 * `project.json`, the others are the part files it names, told apart the
 * way the folder tells them apart — a track has clips, an element does not.
 */
function assembledExample() {
  const blocks = jsonBlocks(SKILL).map((block) => JSON.parse(block) as Part);
  const [main, ...parts] = blocks;
  const tracks = parts.filter((part) => Array.isArray(part.clips)).map((body) => ({ name: `${body.id}.json`, body }));
  const elements = parts.filter((part) => typeof part.kind === "string").map((body) => ({ name: `${body.id}.json`, body }));
  const process = [...SKILL.matchAll(/`process\/([a-z]+\.json)`:\n\n```json\n([\s\S]*?)```/g)]
    .map((match) => ({ name: match[1]!, body: JSON.parse(match[2]!) }));
  return { main: main!, tracks, elements, process, assembled: assembleProject(main!, tracks, elements, process) };
}

describe("public/SKILL.md", () => {
  it("shows a valid visual storyboard scene separately from the film's part files", () => {
    const scenes = jsonBlocks(SKILL).map((block) => JSON.parse(block)).filter((body) => Array.isArray(body.layers));
    expect(scenes).toHaveLength(1);
    expect(StoryboardVisualSchema.safeParse(scenes[0]).success).toBe(true);
  });
  it("has front matter naming the skill", () => {
    expect(SKILL.startsWith("---\n")).toBe(true);
    expect(SKILL).toMatch(/^name: prismlaunch$/m);
    expect(SKILL).toMatch(/^description: .{40,}$/m);
  });

  /**
   * The example is the split layout — a main file naming its parts by id,
   * and one file per part — because an agent copies the example's shape,
   * and one long file is the shape this exists to stop.
   */
  it("shows the film as a folder: a main file of ids, one file per layer, one per element", () => {
    const { main, tracks, elements } = assembledExample();
    expect(Array.isArray(main.tracks)).toBe(true);
    expect((main.tracks as unknown[]).every((entry) => typeof entry === "string")).toBe(true);
    expect((main.elements as unknown[]).every((entry) => typeof entry === "string")).toBe(true);
    expect(tracks.length).toBeGreaterThanOrEqual(2);
    expect(elements.length).toBeGreaterThanOrEqual(1);
    for (const part of [...tracks, ...elements]) {
      expect(main.tracks as string[]).toBeDefined();
      expect([...(main.tracks as string[]), ...(main.elements as string[])]).toContain(part.body.id);
    }
  });

  /** The load-bearing assertion: what we tell agents to write must be legal. */
  it("shows an example that the schema accepts once assembled", () => {
    const parsed = ProjectFileSchema.safeParse(assembledExample().assembled);
    if (!parsed.success) {
      throw new Error(
        `The example in SKILL.md is not a valid project file: ${explainZodError(parsed.error)}`,
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("shows an example whose clips are accepted, the field being a legacy", () => {
    const parsed = ProjectFileSchema.parse(assembledExample().assembled);
    const approvals = parsed.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.approval),
    );

    expect(approvals.length).toBeGreaterThan(0);
    expect(approvals.every((approval) => approval === "accepted")).toBe(true);
  });

  /**
   * The example has to demonstrate the two rules people get wrong, or it is
   * teaching by omission: visual tracks before audio ones, and simultaneous
   * clips on separate tracks rather than overlapping on one.
   */
  it("shows a stack that demonstrates the ordering rules", () => {
    const parsed = ProjectFileSchema.parse(assembledExample().assembled);

    expect(parsed.tracks.filter((t) => t.kind === "visual").length).toBeGreaterThan(1);
    expect(parsed.tracks.some((t) => t.kind === "audio")).toBe(true);
    expect(parsed.tracks[parsed.tracks.length - 1]!.kind).toBe("audio");
  });

  it("quotes the version and folder the code actually uses", () => {
    const { main } = assembledExample();
    expect(main.version).toBe(PROJECT_FILE_VERSION);
    expect(SKILL).toContain(`${WORKSPACE_DIR}/`);
  });

  /** The rule itself, in words an agent cannot read past. */
  it("states the split-file rule as a rule, not an option", () => {
    expect(SKILL).toMatch(/Never write the whole film into `project\.json`/);
    expect(SKILL).toMatch(/tracks\/<id>\.json/);
    expect(SKILL).toMatch(/elements\/<id>\.json/);
  });

  it("documents every tool the app registers, and no others", async () => {
    const { buildTools } = await import("@/lib/webmcp/tools");
    const { PRISM_TOOLSET_SWITCH } = await import("@/lib/webmcp/register");
    const registered = [...buildTools().map((tool) => tool.name), PRISM_TOOLSET_SWITCH];

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

  /**
   * ChatGPT's WebMCP validates inputSchema on registerTool and refuses what
   * it does not like — silently, per tool. Half the tools vanished there
   * once. So every schema is held to the core subset every host accepts.
   */
  it("keeps every tool's inputSchema to the core JSON Schema subset", async () => {
    const { buildTools } = await import("@/lib/webmcp/tools");
    const ALLOWED = new Set(["type", "description", "properties", "required", "items", "enum", "anyOf"]);
    for (const tool of buildTools()) {
      const check = (node: unknown, path: string): void => {
        if (Array.isArray(node)) {
          node.forEach((child, index) => check(child, `${path}[${index}]`));
          return;
        }
        if (node === null || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          expect(ALLOWED.has(key), `${tool.name} ${path}.${key}`).toBe(true);
          if (key === "properties") {
            for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
              check(child, `${path}.${name}`);
            }
          } else if (key === "items" || key === "anyOf") {
            check(value, `${path}.${key}`);
          }
        }
      };
      check(tool.inputSchema ?? {}, tool.name);
    }
  });

  it("folds the dropped bounds into descriptions, where the model reads them", async () => {
    const { buildTools } = await import("@/lib/webmcp/tools");
    const wait = buildTools().find((tool) => tool.name === "prism.wait_for_decision")!;
    const timeout = (wait.inputSchema as { properties: Record<string, { description?: string }> })
      .properties.timeoutSeconds!;
    expect(timeout.description).toMatch(/1–600/);
    const background = buildTools().find((tool) => tool.name === "prism.set_background")!;
    expect(JSON.stringify(background.inputSchema)).toContain("anyOf");
    expect(JSON.stringify(background.inputSchema)).not.toContain("oneOf");
  });

  it("states the approval boundary rather than leaving it implicit", () => {
    expect(SKILL).toMatch(/cannot approve your own work/i);
    expect(SKILL).toMatch(/approval.*per stage/i);
  });
});
