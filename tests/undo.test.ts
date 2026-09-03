import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { elementForFile, kindForPath, safeAssetName } from "@/lib/studio/files";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { browserWorkspace, loadAssets } from "@/lib/workspace/fs";

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
