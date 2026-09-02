"use client";

import dynamic from "next/dynamic";
import type { ArtDirection, ComponentCandidate, Scene, SceneId } from "@/types/prism";

/**
 * The Player is loaded client-only, deliberately.
 *
 * `remotion/fonts.ts` calls `loadFont()` at module scope, which needs a real
 * `document`. Server-rendering this subtree runs that during SSR and throws
 * ("the font ... does not have a style [object Object]") before the client ever
 * gets a chance. Remotion's own bundle is never server-rendered, so this only
 * bites when embedding `<Player>` inside a Next.js app.
 */
const FilmPreview = dynamic(
  () => import("./FilmPreview").then((mod) => mod.FilmPreview),
  {
    ssr: false,
    loading: () => <div className="size-full bg-sunken" />,
  },
);

type Props = {
  scenes: Scene[];
  artDirection: ArtDirection;
  candidates: ComponentCandidate[];
  activeSceneId: SceneId;
  playToken: number;
};

export function Canvas({
  scenes,
  artDirection,
  candidates,
  activeSceneId,
  playToken,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-sunken p-8">
      <div className="relative w-full max-w-[880px]">
        <span className="ds-level absolute -top-8 left-0 flex items-center gap-2 rounded-xs bg-surface px-2.5 py-1 text-2xs font-medium text-muted">
          16:9
          <span className="tabular font-mono text-subtle">960×540</span>
        </span>

        <div className="ds-floating aspect-video w-full overflow-hidden rounded-md bg-sunken">
          <FilmPreview
            scenes={scenes}
            artDirection={artDirection}
            candidates={candidates}
            activeSceneId={activeSceneId}
            playToken={playToken}
          />
        </div>
      </div>
    </div>
  );
}
