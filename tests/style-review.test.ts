import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { shouldFollowStyleWork } from "@/lib/studio/review";
import { ElementSchema } from "@/lib/studio/schema";
import { htmlElementPreview, styleSamples } from "@/lib/studio/style-review";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { approvedThrough, film, projectFile, textClip, visualTrack } from "./fixture";

const headline = ElementSchema.parse({ kind: "text", id: "headline", name: "Headline", text: "Ship it." });

beforeEach(() => {
  resetStudio();
  useStudioStore.getState().setProject(film({ tracks: [visualTrack([])] }), 1);
  actions.reviewStage("storyboard");
});

describe("following style work", () => {
  it("keeps approval on the boards, then opens the gallery on the first agent element", () => {
    expect(actions.approveStage("storyboard").ok).toBe(true);
    expect(useStudioStore.getState().openStage).toBe("storyboard");
    expect(actions.createElement(headline, "agent").ok).toBe(true);
    expect(useStudioStore.getState().tab).toBe("process");
    expect(useStudioStore.getState().openStage).toBe("style");
    expect(readProject()?.file.elements).toHaveLength(1);
  });

  it("follows a clip added by an agent from the storyboard rail", () => {
    actions.showTab("storyboard");
    expect(actions.createClip("track-1", textClip(), "agent").ok).toBe(true);
    expect(useStudioStore.getState().tab).toBe("process");
    expect(useStudioStore.getState().openStage).toBe("style");
  });

  it.each(["editor", "files"] as const)("does not take over an explicit %s view", (tab) => {
    actions.showTab(tab);
    expect(actions.createElement(headline, "agent").ok).toBe(true);
    expect(useStudioStore.getState().tab).toBe(tab);
  });

  it("ignores rejected edits, human edits and empty track creation", () => {
    expect(actions.createElement({ ...headline, name: "" }, "agent").ok).toBe(false);
    expect(useStudioStore.getState().openStage).toBe("storyboard");
    expect(actions.createElement(headline, "human").ok).toBe(true);
    expect(useStudioStore.getState().openStage).toBe("storyboard");
    const previous = projectFile({ tracks: [] });
    expect(shouldFollowStyleWork(previous, { ...previous, tracks: [visualTrack([])] }, "process", "storyboard")).toBe(false);
  });

  it("recognizes edits arriving from project parts but does not follow after style approval", () => {
    const previous = projectFile({ elements: [headline] });
    const next = { ...previous, elements: [{ ...headline, name: "Refined headline" }] };
    expect(shouldFollowStyleWork(previous, next, "process", "storyboard")).toBe(true);
    expect(shouldFollowStyleWork(previous, { ...next, process: approvedThrough("style") }, "process", "storyboard")).toBe(false);
    expect(shouldFollowStyleWork(previous, next, "process", "script")).toBe(false);
  });

  it("preserves notes on pending approval and send back", () => {
    expect(actions.requestChanges("style", "Make the type larger.").ok).toBe(true);
    expect(readProject()?.file.process.style.note).toBe("Make the type larger.");
    expect(actions.approveStage("style", { note: "Keep the blue accent." }).ok).toBe(true);
    expect(readProject()?.file.process.style.note).toBe("Keep the blue accent.");
  });
});

describe("style previews", () => {
  it("shows live frames before submission, deduplicates overlapping layers and honors submitted samples", () => {
    const file = projectFile({ tracks: [visualTrack([
      textClip({ id: "title", label: "Opening" }),
      textClip({ id: "caption" }),
      textClip({ id: "end", from: 90 }),
    ])] });
    expect(styleSamples(file).map((sample) => sample.frame)).toEqual([29, 119]);
    file.process.style.clipIds = ["end"];
    expect(styleSamples(file).map((sample) => sample.id)).toEqual(["end"]);
    file.tracks = file.tracks.map((track) => ({ ...track, hidden: true }));
    expect(styleSamples(file)).toEqual([]);
  });

  it("previews an unplaced HTML element without changing the composition", () => {
    const element = ElementSchema.parse({ kind: "html", id: "ui", name: "UI", html: "<div>Approve</div>" });
    if (element.kind !== "html") throw new Error("Expected HTML");
    const file = projectFile();
    const original = structuredClone(file);
    const preview = htmlElementPreview(file, element);
    expect(preview.tracks).toHaveLength(1);
    expect(preview.tracks[0]?.clips[0]?.kind).toBe("html");
    expect(preview.camera).toEqual([]);
    expect(file).toEqual(original);
  });
});
