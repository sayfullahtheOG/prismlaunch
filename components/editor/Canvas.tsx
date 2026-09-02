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
    loading: () => <div className="size-full bg-sunken" />,
  },
);

export function Canvas({ file }: { file: ProjectFile }) {
  const missing = useStudioStore((state) => state.missingAssets);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-sunken p-6">
      <div className="relative flex w-full max-w-[900px] flex-col">
        <span className="ds-level mb-2 flex items-center gap-2 self-start rounded-xs bg-surface px-2.5 py-1 text-2xs font-medium text-muted">
          {file.width}×{file.height}
          <span className="tabular font-mono text-subtle">{file.fps}fps</span>
        </span>

        <div
          className="ds-floating w-full overflow-hidden rounded-md bg-sunken"
          style={{ aspectRatio: `${file.width} / ${file.height}` }}
        >
          <FilmPreview file={file} />
        </div>

        {/*
          A clip pointing at a file that is not there renders as a hole rather
          than a crash, so the only way anyone finds out is if we say so.
        */}
        {missing.length > 0 ? (
          <p
            role="alert"
            className="ds-level mt-2 rounded-sm bg-warning-soft px-3 py-2 text-2xs leading-[var(--ds-leading-body)] text-warning"
          >
            Missing {missing.length === 1 ? "asset" : "assets"}:{" "}
            <span className="font-mono">{missing.join(", ")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
