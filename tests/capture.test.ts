import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { planCapture, sheetLayout, timecode } from "@/lib/render/capture-plan";
import { resetStudio } from "@/lib/studio/store";
import { buildTools } from "@/lib/webmcp/tools";

/**
 * Capturing frames: the agent's eyes.
 *
 * The plan is arithmetic — seconds to frames, a cadence inside a window, an
 * explicit list — and arithmetic is where "one per second from six to nine"
 * quietly becomes five frames or three. The rendering needs a browser and is
 * checked by hand; the plan is checked here.
 */

beforeEach(() => resetStudio());

describe("planning a capture", () => {
  const film = { fps: 30, durationInFrames: 450, max: 24 }; // 15s

  it("one per second across the whole film by default", () => {
    // The film is 449 frames, 14.97s: the cadence lands on 0s through 14s
    // and does not invent a beat at the last frame. `at` is for that.
    const plan = planCapture(film);
    expect(plan.frames).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420]);
    expect(plan.truncated).toBe(false);
  });

  it("a cadence inside a window is inclusive at both ends", () => {
    const plan = planCapture({ ...film, every: 1, from: 6, to: 9 });
    expect(plan.frames).toEqual([180, 210, 240, 270]);
    expect(plan.from).toBe(6);
    expect(plan.to).toBe(9);
  });

  it("steps in seconds so a fractional cadence does not drift", () => {
    const plan = planCapture({ ...film, every: 0.5, from: 0, to: 2 });
    expect(plan.frames).toEqual([0, 15, 30, 45, 60]);
  });

  it("takes exact moments when they are given, sorted and de-duplicated", () => {
    const plan = planCapture({ ...film, at: [9, 6, 6.001, 7.5] });
    expect(plan.frames).toEqual([180, 225, 270]);
  });

  it("clamps to the film and never asks for a frame past the end", () => {
    const plan = planCapture({ ...film, every: 1, from: 14, to: 40 });
    expect(plan.frames).toEqual([420]);
    expect(planCapture({ ...film, at: [99] }).frames).toEqual([449]);
  });

  it("caps a long cadence and says so", () => {
    const plan = planCapture({ ...film, every: 0.1, max: 24 });
    expect(plan.frames).toHaveLength(24);
    expect(plan.truncated).toBe(true);
  });

  it("never asks for a cadence finer than a frame", () => {
    const plan = planCapture({ ...film, every: 0.001, from: 0, to: 0.1 });
    expect(plan.frames).toEqual([0, 1, 2, 3]);
  });
});

describe("the sheet", () => {
  it("stamps time as minutes, seconds and hundredths", () => {
    expect(timecode(0, 30)).toBe("0:00.00");
    expect(timecode(195, 30)).toBe("0:06.50");
    expect(timecode(30 * 61, 30)).toBe("1:01.00");
  });

  it("lays four across and wraps, with a caption strip under each cell", () => {
    const layout = sheetLayout(6, 480, 16 / 9);
    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(2);
    expect(layout.cellHeight).toBe(270);
    expect(layout.cells).toHaveLength(6);
    expect(layout.cells[4]!.y).toBeGreaterThan(layout.cells[0]!.y);
    expect(layout.width).toBe(8 + 4 * 488);
  });

  it("does not pad a short strip out to four columns", () => {
    expect(sheetLayout(2, 480, 16 / 9).columns).toBe(2);
  });
});

describe("the capture tool", () => {
  it("is registered, read-only, and refuses gracefully without a browser", async () => {
    const tool = buildTools().find((tool) => tool.name === "prism.capture_frames")!;
    expect(tool).toBeDefined();
    expect(tool.annotations?.readOnlyHint).toBe(true);

    const result = await tool.execute({ every: 1 });
    expect(String(result)).toMatch(/Could not/);
  });

  it("needs an open composition", async () => {
    const result = await actions.captureFrames({ every: 1 });
    expect(result.ok).toBe(false);
  });
});
