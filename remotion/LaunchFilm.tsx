import { AbsoluteFill, Series } from "remotion";
import { PALETTES } from "@/lib/studio/palettes";
import type { ArtDirection, ComponentCandidate, Scene } from "@/types/prism";
import { ComponentSpotlight } from "./scenes/ComponentSpotlight";
import { KineticType } from "./scenes/KineticType";
import { OutcomeCta } from "./scenes/OutcomeCta";
import { ProductReveal } from "./scenes/ProductReveal";
import type { SceneProps } from "./scenes/types";

/**
 * The composition root.
 *
 * Receives a complete snapshot — no store, no fetch, no clock. The Player and
 * the server renderer mount this exact component with the same props, which is
 * what makes the export provably match the preview.
 */
export type LaunchFilmProps = {
  scenes: Scene[];
  artDirection: ArtDirection;
  candidates: ComponentCandidate[];
};

const RENDERERS: Record<Scene["template"], (props: SceneProps) => React.JSX.Element> = {
  "kinetic-type": KineticType,
  "product-reveal": ProductReveal,
  "component-spotlight": ComponentSpotlight,
  "outcome-cta": OutcomeCta,
};

export function LaunchFilm({ scenes, artDirection, candidates }: LaunchFilmProps) {
  const palette = PALETTES[artDirection];

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <Series>
        {scenes.map((scene) => {
          const Renderer = RENDERERS[scene.template];
          const label = candidates.find((c) => c.id === scene.componentId)?.label;

          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationFrames}
            >
              <Renderer
                scene={scene}
                palette={palette}
                componentLabel={label}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
}
