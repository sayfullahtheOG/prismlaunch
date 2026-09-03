import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { elementForFile, kindForPath, safeAssetName } from "@/lib/studio/files";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { browserWorkspace, loadAssets, removeAssetFile } from "@/lib/workspace/fs";

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  await actions.startInBrowser();
});

describe("undo and redo", () => {
  it("walk the film's changes, and a new change clears redo", () => {
    actions.setDuration(300);
    actions.setDuration(600);
    expect(readProject()!.file.durationInFrames).toBe(600);

    expect(actions.undo().ok).toBe(true);
    expect(readProject()!.file.durationInFrames).toBe(300);
    expect(actions.redo().ok).toBe(true);
    expect(readProject()!.file.durationInFrames).toBe(600);

    actions.undo();
    actions.setDuration(450);
    expect(useStudioStore.getState().history.future).toHaveLength(0);
    expect(actions.redo().ok).toBe(false);
    expect(readProject()!.file.durationInFrames).toBe(450);
  });

  it("say so when there is nothing to walk", () => {
    expect(actions.undo().ok).toBe(false);
    expect(actions.redo().ok).toBe(false);
  });

  it("are recorded as things that happened", () => {
    actions.setDuration(300);
    actions.undo();
    const labels = readProject()!.activity.map((event) => event.label);
    expect(labels[labels.length - 1]).toBe("Undo");
  });

  it("belong to one composition", async () => {
    actions.setDuration(300);
    expect(useStudioStore.getState().history.past.length).toBeGreaterThan(0);
    await actions.createBlankProject();
    expect(useStudioStore.getState().history.past).toHaveLength(0);
  });
});

describe("files", () => {
  it("know what they are by extension", () => {
    expect(kindForPath("assets/bed.mp3")).toBe("audio");
    expect(kindForPath("assets/clip.MOV")).toBe("video");
    expect(kindForPath("assets/shot.png")).toBe("image");
    expect(elementForFile("assets/vector-shot.png")).toMatchObject({ kind: "image", name: "vector-shot" });
  });

  it("get a safe, unused name in assets", () => {
    expect(safeAssetName("My Shot (1).png", new Set())).toBe("My-Shot-1-.png");
    expect(safeAssetName("shot.png", new Set(["shot.png"]))).toBe("shot-2.png");
    expect(safeAssetName("shot.png", new Set(["shot.png", "shot-2.png"]))).toBe("shot-3.png");
  });

  it("resolve the studio's own library from the site, in a workspace with no folder", async () => {
    const { urls, missing } = await loadAssets(browserWorkspace(), "any", [
      "library/audio/whoosh.wav",
    ]);
    expect(urls["library/audio/whoosh.wav"]).toBe("/library/audio/whoosh.wav");
    expect(missing).toEqual([]);
  });
});

describe("deleting a file from assets", () => {
  it("refuses a file the film still uses, and one that is not there", async () => {
    resetBrowserStore();
    resetStudio();
    await actions.startInBrowser();
    const cursor = actions.createElement({
      kind: "image",
      name: "Shot",
      src: "assets/shot.png",
      fit: "cover",
      radius: 0,
      shadow: 0,
      glow: 0,
      blur: 0,
      box: { x: 0.5, y: 0.5, width: 0.8, height: 0.45, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
      animation: { enter: "none", exit: "none", enterFrames: 12, exitFrames: 12, travel: 0.03, spring: 0 },
      motion: { x: 0, y: 0, scale: 1, frames: 0, delay: 0, easing: "out", press: false, rotate: 0, opacity: 1, blur: 0, arc: 0, spring: 0, trail: false },
    });
    expect(cursor.ok).toBe(true);
    const used = await actions.removeAsset("assets/shot.png");
    expect(used.ok).toBe(false);
    expect(used.message).toMatch(/still used/);

    const missing = await actions.removeAsset("assets/never.png");
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/no assets\/never\.png/);

    // Only a file under assets/ is ever removed, whatever the caller says.
    const outside = await removeAssetFile(browserWorkspace(), "x", "project.json");
    expect(outside.ok).toBe(false);
  });
});
