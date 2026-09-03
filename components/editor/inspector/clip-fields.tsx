"use client";

import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import {
  DeviceKindSchema,
  IconNameSchema,
  MotionEasingSchema,
  ParticleStyleSchema,
  RevealSchema,
  RevealStyleSchema,
  TransitionSchema,
} from "@/lib/studio/schema";
import type {
  Animation,
  Box,
  DeviceKind,
  Fit,
  FontFamily,
  IconName,
  Motion,
  ParticleStyle,
  Reveal,
  RevealStyle,
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
  accent?: string | undefined;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  fill?: string | undefined;
  radius: number;
};

/** A colour that may be unset: typed as hex, cleared by emptying the field. */
function OptionalColor({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value.trim().toUpperCase();
          onChange(next === "" ? undefined : next);
        }}
        className="tabular font-mono text-xs"
        spellCheck={false}
        aria-label={label}
      />
    </Field>
  );
}

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
          placeholder={words === "optional" ? "None. The words come when it is placed." : undefined}
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
        <OptionalColor
          label="Accent (*words*)"
          value={value.accent}
          placeholder="none"
          onChange={(accent) => set({ accent })}
        />
        <OptionalColor
          label="Fill behind"
          value={value.fill}
          placeholder="none"
          onChange={(fill) => set({ fill })}
        />
      </Row>
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
      {value.fill ? (
        <NumberField
          label="Fill radius"
          value={value.radius}
          step={0.05}
          min={0}
          max={0.5}
          onChange={(radius) => set({ radius })}
        />
      ) : null}
    </>
  );
}

export type ShapeStyle = {
  shape: "rect" | "ellipse";
  fill: string;
  fillTo?: string | undefined;
  fillAngle: number;
  radius: number;
};

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
      <Row>
        <OptionalColor
          label="Gradient to"
          value={value.fillTo}
          placeholder="none"
          onChange={(fillTo) => set({ fillTo })}
        />
        <NumberField
          label="Angle"
          value={value.fillAngle}
          step={15}
          min={0}
          max={360}
          onChange={(fillAngle) => set({ fillAngle })}
        />
      </Row>
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

export type IconStyle = { icon: IconName; color: string; stroke: number; draw: boolean };

const ICON_OPTIONS = IconNameSchema.options.map((name) => ({ value: name, label: name }));

export function IconFields({ value, set }: { value: IconStyle; set: Setter<IconStyle> }) {
  return (
    <>
      <Field label="Icon">
        <Select
          label="Icon"
          options={ICON_OPTIONS}
          value={value.icon}
          onChange={(icon) => set({ icon: IconNameSchema.parse(icon) })}
        />
      </Field>
      <ColorField label="Colour" value={value.color} onChange={(color) => set({ color })} />
      <Row>
        <NumberField
          label="Stroke"
          value={value.stroke}
          step={0.25}
          min={0.5}
          max={4}
          onChange={(stroke) => set({ stroke })}
        />
        <Field label="Draw on">
          <Segmented
            label="Draw on"
            options={ON_OFF}
            value={value.draw ? "on" : "off"}
            onChange={(next) => set({ draw: next === "on" })}
          />
        </Field>
      </Row>
    </>
  );
}

export type ParticlesStyle = {
  style: ParticleStyle;
  count: number;
  colors: string[];
  spread: number;
  gravity: number;
  size: number;
  seed: number;
};

const PARTICLE_OPTIONS = ParticleStyleSchema.options.map((name) => ({ value: name, label: name }));

