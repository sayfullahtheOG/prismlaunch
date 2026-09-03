import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { buildTools } from "@/lib/webmcp/tools";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import type { Clip, FilmProject } from "@/types/prism";
import { film } from "./fixture";

/**
 * These tests exist mostly to pin the approval boundary.
 *
 * The product's central claim is that an agent proposes and a human disposes.
 * That claim is only worth making if it is enforced by the shape of the code,
 * so the most important assertion in this file is the one that walks the
 * registered tool surface and confirms an agent has no function to call.
 *
 * The store is seeded directly rather than through `openProject`, which reads a
 * real folder there is none of in a test runner. No workspace is linked, so
 * `persistNow` returns early and nothing touches a disk — which is what we
 * want: this file is about the rules, not the filesystem.
 */

beforeEach(() => {
  resetStudio();
  useStudioStore.getState().setProject(film(), 0);
});

function current(): FilmProject {
  const project = readProject();
  if (!project) throw new Error("expected a seeded project");
  return project;
}

function clips(): Clip[] {
  return current().file.tracks.flatMap((track) => track.clips);
}

const AGENT_TEXT: Omit<Clip, "id"> = {
  kind: "text",
  from: 160,
  durationInFrames: 60,
  approval: "draft",
  text: "Ship on a Friday.",
  fontSize: 0.12,
  fontFamily: "display",
  fontWeight: 600,
  color: "#FFFFFF",
  align: "center",
  lineHeight: 1.1,
  letterSpacing: -0.02,
  box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
  animation: { enter: "rise", exit: "fade", enterFrames: 10, exitFrames: 10 },
} as Omit<Clip, "id">;

describe("the approval boundary", () => {
  it("keeps the human-only actions available to the UI", () => {
    const surface = Object.keys(actions);
    expect(surface).toContain("acceptClip");
    expect(surface).toContain("rejectClip");
    expect(surface).toContain("acceptAllDrafts");
    expect(surface).toContain("approveRender");
  });

  /**
   * The load-bearing assertion in this file.
   *
   * The claim is that an agent proposes and a human disposes. That is only true
   * if the agent has no *tool* for accepting a draft or approving a render —
   * the actions exist for the UI, but must never be exposed. This walks the
   * real registered tool surface rather than trusting a comment.
   */
  it("registers no tool that can accept a draft or approve a render", () => {
    const names = buildTools().map((registered) => registered.name);

    expect(names).toContain("prism.add_text");
    expect(names).toContain("prism.request_render");
    expect(names).toContain("prism.confirm_render");

    const forbidden = names.filter((name) =>
      /accept|approve|reject|publish|share/i.test(name),
    );
    expect(forbidden).toEqual([]);
  });

  it("gives every tool a schema, a description, and its own validation", async () => {
    for (const registered of buildTools()) {
      expect(registered.description.length).toBeGreaterThan(40);
      expect(registered.inputSchema?.type).toBe("object");

      // Chrome validates nothing, so garbage must come back as a corrective
      // message rather than an exception. A tool whose every field is
      // optional accepts garbage by ignoring it, which is also correct — the
      // one that waits is told not to wait long.
      const result = await registered.execute({ nonsense: true, timeoutSeconds: 1 } as never);
      expect(typeof result).toBe("string");
    }
  });

  it("lands an agent's clip accepted, with the note kept as provenance", () => {
    const result = actions.createClip("track-1", AGENT_TEXT, "agent", "The payoff");
    expect(result.ok).toBe(true);

    const added = clips().find((clip) => clip.revisionNote === "The payoff");
    expect(added).toBeDefined();
    // The approval boundary is the stage, not the clip.
    expect(added!.approval).toBe("accepted");
  });

  it("keeps a clip accepted when an agent changes it, noting why", () => {
    actions.patchClip("clip-a", { from: 10 }, "agent", "Nudged it later");
    const clip = clips().find((entry) => entry.id === "clip-a")!;
    expect(clip.approval).toBe("accepted");
    expect(clip.revisionNote).toBe("Nudged it later");
  });

  it("does not create a draft when a person edits their own film", () => {
    actions.patchClip("clip-a", { from: 10 });
    expect(clips().find((entry) => entry.id === "clip-a")!.approval).toBe(
      "accepted",
    );
  });

  it("still settles a legacy draft from an older film", () => {
    // No action writes "draft" any more, but a film saved before the stage
    // became the approval boundary may carry them. The human-only actions
    // still clear them.
    const store = useStudioStore.getState();
    const project = readProject()!;
    const legacy = structuredClone(project.file);
    const track = legacy.tracks.find((entry) => entry.kind === "visual")!;
    track.clips = track.clips.map((clip, index) =>
      index === 0 ? { ...clip, approval: "draft" as const, revisionNote: "old" } : clip,
    );
    store.setProject({ ...project, file: legacy }, 0);

    const draft = clips().find((clip) => clip.approval === "draft")!;
    expect(actions.acceptClip(draft.id).ok).toBe(true);
    const settled = clips().find((clip) => clip.id === draft.id)!;
    expect(settled.approval).toBe("accepted");
    expect(settled.revisionNote).toBeUndefined();

    // Nothing pending: resolving again says so.
    const again = actions.acceptClip(draft.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("no-draft");
  });

  it("renders regardless of clip approval; the stages and the confirmation are the gate", async () => {
    const { snapshotAccepted } = await import("@/lib/render/job");
    const file = structuredClone(readProject()!.file);
    file.tracks[0]!.clips = file.tracks[0]!.clips.map((clip) => ({
      ...clip,
      approval: "draft" as const,
    }));
    expect(snapshotAccepted(file)).not.toBeNull();
  });
});

describe("locked tracks", () => {
  it("refuse every edit, including from an agent", () => {
    actions.patchTrack("track-1", { locked: true });

    const added = actions.createClip("track-1", AGENT_TEXT, "agent", "nope");
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.code).toBe("locked");

    const moved = actions.dragClip("clip-a", "track-1", 30);
    expect(moved.ok).toBe(false);
  });

  /** Otherwise locking a track would be a one-way door. */
  it("can always be unlocked", () => {
    actions.patchTrack("track-1", { locked: true });
    expect(actions.patchTrack("track-1", { locked: false }).ok).toBe(true);
    expect(current().file.tracks[0]!.locked).toBe(false);
  });
});

