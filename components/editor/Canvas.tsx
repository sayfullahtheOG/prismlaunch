"use client";

import dynamic from "next/dynamic";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile } from "@/types/prism";

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
    loading: () => <div className="size-full bg-canvas" />,
  },
);

/**
 * The stage.
 *
 * The film sits letterboxed on the darkest surface in the app with nothing
 * around it — no card, no shadow, no badge floating over the picture. The
 * frame's own edge is the only line, so the eye reads the film and not the
 * chrome. Its size and rate are in the transport bar, where the other
 * numbers are.
 */
export function Canvas({ file }: { file: ProjectFile }) {
  const missing = useStudioStore((state) => state.missingAssets);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div
          className="max-h-full w-full max-w-[1120px] overflow-hidden bg-black shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
          style={{ aspectRatio: `${file.width} / ${file.height}` }}
        >
          <FilmPreview file={file} />
        </div>
      </div>

      {/*
        A clip pointing at a file that is not there renders as a hole rather
        than a crash, so the only way anyone finds out is if we say so.
      */}
      {missing.length > 0 ? (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 border-t border-line-soft bg-warning-soft px-4 py-2 text-xs leading-[var(--ds-leading-body)] text-warning"
        >
          Missing {missing.length === 1 ? "asset" : "assets"}:{" "}
          <span className="font-mono">{missing.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}
