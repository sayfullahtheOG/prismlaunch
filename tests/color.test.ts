import { describe, expect, it } from "vitest";
import { isLightGround, relativeLuminance, roughInk } from "@/lib/studio/color";

/**
 * The roughs' ink answers the ground. The first agent-built board set a
 * near-white film and every board went white on white; this pins the choice
 * that prevents it.
 */
describe("ink on a ground", () => {
  it("reads dark on light and light on dark, gradients by their mean", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 4);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(isLightGround({ kind: "solid", color: "#FAFAF8" })).toBe(true);
    expect(isLightGround({ kind: "solid", color: "#0A0A0C" })).toBe(false);
    expect(isLightGround({ kind: "gradient", from: "#FFFFFF", to: "#DDDDDD", angle: 90 })).toBe(true);
    expect(isLightGround({ kind: "gradient", from: "#111111", to: "#333333", angle: 90 })).toBe(false);

    expect(roughInk({ kind: "solid", color: "#FAFAF8" }).ink).toBe("#14141A");
    expect(roughInk({ kind: "solid", color: "#0A0A0C" }).ink).toBe("#F5F5F7");
    // Alpha in an 8-digit hex is ignored, not misread as a channel.
    expect(isLightGround({ kind: "solid", color: "#FFFFFF80" })).toBe(true);
  });
});
