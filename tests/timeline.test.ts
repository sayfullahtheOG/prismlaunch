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
