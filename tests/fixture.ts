import { demoManifest } from "@/lib/source/demo-manifest";
import { createFilmProject, initialBrief } from "@/lib/studio/new-project";
import type { Brief, FilmProject, ProductManifest } from "@/types/prism";

/**
 * The shared test fixture.
 *
 * Built through the real constructor rather than hand-authored, so the tests
 * exercise a film shaped exactly like one a person would get from inspecting a
 * source. If `createFilmProject` or the generator drifts, these break — which
 * is the point.
 *
 * The app itself ships no pre-made film: it starts empty and a project only
 * exists once someone inspects something (see lib/studio/store.ts). So a
 * fixture is a test concern now, and lives here rather than in lib/.
 */

export const manifest: ProductManifest = demoManifest;
export const brief: Brief = initialBrief(demoManifest);

export function film(): FilmProject {
  return createFilmProject(demoManifest, brief);
}
