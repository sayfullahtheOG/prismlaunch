import { Composition } from "remotion";
import { demoProject } from "@/lib/source/demo-project";
import { totalFrames } from "@/lib/studio/timing";
import { FPS } from "@/lib/studio/schema";
import { LaunchFilm, type LaunchFilmProps } from "./LaunchFilm";

/**
 * Registers the single composition. 960×540 at 24fps, per the spec.
 *
 * Duration is derived from the passed scene graph rather than hardcoded, so a
 * board the user has re-timed renders at its real length. `defaultProps` is the
 * demo film, which is what `npx remotion studio` opens on.
 */
export function RemotionRoot() {
  return (
    <Composition
      id="LaunchFilm"
      component={LaunchFilm}
      fps={FPS}
      width={960}
      height={540}
      durationInFrames={totalFrames(demoProject.scenes)}
      defaultProps={
        {
          scenes: demoProject.scenes,
          artDirection: demoProject.brief.artDirection,
          candidates: demoProject.product.componentCandidates,
        } satisfies LaunchFilmProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props.scenes),
      })}
    />
  );
}
