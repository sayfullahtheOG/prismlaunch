import { Easing, interpolate, spring } from "remotion";
import type { Animation, Box, CameraMove, Motion, Transition } from "@/types/prism";

/**
 * How a clip enters and leaves.
 *
 * Every transition is expressed as a CSS transform plus opacity (and, for
 * two of them, a filter or a clip path), so the same twelve names work on
 * text, a shape, an image, a video, an icon, a device or a burst of
 * particles without each clip type knowing anything about animation. The
 * renderer asks for a style and applies it; nothing branches on clip kind.
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
  clipPath?: string;
};

type Phase = {
  /** 0 at the start of the transition, 1 when it is complete. Past 1 on an overshoot. */
  progress: number;
  /** `enter` runs forwards, `exit` runs backwards. */
  direction: 1 | -1;
};

/**
 * How far the sliding transitions travel, as a percentage of the box's own
 * size. `travel` on the animation is a fraction of the canvas — the number
 * the method talks about — and a percentage transform is relative to the
 * element, so the conversion goes through the box.
 */
type Travel = { x: number; y: number };

function styleFor(transition: Transition, phase: Phase, travel: Travel): ClipStyle {
  const { progress, direction } = phase;
  // How far from "settled" we are: 0 when the clip is fully on screen, and
  // a little below 0 while a spring is overshooting.
  const away = 1 - progress;
  const sign = direction;
  const alpha = Math.min(1, Math.max(0, progress));

  switch (transition) {
    case "none":
      return { opacity: 1, transform: "" };
    case "fade":
      return { opacity: alpha, transform: "" };
    case "rise":
      return {
        opacity: alpha,
        transform: `translateY(${away * travel.y * sign}%)`,
      };
    case "fall":
      return {
        opacity: alpha,
        transform: `translateY(${-away * travel.y * sign}%)`,
      };
    case "slide-left":
      return {
        opacity: alpha,
        transform: `translateX(${away * travel.x * sign}%)`,
      };
    case "slide-right":
      return {
        opacity: alpha,
        transform: `translateX(${-away * travel.x * sign}%)`,
      };
    case "scale":
      // From 0.94, never from zero. An element that scales from nothing looks
      // like it came from nowhere; from ~0.9 it looks like it came into focus.
      return {
        opacity: alpha,
        transform: `scale(${1 - away * 0.06})`,
      };
    case "blur":
      return {
        opacity: alpha,
        transform: "",
        filter: `blur(${Math.max(0, away) * 14}px)`,
      };
    case "pop":
      // The kinetic word: out of focus and a touch too large, settling into
      // sharpness. Leaving, it shrinks and blurs out — the two are mirrors.
      return {
        opacity: alpha,
        transform: `scale(${1 + away * 0.15 * sign})`,
        filter: `blur(${Math.max(0, away) * 10}px)`,
      };
    case "zoom":
      // Through the camera: arrives from far away, leaves past the lens.
      return {
        opacity: alpha,
        transform: `scale(${1 - away * 0.4 * sign})`,
        filter: `blur(${Math.max(0, away) * 8}px)`,
      };
    case "flip":
      // A card turning up. The renderer puts a perspective in front of this.
      return {
        opacity: alpha,
        transform: `rotateX(${-away * 70 * sign}deg)`,
      };
    case "wipe": {
      // A true mask: the thing is already whole underneath, and the edge
      // uncovers it left to right. Leaving, the left edge covers it again.
      const hidden = Math.max(0, Math.min(100, away * 100));
      // Whole once it has landed: no mask at all, so the other phase's can win.
      if (hidden === 0) return { opacity: 1, transform: "" };
      return {
        opacity: 1,
        transform: "",
        clipPath: sign === 1 ? `inset(0 ${hidden}% 0 0)` : `inset(0 0 0 ${hidden}%)`,
      };
    }
  }
}

