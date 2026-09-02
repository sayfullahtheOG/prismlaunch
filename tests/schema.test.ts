import { describe, expect, it } from "vitest";
import { demoProject } from "@/lib/source/demo-project";
import {
  explainZodError,
  FilmProjectSchema,
  SceneGraphSchema,
  toolInputJsonSchema,
  SceneSchema,
} from "@/lib/studio/schema";
import type { FilmProject, Scene } from "@/types/prism";

/** Deep-clone the demo so no test mutates the shared fixture. */
function clone(): FilmProject {
  return structuredClone(demoProject);
}

describe("SceneGraphSchema", () => {
  it("accepts the demo film", () => {
    expect(SceneGraphSchema.safeParse(demoProject.scenes).success).toBe(true);
  });

  it("rejects a fifth scene", () => {
    const scenes = [...clone().scenes, clone().scenes[3]!];
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(false);
  });

  it("rejects three scenes", () => {
    const scenes = clone().scenes.slice(0, 3);
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(false);
  });

  it("rejects a reordered board", () => {
    const scenes = clone().scenes;
    [scenes[0], scenes[1]] = [scenes[1]!, scenes[0]!];

    const result = SceneGraphSchema.safeParse(scenes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("scene-01");
    }
  });

  it("rejects a swapped template even in the right slot", () => {
    const scenes = clone().scenes;
    scenes[0] = { ...scenes[0]!, template: "outcome-cta" };

    const result = SceneGraphSchema.safeParse(scenes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("kinetic-type");
    }
  });

  it("rejects a film shorter than 16 seconds", () => {
    // 4 × 72 frames = 288 frames = 12s
    const scenes = clone().scenes.map((scene) => ({
      ...scene,
      durationFrames: 72,
    }));

    const result = SceneGraphSchema.safeParse(scenes);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("16–22s");
    }
  });

  it("rejects a film longer than 22 seconds", () => {
    // 4 × 144 frames = 576 frames = 24s
    const scenes = clone().scenes.map((scene) => ({
      ...scene,
      durationFrames: 144,
    }));
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(false);
  });

  it("rejects a scene shorter than the per-scene minimum", () => {
    const scenes = clone().scenes;
    scenes[0] = { ...scenes[0]!, durationFrames: 24 };
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(false);
  });
});

describe("SceneSchema", () => {
  it("rejects a headline over 56 characters", () => {
    const scene: Scene = clone().scenes[0]!;
    const result = SceneSchema.safeParse({
      ...scene,
      headline: "x".repeat(57),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a headline at exactly the limit", () => {
    const scene: Scene = clone().scenes[0]!;
    expect(
      SceneSchema.safeParse({ ...scene, headline: "x".repeat(56) }).success,
    ).toBe(true);
  });

  it("rejects an empty headline", () => {
    const scene: Scene = clone().scenes[0]!;
    expect(SceneSchema.safeParse({ ...scene, headline: "" }).success).toBe(false);
  });

  it("rejects a body over 110 characters", () => {
    const scene: Scene = clone().scenes[1]!;
    expect(
      SceneSchema.safeParse({ ...scene, body: "x".repeat(111) }).success,
    ).toBe(false);
  });
});

describe("FilmProjectSchema component binding", () => {
  it("accepts the demo project", () => {
    expect(FilmProjectSchema.safeParse(demoProject).success).toBe(true);
  });

  it("rejects component-spotlight with no componentId", () => {
    const project = clone();
    delete project.scenes[2]!.componentId;

    const result = FilmProjectSchema.safeParse(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("requires a componentId");
    }
  });

  it("rejects a componentId that is not in the manifest", () => {
    const project = clone();
    project.scenes[2]!.componentId = "cmp-does-not-exist";

    const result = FilmProjectSchema.safeParse(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("unknown componentId");
    }
  });

  it("does not require a componentId on other templates", () => {
    const project = clone();
    delete project.scenes[0]!.componentId;
    expect(FilmProjectSchema.safeParse(project).success).toBe(true);
  });
});

describe("toolInputJsonSchema", () => {
  it("produces a JSON Schema object a WebMCP tool can advertise", () => {
    const json = toolInputJsonSchema(SceneSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };

    expect(json.type).toBe("object");
    expect(json.properties).toHaveProperty("headline");
    expect(json.required).toContain("headline");
    // Optional fields must not be advertised as required.
    expect(json.required).not.toContain("body");
  });

  it("is JSON-serialisable, since it crosses the WebMCP boundary as JSON", () => {
    expect(() => JSON.stringify(toolInputJsonSchema(SceneSchema))).not.toThrow();
  });
});

describe("explainZodError", () => {
  it("returns a short corrective sentence rather than a dump", () => {
    const result = SceneSchema.safeParse({ id: "scene-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = explainZodError(result.error);
      expect(message.length).toBeGreaterThan(0);
      expect(message.split(";").length).toBeLessThanOrEqual(4);
    }
  });
});
