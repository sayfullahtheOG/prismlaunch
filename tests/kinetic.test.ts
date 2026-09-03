import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { LIBRARY } from "@/lib/studio/library";
import {
  DEFAULT_ANIMATION,
  DEFAULT_BOX,
  DEFAULT_MOTION,
  ElementSchema,
  ICONS,
  ProjectFileSchema,
} from "@/lib/studio/schema";
import { readProject, resetStudio } from "@/lib/studio/store";
import {
  AddDeviceInput,
  AddIconInput,
  AddParticlesInput,
  AddTextInput,
  SetCameraInput,
  UpdateClipInput,
} from "@/lib/studio/tool-inputs";
import { buildTools } from "@/lib/webmcp/tools";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { ICON_PATHS } from "@/remotion/icons";
import {
  cameraState,
  cameraTransform,
  clipStyle,
  motionState,
  overshoot,
} from "@/remotion/motion";
import { particlesAt } from "@/remotion/particles";
import { accentRuns, markedWords, stripAccents, wordProgressAt } from "@/remotion/reveal";
import { projectFile } from "./fixture";

/**
 * The kinetic register: what a product film made this decade is made of.
 *
 * Every primitive here is a pure function of the frame — that is what lets
 * the export match the preview — so each can be asked what it looks like
 * at a frame without a browser. The reference these were built against is
 * a thirty-three-second SaaS launch film: words popping in out of focus,
 * phones flying in with overshoot, a bar filling under a counter, a check
 * drawing itself under confetti, a sparkle swooping with a trail, and a
 * camera pushing into the button as the cursor reaches it.
 */

const FPS = 30;

