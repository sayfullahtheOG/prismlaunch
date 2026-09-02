"use client";

import { Check, Shapes, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { acceptClip, patchClip, rejectClip, select } from "@/lib/studio/actions";
import { findElement } from "@/lib/studio/edits";
import type { Clip, ProjectFile, Track } from "@/types/prism";
import {
  AnimationFields,
  AudioFields,
  BoxFields,
  PictureFields,
  ShapeFields,
  TextFields,
  VideoFields,
} from "./clip-fields";
import { Heading, NumberField, Row } from "./fields";

/**
 * One clip's properties.
 *
 * Split by clip kind rather than showing every field greyed out, because a
 * shape has no line height and pretending otherwise makes the panel twice as
 * long and half as clear. What every visual clip shares — position, size,
 * animation — is in one block at the bottom.
 *
 * A clip placed from an element says so at the top, with a way to reach the
 * element: a change that should apply to every headline belongs there, not
 * here.
 */
export function ClipInspector({
  clip,
  track,
  file,
}: {
  clip: Clip;
  track: Track;
  file: ProjectFile;
}) {
  const draft = clip.approval === "draft";
  // Every field group hands back a partial of its own slice; the action
  // re-validates the merged clip, so the cast is checked one step later.
  const set = (patch: object) => patchClip(clip.id, patch as Partial<Clip>);
  const element = clip.elementId ? findElement(file, clip.elementId) : undefined;

  return (
    <>
      <Heading
        title={clip.kind}
        detail={`${track.name} · ${(clip.durationInFrames / file.fps).toFixed(1)}s · ${clip.id}`}
      />

      {draft ? (
        <div className="mx-4 mb-4 shrink-0 rounded-sm bg-warning-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Sparkles size={13} strokeWidth={2.2} aria-hidden />
            Your agent added this
          </p>
          {clip.revisionNote ? (
            <p className="mt-1.5 text-xs leading-[var(--ds-leading-body)] text-muted">
              {clip.revisionNote}
            </p>
          ) : null}
          <div className="mt-2.5 flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => acceptClip(clip.id)}
              icon={<Check size={14} strokeWidth={2.4} aria-hidden />}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => rejectClip(clip.id)}
              icon={<X size={14} strokeWidth={2.4} aria-hidden />}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      {element ? (
        <button
          type="button"
          onClick={() => select(element.id)}
          className="ds-focus mx-4 mb-4 flex shrink-0 items-center gap-2 rounded-sm bg-sunken px-3 py-2 text-left text-xs transition-[background-color] duration-140 hover:bg-strong"
        >
          <Shapes size={13} strokeWidth={2} className="shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-muted">
            From <span className="font-semibold text-ink">{element.name}</span>
          </span>
          <span className="shrink-0 text-2xs text-subtle">Open element</span>
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
        {clip.kind === "text" ? <TextFields value={clip} set={set} words="required" /> : null}
        {clip.kind === "shape" ? <ShapeFields value={clip} set={set} /> : null}
        {clip.kind === "image" || clip.kind === "video" ? (
          <PictureFields value={clip} set={set} />
        ) : null}
        {clip.kind === "video" ? <VideoFields value={clip} set={set} /> : null}
        {clip.kind === "audio" ? <AudioFields value={clip} set={set} /> : null}

        <Row>
          <NumberField
            label="Start frame"
            value={clip.from}
            step={1}
            min={0}
            onChange={(from) => set({ from })}
          />
          <NumberField
            label="Frames"
            value={clip.durationInFrames}
            step={1}
            min={1}
            onChange={(durationInFrames) => set({ durationInFrames })}
          />
        </Row>

        {"box" in clip ? <BoxFields box={clip.box} set={(box) => set({ box })} /> : null}
        {"animation" in clip ? (
          <AnimationFields animation={clip.animation} set={(animation) => set({ animation })} />
        ) : null}
      </div>
    </>
  );
}
