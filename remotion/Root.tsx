import { Composition } from "remotion";
import { FPS } from "@/lib/studio/schema";
import { totalFrames } from "@/lib/studio/timing";
import type { Scene } from "@/types/prism";
import { LaunchFilm, type LaunchFilmProps } from "./LaunchFilm";

/**
 * Registers the single composition. 960×540 at 24fps, per the spec.
 *
 * Duration is derived from the passed scene graph rather than hardcoded, so a
 * board someone has re-timed renders at its real length.
 *
 * `defaultProps` is a fixture — `npx remotion studio` needs something on screen
 * to open on, and nothing in the app reads it. It is the only invented film in
 * the codebase, and it lives here rather than in lib/ so it cannot be mistaken
 * for content the product ships. Real films come from a person's own
 * `.prismlaunch/<slug>/project.json`.
 */

const FIXTURE: Scene[] = [
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
      visualTokens: ["Assign to me", "Move to cycle", "Add to project"],
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

export function RemotionRoot() {
  return (
    <Composition
      id="LaunchFilm"
      component={LaunchFilm}
      fps={FPS}
      width={960}
      height={540}
      durationInFrames={totalFrames(FIXTURE)}
      defaultProps={
        {
          scenes: FIXTURE,
          artDirection: "minimal-dark",
        } satisfies LaunchFilmProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props.scenes),
      })}
    />
  );
}
