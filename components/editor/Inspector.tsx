"use client";

import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { acceptClip, patchClip, rejectClip } from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";
import type { Clip, ProjectFile, Track } from "@/types/prism";

/**
 * Properties of whatever is selected.
 *
 * Split by clip kind rather than showing every field greyed out, because a
 * shape has no line height and pretending otherwise makes the panel twice as
 * long and half as clear. What every visual clip shares — position, size,
 * animation — is in one block at the bottom.
 *
 * Numbers are entered as numbers. A drag handle for `x` would be nicer to use
 * and impossible to be precise with, and the timeline is already the place for
 * approximate.
 */

const TRANSITIONS = [
  "none",
  "fade",
  "rise",
  "fall",
  "slide-left",
  "slide-right",
  "scale",
  "blur",
] as const;

export function Inspector({ file }: { file: ProjectFile }) {
  const selectedId = useStudioStore((state) => state.project?.selectedId ?? null);

  const found = selectedId
    ? file.tracks
        .flatMap((track) =>
          track.clips.map((clip) => ({ track, clip })),
        )
        .find((entry) => entry.clip.id === selectedId)
    : undefined;

  return (
    <aside
      aria-label="Properties"
      className="thin-scroll flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line-soft bg-surface"
    >
      {found ? (
        <ClipInspector clip={found.clip} track={found.track} file={file} />
      ) : (
        <Empty />
      )}
    </aside>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-center text-xs leading-[var(--ds-leading-body)] text-subtle">
        Select a clip in the timeline to edit it.
      </p>
    </div>
  );
}

function ClipInspector({
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
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold tracking-[var(--ds-tracking-tight)] capitalize">
          {clip.kind}
        </h2>
        <p className="tabular mt-0.5 font-mono text-2xs text-subtle">
          {track.name} · {(clip.durationInFrames / file.fps).toFixed(1)}s ·{" "}
          {clip.id}
        </p>
      </div>

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
              <Number
                label="Size"
                value={clip.fontSize}
                step={0.005}
                onChange={(fontSize) => set({ fontSize })}
              />
              <Number
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
          </>
        ) : null}

        {clip.kind === "image" || clip.kind === "video" ? (
          <Field label="Source">
            <TextInput
              value={clip.src}
              onChange={(event) => set({ src: event.target.value })}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </Field>
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
              <Number
                label="Volume"
                value={clip.volume}
                step={0.05}
                onChange={(volume) => set({ volume })}
              />
              <Number
                label="Rate"
                value={clip.playbackRate}
                step={0.05}
                onChange={(playbackRate) => set({ playbackRate })}
              />
            </Row>
            <Row>
              <Number
                label="Fade in"
                value={clip.fadeInFrames}
                step={1}
                onChange={(fadeInFrames) => set({ fadeInFrames })}
              />
              <Number
                label="Fade out"
                value={clip.fadeOutFrames}
                step={1}
                onChange={(fadeOutFrames) => set({ fadeOutFrames })}
              />
            </Row>
          </>
        ) : null}

        <Row>
          <Number
            label="Start frame"
            value={clip.from}
            step={1}
            onChange={(from) => set({ from })}
          />
          <Number
            label="Frames"
            value={clip.durationInFrames}
            step={1}
            onChange={(durationInFrames) => set({ durationInFrames })}
          />
        </Row>

        {"box" in clip ? (
          <>
            <Row>
              <Number
                label="X"
                value={clip.box.x}
                step={0.01}
                onChange={(x) => set({ box: { ...clip.box, x } })}
              />
              <Number
                label="Y"
                value={clip.box.y}
                step={0.01}
                onChange={(y) => set({ box: { ...clip.box, y } })}
              />
            </Row>
            <Row>
              <Number
                label="Width"
                value={clip.box.width}
                step={0.01}
                onChange={(width) => set({ box: { ...clip.box, width } })}
              />
              <Number
                label="Height"
                value={clip.box.height}
                step={0.01}
                onChange={(height) => set({ box: { ...clip.box, height } })}
              />
            </Row>
            <Row>
              <Number
                label="Rotation"
                value={clip.box.rotation}
                step={1}
                onChange={(rotation) => set({ box: { ...clip.box, rotation } })}
              />
              <Number
                label="Opacity"
                value={clip.box.opacity}
                step={0.05}
                onChange={(opacity) => set({ box: { ...clip.box, opacity } })}
              />
            </Row>
          </>
        ) : null}

        {"animation" in clip ? (
          <>
            <Field label="Enter" htmlFor="clip-enter">
              <select
                id="clip-enter"
                value={clip.animation.enter}
                onChange={(event) =>
                  set({
                    animation: {
                      ...clip.animation,
                      enter: event.target
                        .value as (typeof TRANSITIONS)[number],
                    },
                  })
                }
                className="ds-focus ds-inset w-full rounded-sm bg-sunken px-2.5 py-2 text-xs text-ink"
              >
                {TRANSITIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exit" htmlFor="clip-exit">
              <select
                id="clip-exit"
                value={clip.animation.exit}
                onChange={(event) =>
                  set({
                    animation: {
                      ...clip.animation,
                      exit: event.target.value as (typeof TRANSITIONS)[number],
                    },
                  })
                }
                className="ds-focus ds-inset w-full rounded-sm bg-sunken px-2.5 py-2 text-xs text-ink"
              >
                {TRANSITIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
      </div>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Number({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        value={value}
        step={step}
        onChange={(event) => {
          const next = globalThis.Number(event.target.value);
          // A half-typed "-" or "" parses to NaN, and writing that would fail
          // validation on every keystroke. Ignore it and wait for a number.
          if (!globalThis.isNaN(next)) onChange(next);
        }}
        className="tabular font-mono text-xs"
      />
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          // The native picker cannot express the alpha the schema allows, so
          // it only ever sends the first six digits. Typing the full value in
          // the field beside it is how you get transparency.
          value={value.slice(0, 7)}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label} swatch`}
          className="ds-focus ds-inset size-9 shrink-0 cursor-pointer rounded-sm bg-sunken p-1"
        />
        <TextInput
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="tabular font-mono text-xs"
          spellCheck={false}
          aria-label={label}
        />
      </div>
    </Field>
  );
}
