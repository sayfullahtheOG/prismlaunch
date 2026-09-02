import { generateStoryboard } from "./generator";
import type { Brief, FilmProject, ProductManifest } from "@/types/prism";

/**
 * How a film comes into existence.
 *
 * There is exactly one constructor, and everything uses it: source inspection
 * in the app, the Remotion Studio entry point, and the tests. That matters
 * because `FilmProject` has no representable empty state — the scene graph is
 * exactly four scenes in fixed slots, so "no film" is the absence of a project
 * rather than a project with nothing in it (see lib/studio/store.ts). Anything
 * that wants a film has to build a whole one, and this is where that happens.
 */

/**
 * The look a first film opens in. Monochrome is the safe default: it flatters
 * every product, and it is the choice a person is most likely to keep.
 */
export const DEFAULT_ART_DIRECTION: Brief["artDirection"] = "minimal-dark";

/**
 * The brief a manifest implies before anyone has expressed a preference. The
 * product's own description is the honest opening promise — it is the one
 * sentence the source actually claims about itself.
 */
export function initialBrief(
  manifest: ProductManifest,
  artDirection: Brief["artDirection"] = DEFAULT_ART_DIRECTION,
): Brief {
  const first = manifest.componentCandidates[0];
  return {
    promise: manifest.description,
    artDirection,
    selectedComponentIds: first ? [first.id] : [],
  };
}

export function createFilmProject(
  manifest: ProductManifest,
  brief: Brief = initialBrief(manifest),
): FilmProject {
  const now = new Date().toISOString();
  return {
    id: `film-${Date.now().toString(36)}`,
    product: manifest,
    brief,
    scenes: generateStoryboard(manifest, brief),
    activeSceneId: "scene-01",
    activity: [],
    createdAt: now,
    updatedAt: now,
  };
}
