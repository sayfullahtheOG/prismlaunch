import { interpolate, spring } from "remotion";
import type { MotionPreset } from "@/types/prism";

/**
 * The three motion presets, as actual differences in how things enter.
 *
 * Everything is driven from `frame` — no CSS animations, no timers, no
 * randomness — because Remotion renders by seeking to arbitrary frames rather
 * than playing forward. An animation that depends on wall-clock time produces
 * a preview and an export that disagree
 * (context/code-standards.md §Remotion conventions).
 */

export type EnterStyle = {
  opacity: number;
  transform: string;
};

type EnterArgs = {
  frame: number;
  fps: number;
  preset: MotionPreset;
  /** Frames to wait before this element starts moving. */
  delay?: number;
};

export function enter({
  frame,
  fps,
  preset,
  delay = 0,
}: EnterArgs): EnterStyle {
  const local = frame - delay;

  if (preset === "snap") {
    // Decisive: a stiff spring, almost no travel, quick opacity.
    const progress = spring({
      frame: local,
      fps,
      config: { damping: 26, stiffness: 220, mass: 0.6 },
      durationInFrames: 18,
    });
    return {
      opacity: interpolate(local, [0, 5], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      transform: `translateY(${interpolate(progress, [0, 1], [14, 0])}px)`,
    };
  }

  if (preset === "orbit") {
    // Playful: arrives on a slight arc with a touch of rotation and scale.
    const progress = spring({
      frame: local,
      fps,
      config: { damping: 14, stiffness: 90, mass: 0.9 },
      durationInFrames: 34,
    });
    return {
      opacity: interpolate(local, [0, 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      transform: [
        `translateY(${interpolate(progress, [0, 1], [26, 0])}px)`,
        `rotate(${interpolate(progress, [0, 1], [-3.2, 0])}deg)`,
        `scale(${interpolate(progress, [0, 1], [0.94, 1])})`,
      ].join(" "),
    };
  }

  // drift — slow, floating, premium. Eased rather than sprung.
  const progress = interpolate(local, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  return {
    opacity: interpolate(local, [0, 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    transform: `translateY(${interpolate(progress, [0, 1], [22, 0])}px)`,
  };
}

/**
 * A slow push on the whole frame, so a static scene never feels frozen.
 * Deliberately subtle — this reads as production value, not as an effect.
 */
export function ambientScale(frame: number, durationInFrames: number): number {
  return interpolate(frame, [0, durationInFrames], [1, 1.035], {
    extrapolateRight: "clamp",
  });
}

/** Character-by-character reveal used by the spotlight's typed query. */
export function typedLength(
  frame: number,
  total: number,
  startFrame: number,
  framesPerChar: number,
): number {
  if (frame < startFrame) return 0;
  return Math.min(total, Math.floor((frame - startFrame) / framesPerChar));
}
