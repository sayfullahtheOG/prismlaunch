import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import {
  DEFAULT_TIMELINE_HEIGHT,
  MAX_TIMELINE_HEIGHT,
  MIN_TIMELINE_HEIGHT,
  readProject,
  resetStudio,
  useStudioStore,
} from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";

/**
 * The timeline's arithmetic and state, the parts a browser is not needed
 * for. The pointer work — drags, trims, the scroll following the playhead —
 * was checked by hand against a laid animatic.
 */

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  await actions.startInBrowser();
  actions.setDuration(300);
});

describe("the playhead", () => {
  it("stops on the last frame, which is one before the duration", () => {
    expect(readProject()!.file.durationInFrames).toBe(300);
    actions.seek(300);
    expect(useStudioStore.getState().playhead).toBe(299);
    actions.seek(1000);
    expect(useStudioStore.getState().playhead).toBe(299);
    actions.seek(-4);
    expect(useStudioStore.getState().playhead).toBe(0);
    const mid = actions.seek(150);
    expect(mid.ok && mid.message).toMatch(/frame 150/);
  });
});

describe("trimming to content", () => {
  it("is not an event when nothing changes", () => {
    const before = readProject()!.activity.length;
    actions.setDuration(300);
    // Nothing on the timeline: trimming makes it one frame, once.
    expect(actions.fitDurationToContent().ok).toBe(true);
    const afterFirst = readProject()!.activity.length;
    expect(afterFirst).toBeGreaterThan(before);
    actions.fitDurationToContent();
    actions.fitDurationToContent();
    expect(readProject()!.activity.length).toBe(afterFirst);
  });
});

describe("the timeline's height", () => {
  it("has a default and is clamped to what fits a screen", () => {
    const { setTimelineHeight } = useStudioStore.getState();
    expect(useStudioStore.getState().timelineHeight).toBe(DEFAULT_TIMELINE_HEIGHT);
    setTimelineHeight(50);
    expect(useStudioStore.getState().timelineHeight).toBe(MIN_TIMELINE_HEIGHT);
    setTimelineHeight(5000);
    expect(useStudioStore.getState().timelineHeight).toBe(MAX_TIMELINE_HEIGHT);
    setTimelineHeight(420.6);
    expect(useStudioStore.getState().timelineHeight).toBe(421);
  });
});

describe("a notice", () => {
  it("is what a refused action leaves behind", () => {
    const { setNotice } = useStudioStore.getState();
    expect(useStudioStore.getState().notice).toBeNull();
    setNotice("The playhead is not inside the clip.");
    expect(useStudioStore.getState().notice).toMatch(/not inside/);
    setNotice(null);
    expect(useStudioStore.getState().notice).toBeNull();
  });

  it("split refuses, with a reason, when the playhead is outside the clip", async () => {
    const tools = (await import("@/lib/webmcp/tools")).buildTools();
    const call = (name: string, input: Record<string, unknown>) =>
      tools.find((tool) => tool.name === name)!.execute(input);
    // Clips come after the storyboard is approved; approve the way through.
    for (const stage of ["brief", "concept", "script", "storyboard"] as const) {
      actions.approveStage(stage);
    }
    const added = String(
      await call("prism.add_text", {
        trackId: "track-main",
        from: 60,
        durationInFrames: 60,
        text: "Hello",
      }),
    );
    const id = added.match(/clip (\S+) to/)?.[1];
    expect(id).toBeDefined();
    actions.select(id!);
    actions.seek(10);
    const result = actions.splitAtPlayhead();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not inside/);
  });
});

describe("update_clip reaches the whole clip", () => {
  it("patches type fields the old input dropped, and moves a clip across layers", async () => {
    const { resetBrowserStore } = await import("@/lib/workspace/browser-store");
    const { resetStudio, readProject } = await import("@/lib/studio/store");
    const actions = await import("@/lib/studio/actions");
    resetBrowserStore();
    resetStudio();
    await actions.startInBrowser();

    actions.createTrack("visual", "Titles");
    actions.createTrack("visual", "Overlay");
    const file = () => readProject()!.file;
    const [overlay, titles] = file().tracks.filter((track) => track.kind === "visual");
    const made = actions.createClip(titles!.id, {
      kind: "text",
      from: 0,
      durationInFrames: 30,
      approval: "accepted",
      text: "Hello",
      fontSize: 0.09,
      fontFamily: "display",
      fontWeight: 600,
      color: "#F7F8F8",
      align: "center",
      lineHeight: 1.1,
      letterSpacing: -0.02,
      reveal: "none",
      revealFrames: 30,
      caret: false,
      box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
      animation: { enter: "none", exit: "none", enterFrames: 12, exitFrames: 12 },
      motion: { x: 0, y: 0, scale: 1, frames: 0, delay: 0, easing: "out", press: false },
    });
    expect(made.ok, made.message).toBe(true);
    const clipId = file().tracks.flatMap((track) => track.clips)[0]!.id;

    const styled = actions.patchClip(clipId, { fontFamily: "mono", align: "left", letterSpacing: 0.04 }, "agent", "mono, left");
    expect(styled.ok, styled.message).toBe(true);

    const moved = actions.patchClip(clipId, { trackId: overlay!.id, from: 12 }, "agent", "onto the overlay");
    expect(moved.ok, moved.message).toBe(true);
    const after = file().tracks.find((track) => track.id === overlay!.id)!;
    expect(after.clips.map((clip) => [clip.id, clip.from])).toEqual([[clipId, 12]]);
    const patched = after.clips[0]!;
    expect(patched.kind === "text" && patched.fontFamily).toBe("mono");

    // Audio cannot land on a visual layer, and it says so.
    actions.createTrack("audio", "Music");
    const audioTrack = file().tracks.find((track) => track.kind === "audio")!;
    const bed = actions.createClip(audioTrack.id, {
      kind: "audio",
      from: 0,
      durationInFrames: 30,
      approval: "accepted",
      src: "library/audio/bed-calm.mp3",
      startFrom: 0,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      playbackRate: 1,
    });
    expect(bed.ok, bed.message).toBe(true);
    const bedId = audioTrack ? file().tracks.find((track) => track.kind === "audio")!.clips[0]!.id : "";
    const refused = actions.patchClip(bedId, { trackId: overlay!.id }, "agent", "no");
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/audio stays on audio/);
  });
});