/**
 * The spring's damping for an overshoot amount.
 *
 * 0 is critically damped — Remotion's `damping: 200`, which slows into place
 * with no bounce. Anything above 0 drops below the 20 or so where a spring
 * with stiffness 100 starts to overshoot; 1 is a visible bounce.
 */
function dampingFor(overshoot: number): number {
  return overshoot <= 0 ? 200 : 22 - 14 * overshoot;
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
          config: { damping: dampingFor(animation.spring), stiffness: 100, mass: 1 },
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

  const travel: Travel = {
    x: (animation.travel / Math.max(0.001, box.width)) * 100,
    y: (animation.travel / Math.max(0.001, box.height)) * 100,
  };

  // A phase outside its own window contributes nothing — not even an
  // identity transform — so the other phase's style is the whole story.
  // Judged by the frame rather than the progress, because a spring is
  // past 1 while it overshoots and that is not "finished".
  const enterActive = animation.enter !== "none" && enterFrames > 0 && frame < enterFrames;
  const exitActive = animation.exit !== "none" && exitFrames > 0 && frame > exitStart;
  const entering = enterActive
    ? styleFor(animation.enter, { progress: enterProgress, direction: 1 }, travel)
    : styleFor("none", { progress: 1, direction: 1 }, travel);
  const leaving = exitActive
    ? styleFor(animation.exit, { progress: exitProgress, direction: -1 }, travel)
    : styleFor("none", { progress: 1, direction: -1 }, travel);

  const transforms = [
    entering.transform,
    leaving.transform,
    box.rotation !== 0 ? `rotate(${box.rotation}deg)` : "",
  ].filter(Boolean);

  const filters = [entering.filter, leaving.filter].filter(Boolean);
  const clipPaths = [entering.clipPath, leaving.clipPath].filter(Boolean);

  return {
    opacity: entering.opacity * leaving.opacity * box.opacity,
    transform: transforms.join(" "),
    ...(filters.length > 0 ? { filter: filters.join(" ") } : {}),
    // Two wipes at once would need an intersection; the exit's wins, since
    // by then the enter has finished uncovering.
    ...(clipPaths.length > 0 ? { clipPath: clipPaths[clipPaths.length - 1] } : {}),
  };
}

/**
 * A clip's box as absolute CSS.
 *
 * The box is normalised and centre-anchored, so this is where that becomes
 * pixels: the top-left corner is the centre less half the size, in
 * percentages of the canvas. Kept separate from `clipStyle` because layout
 * does not change per frame and animation does.
 *
 * Not a negative percentage margin: CSS resolves a vertical margin against
 * the container's WIDTH, so `marginTop: -height/2` on a 16:9 canvas lifted
 * every clip by a quarter of its own height — a 0.7-tall device by a
 * quarter of the frame. `top` resolves against the height, which is what
 * a fraction of the height means.
 */
