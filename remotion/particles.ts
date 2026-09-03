import type { Box, ParticleStyle } from "@/types/prism";

/**
 * Particles, as a pure function of the frame.
 *
 * Nothing here has state: every piece's angle, speed, spin and colour come
 * from a seeded generator, and its place at a frame is arithmetic on them.
 * That is what lets the WebCodecs export draw the same confetti the
 * preview showed, frame for frame, and lets a test ask where piece nine is
 * at frame twenty without a browser.
 *
 * Positions are canvas fractions: `x` of the width, `y` of the height.
 * Distances are in fractions of the height, with `aspect` (width / height)
 * turning them into fractions of the width, so a burst is round.
 */

export type ParticleSpec = {
  style: ParticleStyle;
  count: number;
  colors: readonly string[];
  spread: number;
  gravity: number;
  size: number;
  seed: number;
  box: Pick<Box, "x" | "y" | "width" | "height">;
};

export type Particle = {
  x: number;
  y: number;
  /** As a fraction of the canvas height. */
  size: number;
  /** Width over height of the piece: 1 is square, 0.5 a strip. */
  aspect: number;
  rotate: number;
  opacity: number;
  color: string;
  round: boolean;
};

/** mulberry32: small, fast, and the same on every machine. */
function generator(seed: number): () => number {
  let a = (seed * 1_000_003 + 12345) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Every piece at one frame. `t` is the clip's own progress, 0 to 1, so a
 * burst that lasts forty frames and one that lasts eighty play the same
 * shape at different speeds — which is what a person asking for "a longer
 * burst" means.
 */
export function particlesAt(
  spec: ParticleSpec,
  frame: number,
  durationInFrames: number,
  aspect: number,
): Particle[] {
  const random = generator(spec.seed);
  const t = clamp01(frame / Math.max(1, durationInFrames));
  const { box } = spec;
  const cx = box.x;
  const cy = box.y;
  const out: Particle[] = [];

  for (let index = 0; index < spec.count; index += 1) {
    const r1 = random();
    const r2 = random();
    const r3 = random();
    const r4 = random();
    const r5 = random();
    const r6 = random();
    const color = spec.colors[Math.floor(r1 * spec.colors.length) % spec.colors.length]!;
    const sizeFactor = 0.6 + r2 * 0.8;
    const size = spec.size * sizeFactor;

    switch (spec.style) {
      case "confetti":
      case "burst": {
        // Confetti leaves upward in a cone and falls; a burst goes everywhere.
        const angle =
          spec.style === "confetti"
            ? -Math.PI / 2 + (r3 - 0.5) * (Math.PI * 0.65)
            : r3 * TAU;
        const speed = 0.45 + r4 * 0.55;
        const delay = r5 * 0.12;
        const tt = clamp01((t - delay) / (1 - delay));
        const distance = speed * spec.spread * 0.55 * easeOut(tt);
        const fall = spec.gravity * 0.6 * tt * tt;
        const x = cx + (Math.cos(angle) * distance) / aspect;
        const y = cy + Math.sin(angle) * distance + fall;
        // Gone by ninety percent of the clip, so the last frames are clean.
        const fade = tt < 0.6 ? 1 : 1 - (tt - 0.6) / 0.3;
        out.push({
          x,
          y,
          size,
          aspect: 0.45 + r6 * 0.55,
          rotate: (r6 - 0.5) * 2 * 540 * tt + r3 * 360,
          opacity: t < delay ? 0 : clamp01(fade),
          color,
          round: r5 > 0.72,
        });
        break;
      }
      case "sparkles": {
        // Points inside the box, each on its own twinkle.
        const x = cx - box.width / 2 + r3 * box.width;
        const y = cy - box.height / 2 + r4 * box.height;
        const phase = r5 * TAU;
        const rate = 1.5 + r6 * 2.5;
        const twinkle = 0.5 + 0.5 * Math.sin(phase + t * TAU * rate);
        out.push({
          x,
          y,
          size: size * (0.5 + twinkle * 0.7),
          aspect: 1,
          rotate: 45,
          opacity: 0.2 + 0.8 * twinkle,
          color,
          round: false,
        });
        break;
      }
      case "rise": {
        // Up through the box, swaying, fading in at the bottom and out at the top.
        const x0 = cx - box.width / 2 + r3 * box.width;
        const lane = (t * (0.6 + r4 * 0.8) + r5) % 1;
        const y = cy + box.height / 2 - lane * box.height;
        const sway = (Math.sin(lane * TAU * 1.5 + r6 * TAU) * 0.012) / aspect;
        const fade = Math.sin(lane * Math.PI);
        out.push({
          x: x0 + sway,
          y,
          size: size * 0.8,
          aspect: 1,
          rotate: 0,
          opacity: clamp01(fade) * (0.5 + r2 * 0.5),
          color,
          round: true,
        });
        break;
      }
    }
  }

  return out;
}
