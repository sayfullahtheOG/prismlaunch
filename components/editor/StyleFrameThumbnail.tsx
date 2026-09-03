"use client";

import { Thumbnail } from "@remotion/player";
import { useStudioStore } from "@/lib/studio/store";
import { Film } from "@/remotion/Film";
import type { ProjectFile } from "@/types/prism";

/** An inert film frame: no editor state, transport or interactive HTML controls. */
export function StyleFrameThumbnail({ file, frame }: { file: ProjectFile; frame: number }) {
  const assets = useStudioStore((state) => state.assets);
  return (
    <div inert className="pointer-events-none overflow-hidden rounded-sm border border-line-soft" style={{ aspectRatio: `${file.width} / ${file.height}` }}>
      <Thumbnail
        component={Film}
        inputProps={{ file, assets }}
        frameToDisplay={frame}
        durationInFrames={file.durationInFrames}
        fps={file.fps}
        compositionWidth={file.width}
        compositionHeight={file.height}
        style={{ width: "100%", height: "100%" }}
        errorFallback={() => <p className="p-4 text-xs text-muted">Frame preview unavailable.</p>}
      />
    </div>
  );
}