export function boxStyle(box: Box): React.CSSProperties {
  return {
    position: "absolute",
    left: `${(box.x - box.width / 2) * 100}%`,
    top: `${(box.y - box.height / 2) * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
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

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export type MotionState = {
  /** How far the box has travelled, in canvas fractions. */
  dx: number;
  dy: number;
  scale: number;
  /** Degrees turned so far. */
  rotate: number;
  /** A multiplier on the clip's opacity. */
  opacity: number;
  /** Defocus so far, 0–1. */
  blur: number;
};

const STILL: MotionState = { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, blur: 0 };

/** How long the press dip lasts. Eight frames: a click, not a bounce. */
export const PRESS_FRAMES = 8;

function ease(easing: Motion["easing"], progress: number): number {
  switch (easing) {
    case "linear":
      return progress;
    case "in-out":
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case "out":
      return 1 - Math.pow(1 - progress, 3);
  }
}

/**
 * A damped overshoot: past the target and back, settling by the end.
 *
 * Closed-form rather than a simulated spring, so it is a pure function of
 * progress and a test can ask where the middle of the move is. `amount`
 * 0.3 lands about six percent past; 1 lands fourteen percent past and
 * comes back once more.
 */
export function overshoot(progress: number, amount: number): number {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return 1;
  const decay = Math.exp(-6 * p);
  return 1 - decay * Math.cos(Math.PI * (1 + 2 * amount) * p);
}

/**
 * Where a clip's move has got to at one frame.
 *
 * Runs from `delay` for `frames` (or to the end of the clip), eased, and
 * holds at the end: a cursor that reached the button stays on the button.
 * `press` then dips the scale once, the way a click does. `arc` bows the
 * path sideways; `spring` lets it land past the mark and settle. Frame is
 * relative to the clip, like `clipStyle`.
 */
export function motionState(
  motion: Motion,
  frame: number,
  durationInFrames: number,
): MotionState {
  const still =
    motion.x === 0 &&
    motion.y === 0 &&
    motion.scale === 1 &&
    !motion.press &&
    motion.rotate === 0 &&
    motion.opacity === 1 &&
    motion.blur === 0;
  if (still) return STILL;

  const span =
    motion.frames > 0 ? motion.frames : Math.max(1, durationInFrames - motion.delay);
  const raw = Math.min(1, Math.max(0, (frame - motion.delay) / span));
  const progress = motion.spring > 0 ? overshoot(raw, motion.spring) : ease(motion.easing, raw);

  let dx = motion.x * progress;
  let dy = motion.y * progress;
  if (motion.arc !== 0 && (motion.x !== 0 || motion.y !== 0)) {
    // Bow the path: a bulge perpendicular to the straight line, largest at
    // the middle and gone at both ends, so the start and the landing hold.
    const distance = Math.hypot(motion.x, motion.y);
    const bulge = motion.arc * distance * 0.5 * Math.sin(Math.PI * raw);
    dx += (-motion.y / distance) * bulge;
    dy += (motion.x / distance) * bulge;
  }

  let scale = 1 + (motion.scale - 1) * progress;
  if (motion.press) {
    const since = frame - (motion.delay + span);
    if (since >= 0 && since < PRESS_FRAMES) {
      scale *= 1 - 0.18 * Math.sin((since / PRESS_FRAMES) * Math.PI);
    }
  }

  return {
    dx,
    dy,
    scale,
    rotate: motion.rotate * progress,
    opacity: 1 + (motion.opacity - 1) * raw,
    blur: motion.blur * raw,
  };
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export type CameraState = { x: number; y: number; scale: number };

export const CAMERA_HOME: CameraState = { x: 0.5, y: 0.5, scale: 1 };

/**
 * Where the camera is at one frame.
 *
 * Each move interpolates from wherever the camera was to its own target,
 * over its own frames, and the camera holds there until the next one. A
 * frame before the first move sees the whole canvas at 1. Frames here are
 * composition frames, because the camera is the film's, not a clip's.
 */
export function cameraState(moves: readonly CameraMove[], frame: number): CameraState {
  let state = CAMERA_HOME;
  const sorted = [...moves].sort((a, b) => a.from - b.from);
  for (const move of sorted) {
    if (frame < move.from) break;
    const raw = Math.min(1, (frame - move.from) / Math.max(1, move.frames));
    const p = ease(move.easing, raw);
    state = {
      x: state.x + (move.x - state.x) * p,
      y: state.y + (move.y - state.y) * p,
      scale: state.scale + (move.scale - state.scale) * p,
    };
  }
  return state;
}

/** The transform that puts the camera's point of interest at the centre, then zooms about it. */
export function cameraTransform(state: CameraState, width: number, height: number): string {
  if (state.x === 0.5 && state.y === 0.5 && state.scale === 1) return "";
  return `scale(${state.scale}) translate(${(0.5 - state.x) * width}px, ${(0.5 - state.y) * height}px)`;
}
