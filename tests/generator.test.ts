import { describe, expect, it } from "vitest";
import { demoProject } from "@/lib/source/demo-project";
import { fit, generateStoryboard } from "@/lib/studio/generator";
import { HEADLINE_MAX, SceneGraphSchema } from "@/lib/studio/schema";
import { totalSeconds } from "@/lib/studio/timing";
import type { Brief, ProductManifest } from "@/types/prism";

const manifest: ProductManifest = demoProject.product;
const brief: Brief = demoProject.brief;

/** A manifest where inspection found metadata but no usable candidates. */
const bareManifest: ProductManifest = {
  ...manifest,
  componentCandidates: [],
  inspectionWarnings: ["No exported components matched the allowlist."],
};

describe("generateStoryboard", () => {
  it("produces a graph that satisfies every structural rule", () => {
    const scenes = generateStoryboard(manifest, brief);
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(true);
  });

  it("lands inside the 16–22 second window", () => {
    const seconds = totalSeconds(generateStoryboard(manifest, brief));
    expect(seconds).toBeGreaterThanOrEqual(16);
    expect(seconds).toBeLessThanOrEqual(22);
  });

  it("is deterministic — same inputs, same board", () => {
    const a = generateStoryboard(manifest, brief);
    const b = generateStoryboard(manifest, brief);
    expect(a).toEqual(b);
  });

  it("varies the hook between different products", () => {
    // Not a guarantee for every pair, but these two must differ or the seeding
    // is doing nothing useful.
    const one = generateStoryboard(manifest, brief)[0]!.headline;
    const two = generateStoryboard(
      { ...manifest, productName: "Quill" },
      brief,
    )[0]!.headline;
    expect(one).not.toBe(two);
  });

  it("features the component the brief selected", () => {
    const scenes = generateStoryboard(manifest, {
      ...brief,
      selectedComponentIds: ["cmp-cycle-board"],
    });
    expect(scenes[2]!.componentId).toBe("cmp-cycle-board");
    expect(scenes[2]!.headline.toLowerCase()).toContain("cycle board");
  });

  it("falls back to the highest-scored candidate when the brief selects none", () => {
    const scenes = generateStoryboard(manifest, {
      ...brief,
      selectedComponentIds: [],
    });
    expect(scenes[2]!.componentId).toBe(manifest.componentCandidates[0]!.id);
  });

  it("ignores a selected id that is not in the manifest", () => {
    const scenes = generateStoryboard(manifest, {
      ...brief,
      selectedComponentIds: ["cmp-ghost"],
    });
    expect(scenes[2]!.componentId).toBe(manifest.componentCandidates[0]!.id);
  });

  it("does not invent a component when inspection found none", () => {
    // The spotlight scene still exists — the structure is fixed — but it must
    // not claim a component the source does not evidence.
    const scenes = generateStoryboard(bareManifest, {
      ...brief,
      selectedComponentIds: [],
    });
    expect(scenes[2]!.componentId).toBeUndefined();
    expect(scenes[2]!.headline).toContain("Vector");
  });

  it("carries the promise into the reveal scene", () => {
    const scenes = generateStoryboard(manifest, brief);
    expect(scenes[1]!.headline).toBe("Vector");
    expect(scenes[1]!.body).toBe(brief.promise);
  });

  it("survives an absurdly long promise and product name", () => {
    const scenes = generateStoryboard(
      { ...manifest, productName: "A".repeat(200) },
      { ...brief, promise: "word ".repeat(80) },
    );
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(true);
  });

  it("survives an empty product name", () => {
    const scenes = generateStoryboard(
      { ...manifest, productName: "   " },
      brief,
    );
    expect(SceneGraphSchema.safeParse(scenes).success).toBe(true);
    expect(scenes[1]!.headline.length).toBeGreaterThan(0);
  });
});

describe("fit", () => {
  it("leaves short text alone", () => {
    expect(fit("Short enough", HEADLINE_MAX)).toBe("Short enough");
  });

  it("collapses whitespace", () => {
    expect(fit("  too   much\n space ", HEADLINE_MAX)).toBe("too much space");
  });

  it("never exceeds the limit", () => {
    expect(fit("x".repeat(200), 56).length).toBeLessThanOrEqual(56);
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const result = fit("alpha beta gamma delta epsilon zeta", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith(" ")).toBe(false);
    // "gamm" would mean it cut mid-word.
    expect(result.split(" ").pop()).not.toBe("gamm");
  });

  it("strips a trailing separator left by the cut", () => {
    expect(fit("alpha beta, gamma delta", 12)).not.toMatch(/[,;:.\-]$/);
  });

  it("hard-cuts a single unbroken token", () => {
    // No word boundary to fall back to — the limit still has to hold.
    expect(fit("x".repeat(100), 10)).toHaveLength(10);
  });
});
