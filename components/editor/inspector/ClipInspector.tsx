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

      {/*
        The review, as a strip rather than a box: what the agent said, and
        the two answers. Amber here means one thing — waiting on you.
      */}
      {draft ? (
        <div className="mx-4 mb-3 flex shrink-0 flex-col gap-2 border-y border-warning/30 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <Sparkles size={12} strokeWidth={2.2} aria-hidden />
            Added by your agent
          </p>
          {clip.revisionNote ? (
            <p className="text-xs leading-[var(--ds-leading-body)] text-muted">
              {clip.revisionNote}
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => acceptClip(clip.id)}
              icon={<Check size={12} strokeWidth={2.4} aria-hidden />}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => rejectClip(clip.id)}
              icon={<X size={12} strokeWidth={2.4} aria-hidden />}
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
          className="ds-focus mx-4 mb-3 flex h-7 shrink-0 items-center gap-2 rounded-sm px-1.5 text-left text-xs text-muted transition-[background-color] duration-140 hover:bg-sunken"
        >
          <Shapes size={12} strokeWidth={2} className="shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            From <span className="font-medium text-ink">{element.name}</span>
          </span>
          <span className="shrink-0 text-2xs text-subtle">Open</span>
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
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
