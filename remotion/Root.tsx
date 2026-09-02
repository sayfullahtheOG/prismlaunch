import { Composition } from "remotion";
import {
  DEFAULT_ANIMATION,
  DEFAULT_BOX,
  EMPTY_PROCESS,
  PROJECT_FILE_VERSION,
} from "@/lib/studio/schema";
import type { ProjectFile } from "@/types/prism";
import { Film, type FilmProps } from "./Film";

/**
 * Registers the single composition. Size and duration come from the file, so a
 * composition someone re-timed renders at its real length.
 *
 * `defaultProps` is a fixture — `npx remotion studio` needs something on screen
 * to open on, and nothing in the app reads it. It is the only invented film in
 * the codebase, and it lives here rather than in lib/ so it cannot be mistaken
 * for content the product ships. Real compositions come from a person's own
 * `.prismlaunch/<slug>/project.json`.
 */
const FIXTURE: ProjectFile = {
  version: PROJECT_FILE_VERSION,
  name: "Studio fixture",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
  background: { kind: "gradient", from: "#0A0A0C", to: "#1B1B22", angle: 160 },
  process: EMPTY_PROCESS,
  tracks: [
    {
      id: "track-1",
      kind: "visual",
      name: "Titles",
      hidden: false,
      locked: false,
      volume: 1,
      clips: [
        {
          kind: "text",
          id: "clip-1",
          from: 10,
          durationInFrames: 130,
          approval: "accepted",
          text: "A free canvas.",
          fontSize: 0.14,
          fontFamily: "display",
          fontWeight: 400,
          color: "#F5F5F7",
          align: "center",
          lineHeight: 1.1,
          letterSpacing: -0.02,
          box: { ...DEFAULT_BOX },
          animation: { ...DEFAULT_ANIMATION, enter: "rise", exit: "fade" },
        },
      ],
    },
  ],
};

export function RemotionRoot() {
  return (
    <Composition
      id="Film"
      component={Film}
      fps={FIXTURE.fps}
      width={FIXTURE.width}
      height={FIXTURE.height}
      durationInFrames={FIXTURE.durationInFrames}
      defaultProps={{ file: FIXTURE, assets: {} } satisfies FilmProps}
      calculateMetadata={({ props }: { props: FilmProps }) => ({
        durationInFrames: props.file.durationInFrames,
        fps: props.file.fps,
        width: props.file.width,
        height: props.file.height,
      })}
    />
  );
}
