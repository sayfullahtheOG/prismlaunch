import { Composition } from "remotion";
import { demoManifest } from "@/lib/source/demo-manifest";
import { createFilmProject } from "@/lib/studio/new-project";
import { totalFrames } from "@/lib/studio/timing";
import { FPS } from "@/lib/studio/schema";
import { LaunchFilm, type LaunchFilmProps } from "./LaunchFilm";

/**
 * Registers the single composition. 960×540 at 24fps, per the spec.
 *
 * Duration is derived from the passed scene graph rather than hardcoded, so a
 * board the user has re-timed renders at its real length.
 *
 * `defaultProps` is a film generated from the demo manifest at module load —
 * the same construction path the app uses — because `npx remotion studio`
 * needs something on screen to open on. Nothing in the app reads this.
 */
const demoFilm = createFilmProject(demoManifest);

export function RemotionRoot() {
  return (
    <Composition
      id="LaunchFilm"
      component={LaunchFilm}
      fps={FPS}
      width={960}
      height={540}
      durationInFrames={totalFrames(demoFilm.scenes)}
      defaultProps={
        {
          scenes: demoFilm.scenes,
          artDirection: demoFilm.brief.artDirection,
          candidates: demoFilm.product.componentCandidates,
        } satisfies LaunchFilmProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props.scenes),
      })}
    />
  );
}
