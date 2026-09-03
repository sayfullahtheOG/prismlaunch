import type { BoardLayer, BoardPose, StoryboardPanel, StoryboardVisual } from "@/types/prism";

const POSE_KEYS = ["x", "y", "width", "height", "rotation", "opacity"] as const;

/** Resolve partial target poses cumulatively; hold means cut at the target frame. */
export function boardPoseAt(layer: BoardLayer, frame: number): BoardPose {
  let pose: BoardPose = { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation, opacity: layer.opacity };
  if (frame < layer.from || (layer.until !== undefined && frame >= layer.until)) return { ...pose, opacity: 0 };
  let start = layer.from;
  for (const keyframe of layer.keyframes) {
    const target = { ...pose };
    for (const key of POSE_KEYS) if (keyframe[key] !== undefined) target[key] = keyframe[key];
    if (frame < keyframe.at) {
      const p = Math.max(0, Math.min(1, (frame - start) / (keyframe.at - start)));
      const t = keyframe.easing === "hold" ? 0 : keyframe.easing === "smooth" ? p * p * (3 - 2 * p) : p;
      for (const key of POSE_KEYS) pose[key] += (target[key] - pose[key]) * t;
      return pose;
    }
    pose = target;
    start = keyframe.at;
  }
  return pose;
}

export function boardStarts(panels: readonly StoryboardPanel[]): number[] {
  let cursor = 0;
  return panels.map((panel) => { const from = cursor; cursor += panel.durationInFrames; return from; });
}

export function boardAtFrame(panels: readonly StoryboardPanel[], frame: number) {
  let from = 0;
  for (let index = 0; index < panels.length; index++) {
    const panel = panels[index]!;
    if (frame < from + panel.durationInFrames || index === panels.length - 1) {
      return { panel, index, from, localFrame: Math.max(0, Math.min(panel.durationInFrames - 1, frame - from)) };
    }
    from += panel.durationInFrames;
  }
  return null;
}

/** A useful contact sheet moment, plus all authored action boundaries for scrubbing. */
export function boardMoments(panel: StoryboardPanel): number[] {
  const moments = new Set([0, panel.durationInFrames - 1]);
  for (const layer of panel.visual?.layers ?? []) {
    moments.add(layer.from);
    for (const keyframe of layer.keyframes) moments.add(keyframe.at);
    if (layer.until !== undefined && layer.until < panel.durationInFrames) moments.add(layer.until);
  }
  return [...moments].filter((f) => f < panel.durationInFrames).sort((a, b) => a - b);
}

export function boardAssetPaths(visual?: StoryboardVisual): string[] {
  return visual ? visual.layers.flatMap((layer) => layer.src ? [layer.src] : []) : [];
}
