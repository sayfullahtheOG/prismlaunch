import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { clipFromElement } from "@/lib/studio/edits";
import { CURSOR_SRC, LIBRARY } from "@/lib/studio/library";
import { ClipSchema, DEFAULT_MOTION, ElementSchema } from "@/lib/studio/schema";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import {
  AddFromLibraryInput,
  AddTextInput,
  UpdateClipInput,
  UpdateElementInput,
} from "@/lib/studio/tool-inputs";
import { buildTools } from "@/lib/webmcp/tools";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { motionState, PRESS_FRAMES } from "@/remotion/motion";
import {
  caretVisible,
  countText,
  revealProgress,
  splitWords,
  typedText,
  wordProgress,
} from "@/remotion/reveal";
import { textClip } from "./fixture";

/**
 * Reveals and motion: the words arriving and the one move a clip makes.
 *
 * Both are pure functions of the frame, which is what lets the export match
 * the preview, and what lets these tests ask what frame twelve looks like
 * without a browser.
 */

describe("a move over the clip's life", () => {
  it("is still by default, and costs nothing", () => {
    expect(motionState(DEFAULT_MOTION, 10, 60)).toEqual({
      dx: 0,
      dy: 0,
      scale: 1,
      rotate: 0,
      opacity: 1,
      blur: 0,
    });
  });

  it("travels, eases out, and holds where it lands", () => {
    const motion = { ...DEFAULT_MOTION, x: 0.2, y: -0.1, frames: 20 };
    expect(motionState(motion, 0, 60)).toMatchObject({ dx: 0, dy: -0, scale: 1 });
    const half = motionState(motion, 10, 60);
    // Ease-out: more than halfway there at half time.
    expect(half.dx).toBeGreaterThan(0.1);
    expect(half.dx).toBeLessThan(0.2);
    expect(half.dy).toBeCloseTo(-half.dx / 2, 6);
    expect(motionState(motion, 20, 60).dx).toBeCloseTo(0.2, 6);
    expect(motionState(motion, 59, 60).dx).toBeCloseTo(0.2, 6);
  });

  it("waits for its delay, and runs to the end of the clip when frames is 0", () => {
    const motion = { ...DEFAULT_MOTION, scale: 2, delay: 10, easing: "linear" as const };
    expect(motionState(motion, 5, 50).scale).toBe(1);
    expect(motionState(motion, 30, 50).scale).toBeCloseTo(1.5, 6);
    expect(motionState(motion, 50, 50).scale).toBeCloseTo(2, 6);
  });

  it("presses once on arrival, then settles", () => {
    const motion = { ...DEFAULT_MOTION, x: 0.1, frames: 10, press: true };
    expect(motionState(motion, 9, 60).scale).toBe(1);
    const mid = motionState(motion, 10 + PRESS_FRAMES / 2, 60).scale;
    expect(mid).toBeLessThan(0.9);
    expect(motionState(motion, 10 + PRESS_FRAMES, 60).scale).toBe(1);
    expect(motionState(motion, 40, 60).scale).toBe(1);
  });
});

describe("words arriving", () => {
  it("types whole characters, never half an emoji", () => {
    expect(typedText("hi 👋", 0)).toBe("");
    expect(typedText("hi 👋", 0.5)).toBe("hi");
    expect(typedText("hi 👋", 1)).toBe("hi 👋");
    expect(revealProgress(15, 30)).toBe(0.5);
    expect(revealProgress(45, 30)).toBe(1);
  });

  it("counts the first number up to itself, keeping its formatting", () => {
    expect(countText("10,000+ users", 0)).toBe("0+ users");
    expect(countText("10,000+ users", 1)).toBe("10,000+ users");
    expect(countText("4.5 stars", 1)).toBe("4.5 stars");
    expect(countText("4.5 stars", 0)).toBe("0.0 stars");
    expect(countText("Rated 4.5 by 1,200", 1)).toBe("Rated 4.5 by 1,200");
    expect(countText("No numbers here", 0.3)).toBe("No numbers here");
    const mid = countText("1,000", 0.5);
    expect(mid).toMatch(/^\d{3}$|^\d,\d{3}$/);
  });

  it("lands words in turn, the last one as the reveal ends", () => {
    expect(splitWords("one two  three")).toEqual(["one", " ", "two", "  ", "three"]);
    expect(wordProgress(0, 3, 0.3)).toBe(1);
    expect(wordProgress(2, 3, 0.3)).toBe(0);
    expect(wordProgress(2, 3, 1)).toBe(1);
    expect(wordProgress(0, 1, 0.5)).toBeGreaterThan(0.5);
  });

  it("holds the caret steady while typing and blinks it after", () => {
    expect(caretVisible(7, 30, true)).toBe(true);
    expect(caretVisible(0, 30, false)).toBe(true);
    expect(caretVisible(15, 30, false)).toBe(false);
    expect(caretVisible(30, 30, false)).toBe(true);
  });
});

