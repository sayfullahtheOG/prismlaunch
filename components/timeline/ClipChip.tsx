"use client";

import { useRef } from "react";
import {
  AudioLines,
  Image as ImageIcon,
  Sparkles,
  Square,
  Type,
  Video as VideoIcon,
} from "lucide-react";
import { dragClip, dragClipEdge, select } from "@/lib/studio/actions";
import { selectedClipId } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { Clip, ClipKind, ProjectFile } from "@/types/prism";
import {
  frameToX,
  snapFrame,
  snapTargets,
  trackAtPoint,
  xToFrame,
} from "./geometry";

/**
 * One clip in the timeline.
 *
 * Three drag targets in one element: the body moves it, and the two edges trim
 * it. They are separate pointer handlers rather than one with a mode flag,
 * because the mode is decided by *where you grabbed* and that is exactly what
 * separate handlers encode.
 *
 * Every drag writes through `actions`, which clamps against the neighbours on
 * the destination track — so a drag can never produce the overlap the schema
 * would reject, and there is no "invalid drop" state to design around. The
 * clip simply stops against whatever is in the way.
 */

const ICONS: Record<ClipKind, typeof Type> = {
  text: Type,
  shape: Square,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioLines,
};

/** Below this the chip is a coloured sliver, and labels would just be noise. */
const LABEL_MIN_WIDTH = 44;

type Props = {
  clip: Clip;
  file: ProjectFile;
  trackId: string;
  locked: boolean;
};

export function ClipChip({ clip, file, trackId, locked }: Props) {
  const pixelsPerSecond = useStudioStore((state) => state.pixelsPerSecond);
  const snap = useStudioStore((state) => state.snap);
  const playhead = useStudioStore((state) => state.playhead);
  const selectedId = useStudioStore((state) => selectedClipId(state.project));

  const dragging = useRef(false);

  const left = frameToX(clip.from, pixelsPerSecond, file.fps);
  const width = frameToX(clip.durationInFrames, pixelsPerSecond, file.fps);
  const selected = selectedId === clip.id;
  const draft = clip.approval === "draft";
  const Icon = ICONS[clip.kind];

  /** Pixels → frames, with snapping unless the person is holding a modifier. */
  function resolve(clientX: number, origin: number, startFrame: number, free: boolean) {
    const delta = xToFrame(clientX - origin, pixelsPerSecond, file.fps);
    const raw = Math.max(0, startFrame + delta);
    if (!snap || free) return raw;
    return snapFrame(
      raw,
      snapTargets(file, playhead, clip.id),
      pixelsPerSecond,
      file.fps,
    );
  }

  function onBodyDown(event: React.PointerEvent<HTMLDivElement>) {
    if (locked || event.button !== 0) return;
    event.stopPropagation();
    select(clip.id);

    const origin = event.clientX;
    const startFrame = clip.from;
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    dragging.current = false;

    function move(moveEvent: PointerEvent) {
      // A click that never moves should select, not commit a no-op drag.
      if (!dragging.current && Math.abs(moveEvent.clientX - origin) < 3) return;
      dragging.current = true;

      const from = resolve(
        moveEvent.clientX,
        origin,
        startFrame,
        moveEvent.altKey,
      );
      // Cross-track drags land wherever the pointer is; the action refuses a
      // visual clip on an audio track, so this cannot produce a bad file.
      const target = trackAtPoint(moveEvent.clientX, moveEvent.clientY) ?? trackId;
      dragClip(clip.id, target, from);
    }

    function up() {
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    }

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
  }

  function onEdgeDown(edge: "start" | "end") {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (locked || event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      select(clip.id);

      const origin = event.clientX;
      const startFrame =
        edge === "start" ? clip.from : clip.from + clip.durationInFrames;
      const element = event.currentTarget;
      element.setPointerCapture(event.pointerId);

      function move(moveEvent: PointerEvent) {
        dragClipEdge(
          clip.id,
          edge,
          resolve(moveEvent.clientX, origin, startFrame, moveEvent.altKey),
        );
      }

      function up() {
        element.releasePointerCapture(event.pointerId);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerup", up);
        element.removeEventListener("pointercancel", up);
      }

      element.addEventListener("pointermove", move);
      element.addEventListener("pointerup", up);
      element.addEventListener("pointercancel", up);
    };
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${clip.kind} clip${draft ? ", unreviewed draft" : ""}`}
      aria-current={selected ? "true" : undefined}
      onPointerDown={onBodyDown}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(clip.id);
        }
      }}
      style={{ left, width: Math.max(width, 3) }}
      className={`group ds-focus absolute top-1 bottom-1 flex items-center gap-1.5 overflow-hidden rounded-xs px-1.5 select-none ${
        locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
      } ${
        draft
          ? "bg-warning-soft ring-1 ring-warning"
          : clip.kind === "audio"
            ? "bg-accent-soft"
            : "bg-strong"
      } ${selected ? "ring-2 ring-accent" : ""}`}
    >
      {/*
        Trim handles. Rendered as buttons so they are reachable and announce
        themselves, but they carry no click behaviour — trimming is a drag, and
        a keyboard user resizes from the inspector's numeric fields instead.
      */}
      {!locked && width > LABEL_MIN_WIDTH ? (
        <>
          <button
            type="button"
            aria-label="Trim start"
            onPointerDown={onEdgeDown("start")}
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-ink/0 transition-colors duration-140 group-hover:bg-ink/15"
          />
          <button
            type="button"
            aria-label="Trim end"
            onPointerDown={onEdgeDown("end")}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-ink/0 transition-colors duration-140 group-hover:bg-ink/15"
          />
        </>
      ) : null}

      {width > LABEL_MIN_WIDTH ? (
        <>
          <Icon
            size={11}
            strokeWidth={2}
            aria-hidden
            className={draft ? "shrink-0 text-warning" : "shrink-0 text-muted"}
          />
          <span
            className={`truncate text-2xs font-medium ${
              draft ? "text-warning" : "text-ink"
            }`}
          >
            {label(clip)}
          </span>
          {draft ? (
            <Sparkles
              size={10}
              strokeWidth={2.4}
              aria-hidden
              className="ml-auto shrink-0 text-warning"
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** What to write on the chip. The clip's own words beat its type name. */
function label(clip: Clip): string {
  if (clip.label) return clip.label;
  switch (clip.kind) {
    case "text":
      return clip.text;
    case "shape":
      return clip.shape;
    case "image":
    case "video":
    case "audio":
      return clip.src.split("/").pop() ?? clip.src;
  }
}
