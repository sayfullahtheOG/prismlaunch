"use client";

import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { TransitionSchema } from "@/lib/studio/schema";
import type {
  Animation,
  Box,
  Fit,
  FontFamily,
  TextAlign,
} from "@/types/prism";
import { ColorField, NumberField, Row } from "./fields";

/**
 * The field groups a clip and an element share.
 *
 * An element is a clip without a place, so its properties are the clip's
 * properties. Writing the type-style fields twice — once for the headline
 * on the timeline, once for the Headline element — would guarantee they
 * drift. Each group takes the slice of the object it edits and a setter for
 * a partial of that slice; the two inspectors decide where the patch goes.
 */

type Setter<T> = (patch: Partial<T>) => void;

export type TextStyle = {
  text?: string | undefined;
  fontSize: number;
  fontFamily: FontFamily;
  fontWeight: number;
  color: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
};

export function TextFields({
  value,
  set,
  words,
}: {
  value: TextStyle;
  set: Setter<TextStyle>;
  /** A clip needs words; a type style may leave them for placement. */
  words: "required" | "optional";
}) {
  return (
    <>
      <Field label={words === "optional" ? "Default words" : "Text"} htmlFor="text-words">
        <TextArea
          id="text-words"
          value={value.text ?? ""}
          onChange={(event) => set({ text: event.target.value })}
          rows={3}
          placeholder={words === "optional" ? "None — the words come when it is placed" : undefined}
        />
      </Field>
      <Row>
        <NumberField
          label="Size"
          value={value.fontSize}
          step={0.005}
          onChange={(fontSize) => set({ fontSize })}
        />
        <NumberField
          label="Weight"
          value={value.fontWeight}
          step={100}
          min={100}
          max={900}
          onChange={(fontWeight) => set({ fontWeight })}
        />
      </Row>
      <Field label="Font">
        <Segmented
          label="Font family"
          options={["display", "body", "mono"] as const}
          value={value.fontFamily}
          onChange={(fontFamily) => set({ fontFamily })}
        />
      </Field>
      <Field label="Align">
        <Segmented
          label="Text align"
          options={["left", "center", "right"] as const}
          value={value.align}
          onChange={(align) => set({ align })}
        />
      </Field>
      <ColorField label="Colour" value={value.color} onChange={(color) => set({ color })} />
      <Row>
        <NumberField
          label="Line height"
          value={value.lineHeight}
          step={0.05}
          onChange={(lineHeight) => set({ lineHeight })}
        />
        <NumberField
          label="Tracking"
          value={value.letterSpacing}
          step={0.01}
          onChange={(letterSpacing) => set({ letterSpacing })}
        />
      </Row>
    </>
  );
}

export type ShapeStyle = { shape: "rect" | "ellipse"; fill: string; radius: number };

export function ShapeFields({ value, set }: { value: ShapeStyle; set: Setter<ShapeStyle> }) {
  return (
    <>
      <Field label="Shape">
        <Segmented
          label="Shape"
          options={["rect", "ellipse"] as const}
          value={value.shape}
          onChange={(shape) => set({ shape })}
        />
      </Field>
      <ColorField label="Fill" value={value.fill} onChange={(fill) => set({ fill })} />
      <NumberField
        label="Corner radius"
        value={value.radius}
        step={0.05}
        min={0}
        max={0.5}
        onChange={(radius) => set({ radius })}
      />
    </>
  );
}

export type PictureSource = { src: string; fit: Fit; radius: number };

export function PictureFields({ value, set }: { value: PictureSource; set: Setter<PictureSource> }) {
  return (
    <>
      <Field label="Source">
        <TextInput
          value={value.src}
          onChange={(event) => set({ src: event.target.value })}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      <Row>
        <Field label="Fit">
          <Segmented
            label="Fit"
            options={["cover", "contain", "fill"] as const}
            value={value.fit}
            onChange={(fit) => set({ fit })}
          />
        </Field>
        <NumberField
          label="Corner radius"
          value={value.radius}
          step={0.05}
          min={0}
          max={0.5}
          onChange={(radius) => set({ radius })}
        />
      </Row>
    </>
  );
}