export function ParticlesFields({ value, set }: { value: ParticlesStyle; set: Setter<ParticlesStyle> }) {
  return (
    <>
      <Row>
        <Field label="Style">
          <Select
            label="Particle style"
            options={PARTICLE_OPTIONS}
            value={value.style}
            onChange={(style) => set({ style: ParticleStyleSchema.parse(style) })}
          />
        </Field>
        <NumberField label="Count" value={value.count} step={10} min={1} max={400} onChange={(count) => set({ count })} />
      </Row>
      <Field label="Colours (comma-separated hex)">
        <TextInput
          value={value.colors.join(", ")}
          onChange={(event) => {
            const colors = event.target.value
              .split(",")
              .map((part) => part.trim().toUpperCase())
              .filter((part) => /^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(part));
            if (colors.length > 0) set({ colors });
          }}
          className="tabular font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      <Row>
        <NumberField label="Spread" value={value.spread} step={0.05} min={0} max={1} onChange={(spread) => set({ spread })} />
        <NumberField label="Gravity" value={value.gravity} step={0.1} min={0} max={2} onChange={(gravity) => set({ gravity })} />
      </Row>
      <Row>
        <NumberField label="Size" value={value.size} step={0.002} min={0.003} max={0.1} onChange={(size) => set({ size })} />
        <NumberField label="Seed" value={value.seed} step={1} min={0} max={9999} onChange={(seed) => set({ seed })} />
      </Row>
    </>
  );
}

export type DeviceStyle = {
  device: DeviceKind;
  src?: string | undefined;
  fit: Fit;
  screen: string;
  frame: string;
  radius: number;
};

export function DeviceFields({ value, set }: { value: DeviceStyle; set: Setter<DeviceStyle> }) {
  return (
    <>
      <Field label="Device">
        <Segmented
          label="Device"
          options={DeviceKindSchema.options}
          value={value.device}
          onChange={(device) => set({ device })}
        />
      </Field>
      <Field label="Screenshot">
        <TextInput
          value={value.src ?? ""}
          placeholder="assets/app.png"
          onChange={(event) => {
            const next = event.target.value.trim();
            set({ src: next === "" ? undefined : next });
          }}
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
          step={0.02}
          min={0}
          max={0.5}
          onChange={(radius) => set({ radius })}
        />
      </Row>
      <Row>
        <ColorField label="Screen" value={value.screen} onChange={(screen) => set({ screen })} />
        <ColorField label="Frame" value={value.frame} onChange={(frame) => set({ frame })} />
      </Row>
    </>
  );
}

export type Depth = { shadow: number; glow: number; blur: number };

/** What every visual clip has besides its box: how it sits in the frame. */
export function DepthFields({ value, set }: { value: Depth; set: Setter<Depth> }) {
  return (
    <Row>
      <NumberField label="Shadow" value={value.shadow} step={0.05} min={0} max={1} onChange={(shadow) => set({ shadow })} />
      <NumberField label="Glow" value={value.glow} step={0.05} min={0} max={1} onChange={(glow) => set({ glow })} />
      <NumberField label="Blur" value={value.blur} step={0.05} min={0} max={1} onChange={(blur) => set({ blur })} />
    </Row>
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
      <Row>
        <NumberField
          label="Tilt X"
          value={box.tiltX}
          step={1}
          min={-85}
          max={85}
          onChange={(tiltX) => set({ ...box, tiltX })}
        />
        <NumberField
          label="Tilt Y"
          value={box.tiltY}
          step={1}
          min={-85}
          max={85}
          onChange={(tiltY) => set({ ...box, tiltY })}
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
      <Row>
        <NumberField
          label="Travel"
          value={animation.travel}
          step={0.01}
          min={0}
          max={1}
          onChange={(travel) => set({ ...animation, travel })}
        />
        <NumberField
          label="Spring"
          value={animation.spring}
          step={0.05}
          min={0}
          max={1}
          onChange={(spring) => set({ ...animation, spring })}
        />
      </Row>
    </>
  );
}

const ON_OFF = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const;

export type TextReveal = {
  reveal: Reveal;
  revealFrames: number;
  revealStagger: number;
  revealStyle: RevealStyle;
  caret: boolean;
};

const REVEALS = RevealSchema.options.map((name) => ({ value: name, label: name }));
const REVEAL_STYLES = RevealStyleSchema.options.map((name) => ({ value: name, label: name }));

