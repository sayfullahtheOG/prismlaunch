"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
    loading: () => <div className="size-full bg-black" />,
  },
);

/** Breathing room between the film and the edges of the stage. */
const STAGE_PADDING = 32;

/**
 * The stage.
 *
 * The film sits letterboxed on the darkest surface in the app with nothing
 * around it — no card, no shadow, no badge floating over the picture. The
 * frame's own edge is the only line, so the eye reads the film and not the
 * chrome. Its size and rate are in the transport bar, where the other
 * numbers are.
 *
 * The frame is sized in pixels from the stage's measured width and height,
 * whichever is tighter. CSS `aspect-ratio` cannot do this on its own: give
 * the box a width and cap its height and the width stays put when the cap
 * bites, leaving a box wider than the film with the film centred inside it
 * and the box's own colour showing either side. The Player fills exactly
 * what it is given, so the edge hugs the picture and nothing shows around it.
 */
export function Canvas({ file }: { file: ProjectFile }) {
  const missing = useStudioStore((state) => state.missingAssets);
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    // Measured once, now, rather than waiting for the observer's first
    // callback: an observer only fires when the page is being painted, and a
    // tab that opens in the background would otherwise show no film at all
    // until something else moved.
    function measure() {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setRoom((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const available = {
    width: Math.max(0, room.width - STAGE_PADDING * 2),
    height: Math.max(0, room.height - STAGE_PADDING * 2),
  };
  /*
   * Whole pixels, with the second dimension derived from the first rather
   * than both floored on their own. Flooring each separately lands the box a
   * fraction off the film's ratio; the Player fits the film exactly, and the
   * fraction shows as a hairline of whatever the box is painted along one
   * edge. Deriving keeps the box as close to the ratio as integers allow, and
   * the box is not painted at all, so what is left is a fraction of a pixel
   * of the stage — nothing.
   */
  const widthBound = available.width / file.width <= available.height / file.height;
  const frame = widthBound
    ? {
        width: Math.floor(available.width),
        height: Math.round((Math.floor(available.width) * file.height) / file.width),
      }
    : {
        width: Math.round((Math.floor(available.height) * file.width) / file.height),
        height: Math.floor(available.height),
      };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center">
        {frame.width > 0 ? (
          <div
            // Clamped to the room as well as measured from it, so a frame
            // sized before the properties pane appeared can never push a
            // scrollbar while the observer catches up.
            className="max-h-full max-w-full overflow-hidden shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
            style={{ width: frame.width, height: frame.height }}
          >
            <FilmPreview file={file} />
          </div>
        ) : null}
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
