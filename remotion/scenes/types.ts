import type { Palette, Scene } from "@/types/prism";

/**
 * Every scene component receives exactly this and nothing else.
 *
 * No store, no context, no network — a scene is a pure function of the graph,
 * which is what lets the same component drive both the in-browser Player and
 * the server render (context/architecture.md invariant 12).
 */
export type SceneProps = {
  scene: Scene;
  palette: Palette;
  /** Resolved from the manifest, so the scene never looks anything up itself. */
  componentLabel?: string | undefined;
};
