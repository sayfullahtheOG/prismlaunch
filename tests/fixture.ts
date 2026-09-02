import { PROJECT_FILE_VERSION } from "@/lib/studio/schema";
import type { FilmProject, ProjectFile, Scene } from "@/types/prism";

/**
 * The shared test fixture.
 *
 * Hand-authored, and the only invented film outside `remotion/Root.tsx`. The
 * product ships no sample content: a film comes from a person's own
 * `.prismlaunch/<slug>/project.json`, written by their agent. So a fixture is
 * purely a test concern and lives here.
 *
 * 84 + 108 + 132 + 108 = 432 frames = 18.0s, inside the 16–22s window.
 */

export function scenes(): Scene[] {
  return [
    {
      id: "scene-01",
      order: 1,
      template: "kinetic-type",
      durationFrames: 84,
      headline: "Most tools make you click. A lot.",
      body: "Six clicks to assign an issue. Every time.",
      motionPreset: "drift",
      emphasis: "problem",
      approval: "accepted",
    },
    {
      id: "scene-02",
      order: 2,
      template: "product-reveal",
      durationFrames: 108,
      headline: "Vector",
      body: "An issue tracker you drive from the keyboard.",
      motionPreset: "snap",
      emphasis: "product",
      approval: "accepted",
    },
    {
      id: "scene-03",
      order: 3,
      template: "feature-spotlight",
      durationFrames: 132,
      headline: "Meet the command palette.",
      feature: {
        label: "Command palette",
        visualTokens: ["Assign to me", "Move to cycle"],
      },
      motionPreset: "drift",
      emphasis: "feature",
      approval: "accepted",
    },
    {
      id: "scene-04",
      order: 4,
      template: "outcome-cta",
      durationFrames: 108,
      headline: "The fast path, by default.",
      body: "vector.app",
      motionPreset: "snap",
      emphasis: "outcome",
      approval: "accepted",
    },
  ];
}

export function projectFile(): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    name: "Vector launch video",
    product: {
      name: "Vector",
      description: "A keyboard-first issue tracker for small product teams.",
    },
    brief: {
      promise: "Every action, one keystroke away.",
      artDirection: "minimal-dark",
    },
    scenes: scenes(),
  };
}

export function film(): FilmProject {
  return {
    ...projectFile(),
    slug: "vector-launch",
    activeSceneId: "scene-01",
    activity: [],
  };
}