export type VideoSound = { volume: number; startFrom: number; playbackRate: number };

export function VideoFields({ value, set }: { value: VideoSound; set: Setter<VideoSound> }) {
  return (
    <Row>
      <NumberField
        label="Volume"
        value={value.volume}
        step={0.05}
        min={0}
        max={1}
        onChange={(volume) => set({ volume })}
      />
      <NumberField
        label="Start from"
        value={value.startFrom}
        step={1}
        min={0}
        onChange={(startFrom) => set({ startFrom })}
      />
    </Row>
  );
}

export type AudioSource = {
  src: string;
  volume: number;
  playbackRate: number;
  fadeInFrames: number;
  fadeOutFrames: number;
};

export function AudioFields({ value, set }: { value: AudioSource; set: Setter<AudioSource> }) {
  return (
    <>
      <Field label="Source">
        <TextInput
          value={value.src}
          onChange={(event) => set({ src: event.target.value })}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      <Row>
        <NumberField
          label="Volume"
          value={value.volume}
          step={0.05}
          min={0}
          max={1}
          onChange={(volume) => set({ volume })}
        />
        <NumberField
          label="Rate"
          value={value.playbackRate}
          step={0.05}
          onChange={(playbackRate) => set({ playbackRate })}
        />
      </Row>
      <Row>
        <NumberField
          label="Fade in"
          value={value.fadeInFrames}
          step={1}
          min={0}
          onChange={(fadeInFrames) => set({ fadeInFrames })}
        />
        <NumberField
          label="Fade out"
          value={value.fadeOutFrames}
          step={1}
          min={0}
          onChange={(fadeOutFrames) => set({ fadeOutFrames })}
        />
      </Row>
    </>
  );
}

export function BoxFields({ box, set }: { box: Box; set: (box: Box) => void }) {
  return (
    <>
      <Row>
        <NumberField label="X" value={box.x} step={0.01} onChange={(x) => set({ ...box, x })} />
        <NumberField label="Y" value={box.y} step={0.01} onChange={(y) => set({ ...box, y })} />
      </Row>
      <Row>
        <NumberField
          label="Width"
          value={box.width}
          step={0.01}
          onChange={(width) => set({ ...box, width })}
        />
        <NumberField
          label="Height"
          value={box.height}
          step={0.01}
          onChange={(height) => set({ ...box, height })}
        />
      </Row>
      <Row>
        <NumberField
          label="Rotation"
          value={box.rotation}
          step={1}
          onChange={(rotation) => set({ ...box, rotation })}
        />
        <NumberField
          label="Opacity"
          value={box.opacity}
          step={0.05}
          min={0}
          max={1}
          onChange={(opacity) => set({ ...box, opacity })}
        />
      </Row>
    </>
  );
}

const TRANSITIONS = TransitionSchema.options.map((name) => ({ value: name, label: name }));

export function AnimationFields({
  animation,
  set,
}: {
  animation: Animation;
  set: (animation: Animation) => void;
}) {
  return (
    <>
      <Row>
        <Field label="Enter">
          <Select
            label="Enter transition"
            options={TRANSITIONS}
            value={animation.enter}
            onChange={(enter) => set({ ...animation, enter: TransitionSchema.parse(enter) })}
          />
        </Field>
        <Field label="Exit">
          <Select
            label="Exit transition"
            options={TRANSITIONS}
            value={animation.exit}
            onChange={(exit) => set({ ...animation, exit: TransitionSchema.parse(exit) })}
          />
        </Field>
      </Row>
      <Row>
        <NumberField
          label="Enter frames"
          value={animation.enterFrames}
          step={1}
          min={0}
          max={120}
          onChange={(enterFrames) => set({ ...animation, enterFrames })}
        />
        <NumberField
          label="Exit frames"
          value={animation.exitFrames}
          step={1}
          min={0}
          max={120}
          onChange={(exitFrames) => set({ ...animation, exitFrames })}
        />
      </Row>
    </>
  );
}
