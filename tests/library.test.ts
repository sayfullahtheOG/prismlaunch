import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { isAnimated, LIBRARY, LIBRARY_GROUPS, previewFrames } from "@/lib/studio/library";
import { readProject, resetStudio } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";

/**
 * The library: prebuilt pieces that become elements of a film. Every item
 * must be a valid element as it stands, because "Add" copies it in without
 * asking anything.
 */

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  await actions.startInBrowser();
});

describe("the library", () => {
  it("has type and shapes, each item in a known group with a name and a blurb", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(8);
    for (const item of LIBRARY) {
      expect(LIBRARY_GROUPS).toContain(item.group);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(10);
      expect(item.draft.name).toBe(item.name.startsWith("Blank") ? item.draft.name : item.draft.name);
    }
    const ids = LIBRARY.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds every item as an element of the film, as a person, at any stage", () => {
    for (const item of LIBRARY) {
      const result = actions.createElement(item.draft);
      expect(result.ok, `${item.id}: ${result.message}`).toBe(true);
    }
    const elements = readProject()!.file.elements;
    expect(elements).toHaveLength(LIBRARY.length);
    expect(elements.filter((element) => element.kind === "text").length).toBe(
      LIBRARY.filter((item) => item.draft.kind === "text").length,
    );
  });

  it("knows which pieces move, and how long a preview of each should play", () => {
    for (const item of LIBRARY) {
      expect(isAnimated(item.draft), item.id).toBe(item.group === "Motion");
      expect(previewFrames(item.draft), item.id).toBeGreaterThanOrEqual(30);
    }
    const typed = LIBRARY.find((item) => item.id === "typewriter")!.draft;
    expect(typed.kind === "text" && previewFrames(typed) > typed.revealFrames).toBe(true);
    const cursor = LIBRARY.find((item) => item.id === "cursor")!.draft;
    expect("motion" in cursor && previewFrames(cursor) > cursor.motion.delay + cursor.motion.frames).toBe(true);
  });

  it("ships every sound it lists, from the site itself", () => {
    const sounds = LIBRARY.filter((item) => item.draft.kind === "audio");
    expect(sounds.length).toBeGreaterThanOrEqual(8);
    for (const item of sounds) {
      if (item.draft.kind !== "audio") continue;
      expect(item.draft.src.startsWith("library/audio/")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", item.draft.src)), item.draft.src).toBe(true);
    }
  });

  it("has music beds that fade out, and effects that do not", () => {
    const beds = LIBRARY.filter((item) => item.group === "Music");
    expect(beds.length).toBe(3);
    for (const item of beds) {
      expect(item.draft.kind === "audio" && item.draft.role).toBe("music");
      expect(item.draft.kind === "audio" && item.draft.fadeOutFrames).toBeGreaterThan(0);
    }
    for (const item of LIBRARY.filter((item) => item.group === "Sound")) {
      expect(item.draft.kind === "audio" && item.draft.fadeOutFrames).toBe(0);
    }
  });
});