describe("tracks", () => {
  it("adds a visual layer at the front and an audio layer at the back", () => {
    actions.createTrack("visual", "Overlay");
    expect(current().file.tracks[0]!.name).toBe("Overlay");

    actions.createTrack("audio", "Voiceover");
    const tracks = current().file.tracks;
    expect(tracks[tracks.length - 1]!.name).toBe("Voiceover");
  });

  it("deletes a layer and everything on it", () => {
    expect(actions.deleteTrack("track-1").ok).toBe(true);
    expect(clips().some((clip) => clip.id === "clip-a")).toBe(false);
  });
});

describe("clips", () => {
  it("rejects an edit that would break the schema, leaving the film untouched", () => {
    const before = clips().find((clip) => clip.id === "clip-a")!.durationInFrames;

    const result = actions.patchClip("clip-a", { durationInFrames: -5 });
    expect(result.ok).toBe(false);

    expect(clips().find((clip) => clip.id === "clip-a")!.durationInFrames).toBe(
      before,
    );
  });

  it("splits the selected clip at the playhead", () => {
    actions.select("clip-a");
    actions.seek(30);

    expect(actions.splitAtPlayhead().ok).toBe(true);
    expect(clips().filter((clip) => clip.kind === "text").length).toBe(3);
  });

  it("refuses to split when the playhead is outside the clip", () => {
    actions.select("clip-a");
    actions.seek(200);

    const result = actions.splitAtPlayhead();
    expect(result.ok).toBe(false);
  });
});

describe("the composition", () => {
  it("grows to fit a clip placed past the end", () => {
    actions.patchClip("clip-b", { from: 290, durationInFrames: 60 });
    expect(current().file.durationInFrames).toBe(350);
  });

  it("clamps the playhead to the composition's last frame", () => {
    actions.seek(99999);
    expect(useStudioStore.getState().playhead).toBe(
      current().file.durationInFrames - 1,
    );
  });
});

describe("getProjectContext", () => {
  it("summarises the composition for an agent", () => {
    const { composition } = actions.getProjectContext();
    expect(composition).not.toBeNull();
    expect(composition!.tracks).toHaveLength(2);
    expect(composition!.path).toBe(".prismlaunch/vector-launch/project.json");
    expect(composition!.tracks[0]!.clips[0]).toHaveProperty("endsAtFrame");
  });

  /**
   * An agent's first call is almost always this one, and it will usually be
   * made before anyone has clicked anything. It has to explain the gesture it
   * cannot perform itself rather than returning an empty object.
   */
  it("explains what the person must click when no folder is linked", () => {
    resetStudio();
    const context = actions.getProjectContext();
    expect(context.composition).toBeNull();
    expect(context.workspace.linked).toBe(false);
    expect(context.workspace.reason).toMatch(/link project folder/i);
  });
});
