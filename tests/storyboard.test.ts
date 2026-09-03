import { beforeEach, describe, expect, it } from "vitest";
import { BoardLayerSchema, ProjectFileSchema, StoryboardPanelSchema, StoryboardVisualSchema } from "@/lib/studio/schema";
import { SubmitStoryboardInput } from "@/lib/studio/tool-inputs";
import { boardAtFrame, boardMoments, boardPoseAt } from "@/lib/studio/storyboard";
import { referencedAssets } from "@/lib/studio/edits";
import { layAnimatic, submitStoryboard, patchStoryboardPanel } from "@/lib/studio/actions";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { approvedThrough, boardVisual, film, projectFile } from "./fixture";

const panel = () => StoryboardPanelSchema.parse({ id: "p1", label: "Product moves", frame: "The app moves left while its preview expands.", durationInFrames: 60, visual: boardVisual(), transitionIn: "none", transitionOut: "none" });
beforeEach(() => resetStudio());

describe("visual storyboards", () => {
  it("opens legacy boards, but requires visual scenes on new submissions", async () => {
    const { visual: _visual, ...legacy } = panel(); void _visual;
    expect(StoryboardPanelSchema.safeParse(legacy).success).toBe(true);
    expect(SubmitStoryboardInput.safeParse({ panels: [legacy, { ...legacy, id: "p2" }] }).success).toBe(false);
    useStudioStore.getState().setProject(film({ process: approvedThrough("script") }), 0);
    const result = await submitStoryboard({ panels: [legacy, { ...legacy, id: "p2" }] });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/visual/);
    expect(readProject()!.file.process.storyboard.status).toBe("pending");
  });

  it("interpolates partial poses cumulatively without resetting opacity or rotation", () => {
    const layer = BoardLayerSchema.parse({ id: "ui", kind: "browser", label: "UI", x: .5, y: .5, width: .8, height: .7, rotation: 12, opacity: .6, keyframes: [{ at: 20, x: .3, easing: "linear" }, { at: 40, width: .4, easing: "linear" }] });
    expect(boardPoseAt(layer, 10)).toMatchObject({ x: .4, width: .8, rotation: 12, opacity: .6 });
    expect(boardPoseAt(layer, 30)).toMatchObject({ x: .3, rotation: 12, opacity: .6 });
    expect(boardPoseAt(layer, 30).width).toBeCloseTo(.6);
    expect(boardPoseAt(layer, 59)).toMatchObject({ x: .3, width: .4 });
  });

  it("respects delayed entrances, cut keyframes and exclusive exits", () => {
    const layer = BoardLayerSchema.parse({ id: "cursor", kind: "cursor", label: "Click", x: .1, y: .5, width: .03, height: .07, from: 5, until: 40, keyframes: [{ at: 20, x: .8, easing: "hold" }] });
    expect(boardPoseAt(layer, 4).opacity).toBe(0);
    expect(boardPoseAt(layer, 19).x).toBe(.1);
    expect(boardPoseAt(layer, 20).x).toBe(.8);
    expect(boardPoseAt(layer, 40).opacity).toBe(0);
  });

  it("rejects duplicate ids, missing image sources, unsafe paths and invalid timing", () => {
    const layer = boardVisual().layers[0]!;
    expect(StoryboardVisualSchema.safeParse({ layers: [layer, layer] }).success).toBe(false);
    expect(BoardLayerSchema.safeParse({ ...layer, kind: "image" }).success).toBe(false);
    expect(BoardLayerSchema.safeParse({ ...layer, src: "../private.png" }).success).toBe(false);
    expect(BoardLayerSchema.safeParse({ ...layer, keyframes: [{ at: 20 }, { at: 10 }] }).success).toBe(false);
    expect(BoardLayerSchema.safeParse({ ...layer, from: 20, until: 10 }).success).toBe(false);
    expect(StoryboardPanelSchema.safeParse({ ...panel(), durationInFrames: 30 }).success).toBe(false);
  });

  it("selects the next shot exactly at a cut and clamps the end of playback", () => {
    const panels = [panel(), { ...panel(), id: "p2", durationInFrames: 90 }];
    expect(boardAtFrame(panels, 59)?.index).toBe(0);
    expect(boardAtFrame(panels, 60)).toMatchObject({ index: 1, localFrame: 0, from: 60 });
    expect(boardAtFrame(panels, 150)?.localFrame).toBe(89);
    expect(boardMoments(panels[0]!)).toEqual([0, 30, 59]);
  });

  it("persists the scene and includes images before they are placed on the timeline", () => {
    const visual = StoryboardVisualSchema.parse({ layers: [{ ...boardVisual().layers[0], kind: "image", src: "assets/screen.png" }] });
    const original = projectFile({ process: { ...approvedThrough("script"), storyboard: { status: "submitted", panels: [{ ...panel(), visual }] } } });
    const saved = ProjectFileSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(saved.process.storyboard.panels[0]!.visual).toEqual(visual);
    expect(referencedAssets(saved)).toContain("assets/screen.png");
  });

  it("rejects nonexistent screenshots rather than submitting empty frames", async () => {
    useStudioStore.getState().setProject(film({ process: approvedThrough("script") }), 0);
    const visual = StoryboardVisualSchema.parse({ layers: [{ ...boardVisual().layers[0], kind: "image", src: "assets/missing.png" }] });
    const result = await submitStoryboard({ panels: [{ ...panel(), visual }, { ...panel(), id: "p2" }] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("assets/missing.png");
  });

  it("transcribes the approved visual scene into the animatic without dropping its layers or motion", async () => {
    useStudioStore.getState().setProject(film({ tracks: [], process: { ...approvedThrough("storyboard"), storyboard: { status: "approved", panels: [panel(), { ...panel(), id: "p2" }] } } }), 0);
    expect((await layAnimatic()).ok).toBe(true);
    const file = readProject()!.file;
    const clips = file.tracks.find((track) => track.name === "Boards")!.clips;
    expect(clips.map((clip) => [clip.kind, clip.from, clip.durationInFrames])).toEqual([["storyboard", 0, 60], ["storyboard", 60, 60]]);
    expect(clips[0]!.kind === "storyboard" && clips[0]!.visual).toEqual(panel().visual);
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
    expect((await layAnimatic()).ok).toBe(true);
    expect(readProject()!.file.tracks.find((track) => track.name === "Boards")!.clips).toHaveLength(2);
  });

  it("keeps human edits atomic when shortened timing would cut off a keyframe", () => {
    useStudioStore.getState().setProject(film({ process: { ...approvedThrough("script"), storyboard: { status: "submitted", panels: [panel()] } } }), 0);
    const result = patchStoryboardPanel("p1", { durationInFrames: 20 });
    expect(result.ok).toBe(false);
    expect(readProject()!.file.process.storyboard.panels[0]!.durationInFrames).toBe(60);
  });
});