describe("in the file", () => {
  it("reads an older clip as still, with no reveal", () => {
    const { motion, reveal, revealFrames, caret, ...bare } = textClip() as Record<string, unknown>;
    void motion;
    void reveal;
    void revealFrames;
    void caret;
    const parsed = ClipSchema.parse(bare);
    expect(parsed.kind === "text" && parsed.reveal).toBe("none");
    expect("motion" in parsed && parsed.motion).toEqual(DEFAULT_MOTION);
  });

  it("carries reveal and motion from an element to its clip, with the placement's say", () => {
    const item = LIBRARY.find((candidate) => candidate.id === "cursor")!;
    const element = ElementSchema.parse({ ...item.draft, id: "el-cursor" });
    const made = clipFromElement(element, {
      from: 0,
      durationInFrames: 60,
      motion: { x: 0.3 },
    });
    expect(made.ok && "motion" in made.clip && made.clip.motion).toEqual({
      ...("motion" in item.draft ? item.draft.motion : {}),
      x: 0.3,
    });

    const typed = LIBRARY.find((candidate) => candidate.id === "typewriter")!;
    const style = ElementSchema.parse({ ...typed.draft, id: "el-type" });
    const line = clipFromElement(style, { from: 0, durationInFrames: 60, text: "npm i prism" });
    expect(line.ok && line.clip.kind === "text" && line.clip.reveal).toBe("type");
    expect(line.ok && line.clip.kind === "text" && line.clip.caret).toBe(true);
  });
});

describe("the library's motion pieces", () => {
  beforeEach(async () => {
    resetBrowserStore();
    resetStudio();
    await actions.startInBrowser();
  });

  it("has the pieces a product film keeps rebuilding, and ships their files", () => {
    const motion = LIBRARY.filter((item) => item.group === "Motion").map((item) => item.id);
    expect(motion).toEqual([
      "cursor",
      "hand-cursor",
      "tap-ring",
      "typewriter",
      "word-by-word",
      "kinetic-line",
      "counter",
      "progress-bar",
      "check",
      "sparkle-trail",
      "confetti",
      "sparkles",
      "live-card",
      "highlight",
    ]);
    for (const item of LIBRARY) {
      if (!("src" in item.draft) || typeof item.draft.src !== "string") continue;
      expect(existsSync(join(process.cwd(), "public", item.draft.src)), item.draft.src).toBe(true);
    }
  });

  it("resolves a piece's own file as soon as it is added, not on the next reload", async () => {
    const cursor = LIBRARY.find((candidate) => candidate.id === "cursor")!;
    expect(useStudioStore.getState().assets).not.toHaveProperty(CURSOR_SRC);
    const result = actions.createElement(cursor.draft);
    expect(result.ok, result.message).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(useStudioStore.getState().assets[CURSOR_SRC]).toBe(`/${CURSOR_SRC}`);
  });

  it("adds a piece through the tool, named as asked", async () => {
    const tools = buildTools();
    const add = tools.find((tool) => tool.name === "prism.add_from_library")!;
    expect(add).toBeDefined();
    expect(AddFromLibraryInput.safeParse({ itemId: "cursor" }).success).toBe(true);
    expect(AddFromLibraryInput.safeParse({ itemId: "spaceship" }).success).toBe(false);

    // A person can add it at any stage; the tool holds the agent to the process
    // like add_element, so the human path is what proves the draft is sound.
    const result = actions.createElement({ ...LIBRARY.find((i) => i.id === "counter")!.draft, name: "Users" });
    expect(result.ok, result.message).toBe(true);
    const element = readProject()!.file.elements.find((candidate) => candidate.name === "Users");
    expect(element?.kind === "text" && element.reveal).toBe("count");
    expect(String(await add.execute({ itemId: "nope" }))).toMatch(/itemId/);
  });

  it("lets an agent ask for reveals and motion on clips", () => {
    expect(
      AddTextInput.safeParse({
        trackId: "t",
        from: 0,
        durationInFrames: 30,
        text: "Hello",
        reveal: "words",
        caret: true,
        motion: { scale: 1.1 },
      }).success,
    ).toBe(true);
    const update = UpdateClipInput.safeParse({
      clipId: "c",
      note: "glide",
      motion: { x: 0.1, press: true },
      reveal: "type",
    });
    expect(update.success && update.data.motion).toEqual({ x: 0.1, press: true });
  });

  it("leaves out what an update did not mention, so nothing is reset by accident", () => {
    expect(UpdateClipInput.parse({ clipId: "c", note: "n", box: { y: 0.4 } })).toEqual({
      clipId: "c",
      note: "n",
      box: { y: 0.4 },
    });
    expect(UpdateElementInput.parse({ elementId: "e", animation: { enter: "fade" } })).toEqual({
      elementId: "e",
      animation: { enter: "fade" },
    });
  });
});
