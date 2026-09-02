"use client";

import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { acceptClip, patchClip, rejectClip } from "@/lib/studio/actions";
import { TransitionSchema } from "@/lib/studio/schema";
import type { Clip, ProjectFile, Track } from "@/types/prism";
import { ColorField, Heading, NumberField, Row } from "./fields";

/**
 * One clip's properties.
 *
 * Split by clip kind rather than showing every field greyed out, because a
 * shape has no line height and pretending otherwise makes the panel twice as
 * long and half as clear. What every visual clip shares — position, size,
 * animation — is in one block at the bottom.
 */

const TRANSITIONS = TransitionSchema.options.map((name) => ({
  value: name,
  label: name,
}));

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
  const set = (patch: Partial<Clip>) => patchClip(clip.id, patch);

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

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
        {clip.kind === "text" ? (
          <>
            <Field label="Text" htmlFor="clip-text">
              <TextArea
                id="clip-text"
                value={clip.text}
                onChange={(event) => set({ text: event.target.value })}
                rows={3}
              />
            </Field>
            <Row>
              <NumberField
                label="Size"
                value={clip.fontSize}
                step={0.005}
                onChange={(fontSize) => set({ fontSize })}
              />
              <NumberField
                label="Weight"
                value={clip.fontWeight}
                step={100}
                onChange={(fontWeight) => set({ fontWeight })}
              />
            </Row>
            <Field label="Font">
              <Segmented
                label="Font family"
                options={["display", "body", "mono"] as const}
                value={clip.fontFamily}
                onChange={(fontFamily) => set({ fontFamily })}
              />
            </Field>
            <Field label="Align">
              <Segmented
                label="Text align"
                options={["left", "center", "right"] as const}
                value={clip.align}
                onChange={(align) => set({ align })}
              />
            </Field>
            <ColorField
              label="Colour"
              value={clip.color}
              onChange={(color) => set({ color })}
            />
          </>
        ) : null}

        {clip.kind === "shape" ? (
          <>
            <Field label="Shape">
              <Segmented
                label="Shape"
                options={["rect", "ellipse"] as const}
                value={clip.shape}
                onChange={(shape) => set({ shape })}
              />
            </Field>
            <ColorField
              label="Fill"
              value={clip.fill}
              onChange={(fill) => set({ fill })}
            />
            <NumberField
              label="Corner radius"
              value={clip.radius}
              step={0.05}
              min={0}
              max={0.5}
              onChange={(radius) => set({ radius })}
            />
          </>
        ) : null}

        {clip.kind === "image" || clip.kind === "video" ? (
          <>
            <Field label="Source">
              <TextInput
                value={clip.src}
                onChange={(event) => set({ src: event.target.value })}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </Field>
            <Field label="Fit">
              <Segmented
                label="Fit"
                options={["cover", "contain", "fill"] as const}
                value={clip.fit}
                onChange={(fit) => set({ fit })}
              />
            </Field>
          </>
        ) : null}

        {clip.kind === "video" ? (
          <Row>
            <NumberField
              label="Volume"
              value={clip.volume}
              step={0.05}
              min={0}
              max={1}
              onChange={(volume) => set({ volume })}
            />
            <NumberField
              label="Start from"
              value={clip.startFrom}
              step={1}
              min={0}
              onChange={(startFrom) => set({ startFrom })}
            />
          </Row>
        ) : null}

        {clip.kind === "audio" ? (
          <>
            <Field label="Source">
              <TextInput
                value={clip.src}
                onChange={(event) => set({ src: event.target.value })}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </Field>
            <Row>
              <NumberField
                label="Volume"
                value={clip.volume}
                step={0.05}
                min={0}
                max={1}
                onChange={(volume) => set({ volume })}
              />
              <NumberField
                label="Rate"
                value={clip.playbackRate}
                step={0.05}
                onChange={(playbackRate) => set({ playbackRate })}
              />
            </Row>
            <Row>
              <NumberField
                label="Fade in"
                value={clip.fadeInFrames}
                step={1}
                min={0}
                onChange={(fadeInFrames) => set({ fadeInFrames })}
              />
              <NumberField
                label="Fade out"
                value={clip.fadeOutFrames}
                step={1}
                min={0}
                onChange={(fadeOutFrames) => set({ fadeOutFrames })}
              />
            </Row>
          </>
        ) : null}

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

        {"box" in clip ? (
          <>
            <Row>
              <NumberField
                label="X"
                value={clip.box.x}
                step={0.01}
                onChange={(x) => set({ box: { ...clip.box, x } })}
              />
              <NumberField
                label="Y"
                value={clip.box.y}
                step={0.01}
                onChange={(y) => set({ box: { ...clip.box, y } })}
              />
            </Row>
            <Row>
              <NumberField
                label="Width"
                value={clip.box.width}
                step={0.01}
                onChange={(width) => set({ box: { ...clip.box, width } })}
              />
              <NumberField
                label="Height"
                value={clip.box.height}
                step={0.01}
                onChange={(height) => set({ box: { ...clip.box, height } })}
              />
            </Row>
            <Row>
              <NumberField
                label="Rotation"
                value={clip.box.rotation}
                step={1}
                onChange={(rotation) => set({ box: { ...clip.box, rotation } })}
              />
              <NumberField
                label="Opacity"
                value={clip.box.opacity}
                step={0.05}
                min={0}
                max={1}
                onChange={(opacity) => set({ box: { ...clip.box, opacity } })}
              />
            </Row>
          </>
        ) : null}

        {"animation" in clip ? (
          <>
            <Row>
              <Field label="Enter">
                <Select
                  label="Enter transition"
                  options={TRANSITIONS}
                  value={clip.animation.enter}
                  onChange={(enter) =>
                    set({
                      animation: {
                        ...clip.animation,
                        enter: TransitionSchema.parse(enter),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Exit">
                <Select
                  label="Exit transition"
                  options={TRANSITIONS}
                  value={clip.animation.exit}
                  onChange={(exit) =>
                    set({
                      animation: {
                        ...clip.animation,
                        exit: TransitionSchema.parse(exit),
                      },
                    })
                  }
                />
              </Field>
            </Row>
            <Row>
              <NumberField
                label="Enter frames"
                value={clip.animation.enterFrames}
                step={1}
                min={0}
                max={120}
                onChange={(enterFrames) =>
                  set({ animation: { ...clip.animation, enterFrames } })
                }
              />
              <NumberField
                label="Exit frames"
                value={clip.animation.exitFrames}
                step={1}
                min={0}
                max={120}
                onChange={(exitFrames) =>
                  set({ animation: { ...clip.animation, exitFrames } })
                }
              />
            </Row>
          </>
        ) : null}
      </div>
    </>
  );
}
