import { describe, expect, it } from "vitest";
import {
  explainZodError,
  FilmProjectSchema,
  ProjectFileSchema,
  SceneGraphSchema,
  SceneSchema,
  SlugSchema,
  toolInputJsonSchema,
  WriteStoryboardInput,
} from "@/lib/studio/schema";
import type { Scene } from "@/types/prism";
import { film, projectFile, scenes } from "./fixture";

/**
 * The schema is now a file format as well as a runtime guard: an agent writes
 * `project.json` by hand, so every rule here is a rule someone will hit while
 * typing JSON into an editor. These tests pin the ones that matter and, just
 * as importantly, that the failure message names the field.
 */

describe("SceneGraphSchema", () => {
  it("accepts the fixture", () => {
    expect(SceneGraphSchema.safeParse(scenes()).success).toBe(true);
  });

  it("rejects a fifth scene", () => {
    expect(SceneGraphSchema.safeParse([...scenes(), scenes()[3]!]).success).toBe(
      false,
    );
  });

  it("rejects three scenes", () => {
    expect(SceneGraphSchema.safeParse(scenes().slice(0, 3)).success).toBe(false);
  });

  it("rejects a reordered board", () => {
    const swapped = scenes();
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(SceneGraphSchema.safeParse(swapped).success).toBe(false);
  });

  it("rejects a scene using the wrong template for its slot", () => {
    const wrong = scenes();
    wrong[0] = { ...wrong[0]!, template: "outcome-cta" };

    const result = SceneGraphSchema.safeParse(wrong);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toMatch(/kinetic-type/);
    }
  });

  it("requires a feature on the spotlight scene", () => {
    const bare = scenes();
    const { feature, ...withoutFeature } = bare[2]!;
    void feature;
    bare[2] = withoutFeature as Scene;

    const result = SceneGraphSchema.safeParse(bare);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toMatch(/feature/);
    }
  });

  it("rejects a film shorter than 16 seconds", () => {
    const short = scenes().map((scene) => ({ ...scene, durationFrames: 72 }));
    const result = SceneGraphSchema.safeParse(short);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toMatch(/16–22s/);
    }
  });

  it("rejects a film longer than 22 seconds", () => {
    const long = scenes().map((scene) => ({ ...scene, durationFrames: 144 }));
    expect(SceneGraphSchema.safeParse(long).success).toBe(false);
  });
});

describe("SceneSchema", () => {
  it("caps the headline at 56 characters", () => {
    const result = SceneSchema.safeParse({
      ...scenes()[0]!,
      headline: "x".repeat(57),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toMatch(/headline/);
    }
  });

  it("rejects a duration outside the per-scene bounds", () => {
    expect(
      SceneSchema.safeParse({ ...scenes()[0]!, durationFrames: 12 }).success,
    ).toBe(false);
  });
});

describe("ProjectFileSchema", () => {
  it("accepts the fixture file", () => {
    expect(ProjectFileSchema.safeParse(projectFile()).success).toBe(true);
  });

  it("rejects a file with no version", () => {
    const { version, ...withoutVersion } = projectFile();
    void version;
    expect(ProjectFileSchema.safeParse(withoutVersion).success).toBe(false);
  });

  /**
   * The in-app project carries selection and a session log; the file must not.
   * Round-tripping proves the extra fields are additive rather than a fork.
   */
  it("is the film project minus the tab-local fields", () => {
    const project = film();
    const { slug, activeSceneId, activity, ...rest } = project;
    void slug;
    void activeSceneId;
    void activity;

    expect(ProjectFileSchema.safeParse(rest).success).toBe(true);
    expect(FilmProjectSchema.safeParse(project).success).toBe(true);
  });
});

describe("SlugSchema", () => {
  it("accepts an ordinary folder name", () => {
    expect(SlugSchema.safeParse("vector-launch").success).toBe(true);
  });

  /**
   * The slug is interpolated into a filesystem path, so these are the cases
   * that matter most: anything that could climb out of the workspace or write
   * a hidden file has to be refused before it reaches `getDirectoryHandle`.
   */
  it.each([
    ["..", "parent directory"],
    ["../escape", "traversal"],
    ["a/b", "a slash"],
    [".hidden", "a leading dot"],
    ["-leading", "a leading dash"],
    ["Upper", "uppercase"],
    ["with space", "a space"],
    ["", "empty"],
  ])("rejects %s (%s)", (value) => {
    expect(SlugSchema.safeParse(value).success).toBe(false);
  });
});

describe("tool input schemas", () => {
  it("produce object JSON Schemas for the model to read", () => {
    const json = toolInputJsonSchema(WriteStoryboardInput);
    expect(json.type).toBe("object");
    expect(json).toHaveProperty("properties.scenes");
  });

  it("require exactly four scenes in a storyboard", () => {
    const one = {
      headline: "Only one",
      durationFrames: 96,
      motionPreset: "drift",
      emphasis: "problem",
    };
    expect(WriteStoryboardInput.safeParse({ scenes: [one] }).success).toBe(false);
    expect(
      WriteStoryboardInput.safeParse({ scenes: [one, one, one, one] }).success,
    ).toBe(true);
  });
});

describe("explainZodError", () => {
  it("names the field so an agent can fix it", () => {
    const result = SceneSchema.safeParse({ ...scenes()[0]!, headline: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(explainZodError(result.error)).toContain("headline");
    }
  });
});
