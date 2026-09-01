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
    loading: () => <div className="size-full bg-ink/90" />,
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
    <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-6">
      <div className="relative w-full max-w-[880px]">
        <span className="absolute -top-7 left-0 flex items-center gap-2 rounded-ctl bg-surface px-2 py-1 text-[11px] font-medium text-muted shadow-xs">
          16:9
          <span className="font-mono text-faint">960×540</span>
        </span>

        <div className="aspect-video w-full overflow-hidden rounded-card shadow-lg">
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
