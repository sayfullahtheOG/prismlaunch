import { Easing, interpolate, spring } from "remotion";
import type { Animation, Box, Transition } from "@/types/prism";

/**
 * How a clip enters and leaves.
 *
 * Every transition is expressed as a CSS transform plus opacity, so the same
 * eight names work on text, a shape, an image or a video without each clip type
 * knowing anything about animation. The renderer asks for a style and applies
 * it; nothing branches on clip kind.
 *
 * Enter and exit are computed independently and multiplied together, which is
 * what makes a clip shorter than its own transitions degrade gracefully rather
 * than flicker: both curves are clamped to the clip, so a 6-frame clip with a
 * 12-frame fade simply fades faster.
 */

export type ClipStyle = {
  opacity: number;
  transform: string;
  filter?: string;
};

/**
 * Distance travelled by the sliding transitions, as a fraction of the canvas.
 *
 * Three percent, not eight. This started at 0.08 and the research changed it:
 * a small travel with a firm ease-out reads as an object settling into a place
 * that was designed for it, while a large one reads as an object arriving from
 * off-stage — attention bought with volume rather than precision. Practitioner
 * guidance puts text at 2–4% of canvas height and calls anything over 8%
 * cheap, which is exactly where the old value sat.
 */
const TRAVEL = 0.03;

type Phase = {
  /** 0 at the start of the transition, 1 when it is complete. */
  progress: number;
  /** `enter` runs forwards, `exit` runs backwards. */
  direction: 1 | -1;
};

function styleFor(transition: Transition, phase: Phase): ClipStyle {
  const { progress, direction } = phase;
  // How far from "settled" we are: 0 when the clip is fully on screen.
  const away = 1 - progress;
  const sign = direction;

  switch (transition) {
    case "none":
      return { opacity: 1, transform: "" };
    case "fade":
      return { opacity: progress, transform: "" };
    case "rise":
      return {
        opacity: progress,
        transform: `translateY(${away * TRAVEL * 100 * sign}%)`,
      };
    case "fall":
      return {
        opacity: progress,
        transform: `translateY(${-away * TRAVEL * 100 * sign}%)`,
      };
    case "slide-left":
      return {
        opacity: progress,
        transform: `translateX(${away * TRAVEL * 100 * sign}%)`,
      };
    case "slide-right":
      return {
        opacity: progress,
        transform: `translateX(${-away * TRAVEL * 100 * sign}%)`,
      };
    case "scale":
      // From 0.94, never from zero. An element that scales from nothing looks
      // like it came from nowhere; from ~0.9 it looks like it came into focus.
      return {
        opacity: progress,
        transform: `scale(${1 - away * 0.06})`,
      };
    case "blur":
      return {
        opacity: progress,
        transform: "",
        filter: `blur(${away * 14}px)`,
      };
  }
}

/**
 * The style for one clip at one frame.
 *
 * `frame` is relative to the clip, not the composition — Remotion's
 * `<Sequence>` already rebases it, and doing the subtraction here as well is
 * the classic way to get an animation that plays at the wrong time.
 */
export function clipStyle(
  animation: Animation,
  box: Box,
  frame: number,
  durationInFrames: number,
  fps: number,
): ClipStyle {
  // Never let a transition run longer than the clip it belongs to, and never
  // let enter and exit overlap — each gets at most half.
  const half = durationInFrames / 2;
  const enterFrames = Math.min(animation.enterFrames, half);
  const exitFrames = Math.min(animation.exitFrames, half);

  const enterProgress =
    animation.enter === "none" || enterFrames <= 0
      ? 1
      : spring({
          frame,
          fps,
          durationInFrames: enterFrames,
          config: { damping: 200 },
        });

  /*
   * Enter decelerates (the spring above), exit accelerates. The asymmetry is
   * the point: something arriving should slow into place so the eye can land
   * on it; something leaving should get out of the way. A linear or eased-out
   * exit lingers, and every beat reads as being reluctantly withdrawn.
   */
  const exitStart = durationInFrames - exitFrames;
  const exitProgress =
    animation.exit === "none" || exitFrames <= 0
      ? 1
      : interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        });

  const entering = styleFor(animation.enter, {
    progress: enterProgress,
    direction: 1,
  });
  const leaving = styleFor(animation.exit, {
    progress: exitProgress,
    direction: -1,
  });

  const transforms = [
    entering.transform,
    leaving.transform,
    box.rotation !== 0 ? `rotate(${box.rotation}deg)` : "",
  ].filter(Boolean);

  const filters = [entering.filter, leaving.filter].filter(Boolean);

  return {
    opacity: entering.opacity * leaving.opacity * box.opacity,
    transform: transforms.join(" "),
    ...(filters.length > 0 ? { filter: filters.join(" ") } : {}),
  };
}

/**
 * A clip's box as absolute CSS.
 *
 * The box is normalised and centre-anchored, so this is where that becomes
 * pixels: percentages plus a -50% translate. Kept separate from `clipStyle`
 * because layout does not change per frame and animation does.
 */
export function boxStyle(box: Box): React.CSSProperties {
  return {
    position: "absolute",
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
    marginLeft: `${-box.width * 50}%`,
    marginTop: `${-box.height * 50}%`,
  };
}

/** Linear ramp used by the audio fades, in gain rather than pixels. */
export function fadeGain(
  frame: number,
  durationInFrames: number,
  fadeInFrames: number,
  fadeOutFrames: number,
): number {
  const rampIn =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const rampOut =
    fadeOutFrames > 0
      ? interpolate(
          frame,
          [durationInFrames - fadeOutFrames, durationInFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  return rampIn * rampOut;
}