/** How a text clip's words arrive: typed, word by word, or counted up. */
export function RevealFields({ value, set }: { value: TextReveal; set: Setter<TextReveal> }) {
  return (
    <>
      <Row>
        <Field label="Reveal">
          <Select
            label="Reveal"
            options={REVEALS}
            value={value.reveal}
            onChange={(reveal) => set({ reveal: RevealSchema.parse(reveal) })}
          />
        </Field>
        <NumberField
          label="Reveal frames"
          value={value.revealFrames}
          step={1}
          min={1}
          max={600}
          onChange={(revealFrames) => set({ revealFrames })}
        />
      </Row>
      {value.reveal === "words" ? (
        <Row>
          <NumberField
            label="Word stagger"
            value={value.revealStagger}
            step={1}
            min={0}
            max={120}
            onChange={(revealStagger) => set({ revealStagger })}
          />
          <Field label="Word style">
            <Select
              label="Word style"
              options={REVEAL_STYLES}
              value={value.revealStyle}
              onChange={(revealStyle) => set({ revealStyle: RevealStyleSchema.parse(revealStyle) })}
            />
          </Field>
        </Row>
      ) : null}
      <Field label="Caret">
        <Segmented
          label="Caret"
          options={ON_OFF}
          value={value.caret ? "on" : "off"}
          onChange={(next) => set({ caret: next === "on" })}
        />
      </Field>
    </>
  );
}

const EASINGS = MotionEasingSchema.options.map((name) => ({ value: name, label: name }));

/** One move over the clip's life: where to, how big, how long, and whether it presses on arrival. */
export function MotionFields({ motion, set }: { motion: Motion; set: (motion: Motion) => void }) {
  return (
    <>
      <Row>
        <NumberField
          label="Move X"
          value={motion.x}
          step={0.01}
          onChange={(x) => set({ ...motion, x })}
        />
        <NumberField
          label="Move Y"
          value={motion.y}
          step={0.01}
          onChange={(y) => set({ ...motion, y })}
        />
      </Row>
      <Row>
        <NumberField
          label="Scale to"
          value={motion.scale}
          step={0.05}
          min={0.1}
          max={6}
          onChange={(scale) => set({ ...motion, scale })}
        />
        <NumberField
          label="Move frames"
          value={motion.frames}
          step={1}
          min={0}
          onChange={(frames) => set({ ...motion, frames })}
        />
      </Row>
      <Row>
        <NumberField
          label="Move delay"
          value={motion.delay}
          step={1}
          min={0}
          onChange={(delay) => set({ ...motion, delay })}
        />
        <Field label="Easing">
          <Select
            label="Move easing"
            options={EASINGS}
            value={motion.easing}
            onChange={(easing) => set({ ...motion, easing: MotionEasingSchema.parse(easing) })}
          />
        </Field>
      </Row>
      <Row>
        <NumberField
          label="Rotate to"
          value={motion.rotate}
          step={15}
          min={-1080}
          max={1080}
          onChange={(rotate) => set({ ...motion, rotate })}
        />
        <NumberField
          label="Opacity to"
          value={motion.opacity}
          step={0.05}
          min={0}
          max={1}
          onChange={(opacity) => set({ ...motion, opacity })}
        />
      </Row>
      <Row>
        <NumberField
          label="Blur to"
          value={motion.blur}
          step={0.05}
          min={0}
          max={1}
          onChange={(blur) => set({ ...motion, blur })}
        />
        <NumberField
          label="Arc"
          value={motion.arc}
          step={0.1}
          min={-1}
          max={1}
          onChange={(arc) => set({ ...motion, arc })}
        />
      </Row>
      <Row>
        <NumberField
          label="Move spring"
          value={motion.spring}
          step={0.05}
          min={0}
          max={1}
          onChange={(spring) => set({ ...motion, spring })}
        />
        <Field label="Trail">
          <Segmented
            label="Trail"
            options={ON_OFF}
            value={motion.trail ? "on" : "off"}
            onChange={(next) => set({ ...motion, trail: next === "on" })}
          />
        </Field>
      </Row>
      <Field label="Press on arrival">
        <Segmented
          label="Press on arrival"
          options={ON_OFF}
          value={motion.press ? "on" : "off"}
          onChange={(next) => set({ ...motion, press: next === "on" })}
        />
      </Field>
    </>
  );
}
