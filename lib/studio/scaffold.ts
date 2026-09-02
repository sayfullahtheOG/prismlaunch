import { PROJECT_FILE_VERSION } from "./schema";
import type { ArtDirection, ProjectFile, Scene } from "@/types/prism";

/**
 * The empty form a new film starts as.
 *
 * PrismLaunch does not write copy. It used to — a template-driven generator
 * picked headlines from a pool — and that was the app having opinions it has
 * no basis for. The agent knows the product; we do not.
 *
 * But the graph is exactly four scenes and a headline cannot be empty, so
 * creating a project has to put *something* in the slots. These placeholders
 * are written to read as placeholders and every scene is marked `draft`, so a
 * film nobody has filled in cannot be exported. The agent overwrites all four
 * with `prism.write_storyboard`, or by editing project.json directly.
 *
 * 84 + 108 + 132 + 108 = 432 frames = 18.0s, inside the 16–22s window.
 */

const SLOTS: ReadonlyArray<{
  scene: Pick<Scene, "id" | "order" | "template" | "durationFrames" | "emphasis" | "motionPreset">;
  headline: string;
  body: string;
}> = [
  {
    scene: {
      id: "scene-01",
      order: 1,
      template: "kinetic-type",
      durationFrames: 84,
      emphasis: "problem",
      motionPreset: "drift",
    },
    headline: "The hook — name the problem",
    body: "One line on what is wrong with how this is done today.",
  },
  {
    scene: {
      id: "scene-02",
      order: 2,
      template: "product-reveal",
      durationFrames: 108,
      emphasis: "product",
      motionPreset: "snap",
    },
    headline: "The reveal — name the product",
    body: "What it is, in the fewest words that are still true.",
  },
  {
    scene: {
      id: "scene-03",
      order: 3,
      template: "feature-spotlight",
      durationFrames: 132,
      emphasis: "feature",
      motionPreset: "drift",
    },
    headline: "The proof — show one thing",
    body: "A single capability, shown rather than claimed.",
  },
  {
    scene: {
      id: "scene-04",
      order: 4,
      template: "outcome-cta",
      durationFrames: 108,
      emphasis: "outcome",
      motionPreset: "snap",
    },
    headline: "The resolve — land the outcome",
    body: "What is different for them now.",
  },
];

export function scaffoldScenes(): Scene[] {
  return SLOTS.map(({ scene, headline, body }) => ({
    ...scene,
    headline,
    body,
    approval: "draft" as const,
    revisionNote: "Placeholder — not written yet.",
    ...(scene.template === "feature-spotlight"
      ? { feature: { label: "The feature", visualTokens: [] } }
      : {}),
  }));
}

export function scaffoldProject(input: {
  name: string;
  productName: string;
  productDescription?: string;
  promise: string;
  artDirection?: ArtDirection;
}): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    name: input.name,
    product: {
      name: input.productName,
      description: input.productDescription ?? "",
    },
    brief: {
      promise: input.promise,
      // Monochrome unless asked otherwise: it flatters every product, and it
      // is the choice most people keep.
      artDirection: input.artDirection ?? "minimal-dark",
    },
    scenes: scaffoldScenes(),
  };
}

/** True while a scene still holds what `scaffoldScenes` put there. */
export function isPlaceholder(scene: Scene): boolean {
  return SLOTS.some((slot) => slot.headline === scene.headline);
}