describe("the twelve transitions", () => {
  it("pops a word in out of focus and a touch large, and shrinks it out", () => {
    const animation = { ...DEFAULT_ANIMATION, enter: "pop" as const, exit: "pop" as const, enterFrames: 6, exitFrames: 5 };
    const first = clipStyle(animation, DEFAULT_BOX, 0, 60, FPS);
    expect(first.opacity).toBeLessThan(0.2);
    expect(first.filter).toMatch(/blur\(\d/);
    expect(Number(/scale\(([\d.]+)\)/.exec(first.transform)?.[1])).toBeGreaterThan(1.05);

    const settled = clipStyle(animation, DEFAULT_BOX, 30, 60, FPS);
    expect(settled.opacity).toBeCloseTo(1, 3);

    const leaving = clipStyle(animation, DEFAULT_BOX, 59, 60, FPS);
    expect(Number(/scale\(([\d.]+)\)/.exec(leaving.transform)?.[1])).toBeLessThan(0.95);
  });

  it("wipes with a true mask, left to right in and uncovering from the left out", () => {
    const animation = { ...DEFAULT_ANIMATION, enter: "wipe" as const, exit: "wipe" as const, enterFrames: 20, exitFrames: 10 };
    const early = clipStyle(animation, DEFAULT_BOX, 2, 60, FPS);
    expect(early.opacity).toBe(1);
    expect(early.clipPath).toMatch(/^inset\(0 \d+(\.\d+)?% 0 0\)$/);
    const late = clipStyle(animation, DEFAULT_BOX, 58, 60, FPS);
    expect(late.clipPath).toMatch(/^inset\(0 0 0 \d+(\.\d+)?%\)$/);
    expect(clipStyle(animation, DEFAULT_BOX, 30, 60, FPS).clipPath).toBeUndefined();
  });

  it("travels by a fraction of the canvas, so a tall box and a short one move the same distance", () => {
    const animation = { ...DEFAULT_ANIMATION, enter: "rise" as const, enterFrames: 12, travel: 0.2 };
    const tall = clipStyle(animation, { ...DEFAULT_BOX, height: 0.4 }, 0, 60, FPS);
    const short = clipStyle(animation, { ...DEFAULT_BOX, height: 0.1 }, 0, 60, FPS);
    const percent = (style: { transform: string }) => Number(/translateY\((-?[\d.]+)%\)/.exec(style.transform)?.[1]);
    // The same 0.2 of the canvas is 50% of a 0.4 box and 200% of a 0.1 box.
    expect(percent(tall)).toBeCloseTo(50, 0);
    expect(percent(short)).toBeCloseTo(200, 0);
  });

  it("overshoots with a spring and settles", () => {
    expect(overshoot(0, 0.5)).toBeCloseTo(0, 6);
    expect(overshoot(1, 0.5)).toBe(1);
    const past = Math.max(...[0.3, 0.4, 0.5, 0.6].map((p) => overshoot(p, 0.5)));
    expect(past).toBeGreaterThan(1);
    expect(overshoot(0.95, 0.5)).toBeCloseTo(1, 1);

    const sprung = { ...DEFAULT_ANIMATION, enter: "scale" as const, enterFrames: 12, spring: 0.6 };
    const scales = Array.from({ length: 30 }, (_, frame) =>
      Number(/scale\(([\d.]+)\)/.exec(clipStyle(sprung, DEFAULT_BOX, frame, 90, FPS).transform)?.[1] ?? 1),
    );
    expect(Math.max(...scales)).toBeGreaterThan(1);
  });

  it("flips with a rotation the renderer gives a perspective to", () => {
    const animation = { ...DEFAULT_ANIMATION, enter: "flip" as const, enterFrames: 12 };
    expect(clipStyle(animation, DEFAULT_BOX, 0, 60, FPS).transform).toMatch(/rotateX\(-?\d/);
  });
});

describe("the move", () => {
  it("bows the path with an arc and lands straight", () => {
    const motion = { ...DEFAULT_MOTION, x: 0.4, y: 0, frames: 20, arc: 0.5, easing: "linear" as const };
    const mid = motionState(motion, 10, 60);
    expect(mid.dx).toBeCloseTo(0.2, 6);
    expect(Math.abs(mid.dy)).toBeGreaterThan(0.05);
    const end = motionState(motion, 20, 60);
    expect(end.dx).toBeCloseTo(0.4, 6);
    expect(end.dy).toBeCloseTo(0, 6);
  });

  it("turns, fades and defocuses by the end", () => {
    const motion = { ...DEFAULT_MOTION, rotate: 180, opacity: 0.2, blur: 1, frames: 10, easing: "linear" as const };
    const half = motionState(motion, 5, 60);
    expect(half.rotate).toBeCloseTo(90, 6);
    expect(half.opacity).toBeCloseTo(0.6, 6);
    expect(half.blur).toBeCloseTo(0.5, 6);
    const end = motionState(motion, 30, 60);
    expect(end.rotate).toBeCloseTo(180, 6);
    expect(end.opacity).toBeCloseTo(0.2, 6);
    expect(end.blur).toBeCloseTo(1, 6);
  });

  it("lands past the mark with a spring and comes back", () => {
    const motion = { ...DEFAULT_MOTION, x: 0.3, frames: 20, spring: 0.6 };
    const furthest = Math.max(...Array.from({ length: 21 }, (_, f) => motionState(motion, f, 60).dx));
    expect(furthest).toBeGreaterThan(0.3);
    expect(motionState(motion, 40, 60).dx).toBeCloseTo(0.3, 6);
  });
});

describe("the camera", () => {
  const moves = [
    { from: 30, frames: 20, x: 0.7, y: 0.6, scale: 1.6, easing: "linear" as const },
    { from: 90, frames: 10, x: 0.5, y: 0.5, scale: 1, easing: "linear" as const },
  ];

  it("starts on the whole canvas, pushes in, holds, and pulls back", () => {
    expect(cameraState(moves, 0)).toEqual({ x: 0.5, y: 0.5, scale: 1 });
    const mid = cameraState(moves, 40);
    expect(mid.scale).toBeCloseTo(1.3, 6);
    expect(mid.x).toBeCloseTo(0.6, 6);
    expect(cameraState(moves, 70)).toEqual({ x: 0.7, y: 0.6, scale: 1.6 });
    expect(cameraState(moves, 200)).toEqual({ x: 0.5, y: 0.5, scale: 1 });
  });

  it("is a transform that centres the point of interest, and nothing at home", () => {
    expect(cameraTransform({ x: 0.5, y: 0.5, scale: 1 }, 1920, 1080)).toBe("");
    expect(cameraTransform({ x: 0.75, y: 0.5, scale: 2 }, 1920, 1080)).toBe("scale(2) translate(-480px, 0px)");
  });

  it("reads unsorted moves in frame order", () => {
    expect(cameraState([...moves].reverse(), 70)).toEqual({ x: 0.7, y: 0.6, scale: 1.6 });
  });
});

describe("two-tone lines", () => {
  it("splits the starred words out and prints a lone star", () => {
    expect(accentRuns("Turn *books* into audio")).toEqual([
      { text: "Turn ", accent: false },
      { text: "books", accent: true },
      { text: " into audio", accent: false },
    ]);
    expect(stripAccents("Turn *books* into audio")).toBe("Turn books into audio");
    expect(accentRuns("5 * 3")).toEqual([{ text: "5 * 3", accent: false }]);
    expect(markedWords("*Just* drop").map((part) => [part.part, part.accent])).toEqual([
      ["Just", true],
      [" ", false],
      ["drop", false],
    ]);
  });

  it("appends a word every stagger, each taking its own frames", () => {
    expect(wordProgressAt(0, 3, 0, 6, 15)).toBe(0);
    expect(wordProgressAt(0, 3, 6, 6, 15)).toBe(1);
    expect(wordProgressAt(1, 3, 6, 6, 15)).toBe(0);
    expect(wordProgressAt(1, 3, 21, 6, 15)).toBe(1);
    expect(wordProgressAt(2, 3, 36, 6, 15)).toBe(1);
    // Without a stagger, the proportional scheme lands the last word at the end.
    expect(wordProgressAt(2, 3, 30, 30, 0)).toBe(1);
  });
});

describe("icons and particles", () => {
  it("has a path for every icon the schema names", () => {
    for (const name of ICONS) expect(ICON_PATHS[name].d.length).toBeGreaterThanOrEqual(6);
  });

  it("bursts the same way every time for a seed, and differently for another", () => {
    const spec = {
      style: "confetti" as const,
      count: 40,
      colors: ["#5B8CFF", "#F5A9E1"],
      spread: 0.6,
      gravity: 1,
      size: 0.016,
      seed: 7,
      box: { x: 0.5, y: 0.55, width: 0.1, height: 0.1 },
    };
    const a = particlesAt(spec, 12, 40, 16 / 9);
    const b = particlesAt(spec, 12, 40, 16 / 9);
    expect(a).toEqual(b);
    expect(a).toHaveLength(40);
    expect(particlesAt({ ...spec, seed: 8 }, 12, 40, 16 / 9)).not.toEqual(a);
    for (const piece of a) {
      expect(Number.isFinite(piece.x) && Number.isFinite(piece.y)).toBe(true);
      expect(spec.colors).toContain(piece.color);
    }
    // Confetti falls: by the end every piece is below where it started rising to.
    const late = particlesAt(spec, 39, 40, 16 / 9);
    expect(late.every((piece) => piece.opacity <= 0.05)).toBe(true);
  });

  it("keeps sparkles inside their box", () => {
    const box = { x: 0.5, y: 0.5, width: 0.4, height: 0.3 };
    const pieces = particlesAt(
      { style: "sparkles", count: 30, colors: ["#FFFFFF"], spread: 1, gravity: 0, size: 0.01, seed: 1, box },
      10,
      60,
      16 / 9,
    );
    for (const piece of pieces) {
      expect(piece.x).toBeGreaterThanOrEqual(0.3);
      expect(piece.x).toBeLessThanOrEqual(0.7);
      expect(piece.y).toBeGreaterThanOrEqual(0.35);
      expect(piece.y).toBeLessThanOrEqual(0.65);
    }
  });
});

describe("in the file", () => {
  it("reads a film written before any of this as flat, still and sharp", () => {
    const parsed = ProjectFileSchema.parse(projectFile());
    const clip = parsed.tracks[0]!.clips[0]!;
    expect(clip.kind === "text" && clip.box.tiltX).toBe(0);
    expect("shadow" in clip && clip.shadow).toBe(0);
    expect("animation" in clip && clip.animation.travel).toBe(0.03);
    expect(parsed.camera).toEqual([]);
  });

  it("accepts an icon, a burst, a device and a camera", () => {
    const file = projectFile({
      camera: [{ from: 30, frames: 20, x: 0.7, y: 0.6, scale: 1.6, easing: "in-out" }],
      tracks: [
        {
          id: "track-k",
          kind: "visual",
          name: "Kinetic",
          hidden: false,
          locked: false,
          volume: 1,
          clips: [
            { kind: "icon", id: "c-check", from: 0, durationInFrames: 30, icon: "check", draw: true } as never,
            { kind: "particles", id: "c-burst", from: 30, durationInFrames: 40, style: "confetti", count: 90 } as never,
            { kind: "device", id: "c-phone", from: 70, durationInFrames: 60, device: "phone", src: "assets/app.png", box: { tiltY: -20 }, shadow: 0.6 } as never,
          ],
        },
      ],
    });
    const parsed = ProjectFileSchema.safeParse(file);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
    if (!parsed.success) return;
    const phone = parsed.data.tracks[0]!.clips[2]!;
    expect(phone.kind === "device" && phone.box.tiltY).toBe(-20);
    expect(phone.kind === "device" && phone.radius).toBe(0.06);
  });

  it("ships every library piece as a valid element", () => {
    for (const item of LIBRARY) {
      const parsed = ElementSchema.safeParse({ ...item.draft, id: `el-${item.id}` });
      expect(parsed.success, `${item.id}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`).toBe(true);
    }
    const ids = LIBRARY.map((item) => item.id);
    for (const id of ["phone", "browser", "window", "card", "button", "gradient-bar", "hand-cursor", "kinetic-line", "progress-bar", "check", "sparkle-trail", "confetti", "sparkles"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("the tools", () => {
  beforeEach(async () => {
    resetBrowserStore();
    resetStudio();
    await actions.startInBrowser();
  });

  it("registers the four new tools and accepts their inputs", () => {
    const names = buildTools().map((tool) => tool.name);
    for (const name of ["prism.add_icon", "prism.add_particles", "prism.add_device", "prism.set_camera"]) {
      expect(names).toContain(name);
    }
    expect(AddIconInput.safeParse({ trackId: "t", from: 0, durationInFrames: 30, icon: "sparkle", draw: true }).success).toBe(true);
    expect(AddIconInput.safeParse({ trackId: "t", from: 0, durationInFrames: 30, icon: "unicorn" }).success).toBe(false);
    expect(AddParticlesInput.safeParse({ trackId: "t", from: 0, durationInFrames: 40, style: "burst", colors: ["#FFFFFF"] }).success).toBe(true);
    expect(AddDeviceInput.safeParse({ trackId: "t", from: 0, durationInFrames: 40, device: "phone", src: "assets/app.png", box: { tiltY: -20 } }).success).toBe(true);
    expect(SetCameraInput.safeParse({ moves: [{ from: 30, scale: 1.6, x: 0.7 }] }).success).toBe(true);
    expect(
      AddTextInput.safeParse({
        trackId: "t",
        from: 0,
        durationInFrames: 30,
        text: "Turn *books* into audio",
        accent: "#2F7CF6",
        reveal: "words",
        revealStagger: 6,
        revealStyle: "pop",
        fill: "#111114",
        radius: 0.5,
        shadow: 0.3,
        animation: { enter: "pop", spring: 0.3, travel: 0.2 },
        motion: { arc: 0.5, trail: true, rotate: 90 },
      }).success,
    ).toBe(true);
    expect(UpdateClipInput.parse({ clipId: "c", note: "n", box: { tiltX: 12 }, glow: 0.4 })).toEqual({
      clipId: "c",
      note: "n",
      box: { tiltX: 12 },
      glow: 0.4,
    });
  });

  it("sets the camera through the tool, sorted by frame", async () => {
    const tools = buildTools();
    const set = tools.find((tool) => tool.name === "prism.set_camera")!;
    const result = String(
      await set.execute({
        moves: [
          { from: 90, scale: 1 },
          { from: 30, frames: 18, x: 0.7, y: 0.6, scale: 1.6 },
        ],
      }),
    );
    expect(result).toMatch(/2 moves/);
    const camera = readProject()!.file.camera;
    expect(camera.map((move) => move.from)).toEqual([30, 90]);
    expect(camera[0]).toEqual({ from: 30, frames: 18, x: 0.7, y: 0.6, scale: 1.6, easing: "in-out" });
  });
});
