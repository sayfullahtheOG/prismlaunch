import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { buildTools } from "@/lib/webmcp/tools";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import type { FilmProject } from "@/types/prism";
import { film } from "./fixture";

/**
 * These tests exist mostly to pin the approval boundary.
 *
 * The product's central claim is that an agent proposes and a human disposes.
 * That claim is only worth making if it is enforced by the shape of the code,
 * so the most important assertion in this file is the one that walks the
 * registered tool surface and confirms an agent has no function to call.
 *
 * The store is seeded directly here rather than through `openProject`, because
 * that reads a real folder and there is none in a test runner. No workspace is
 * linked, so `persistNow` returns early and nothing touches a disk — which is
 * what we want: this file is about the rules, not the filesystem.
 */

const DRAFT = "scene-03" as const;
const ACCEPTED = "scene-01" as const;

beforeEach(async () => {
  resetStudio();
  useStudioStore.getState().setProject(film(), 0);
  await actions.reviseSceneDraft(
    DRAFT,
    { headline: "The palette knows what you meant." },
    "Sharpened the proof line",
  );
});

/** The project, asserted to exist — every test seeds one in `beforeEach`. */
function current(): FilmProject {
  const project = readProject();
  if (!project) throw new Error("expected a seeded project");
  return project;
}

describe("the approval boundary", () => {
  it("keeps the human-only actions available to the UI", () => {
    const surface = Object.keys(actions);
    expect(surface).toContain("acceptDraft");
    expect(surface).toContain("keepCurrent");
    expect(surface).toContain("acceptAllDrafts");
    expect(surface).toContain("approveRender");
  });

  /**
   * The load-bearing assertion in this file.
   *
   * The claim is that an agent proposes and a human disposes. That is only
   * true if the agent has no *tool* for accepting a draft or approving a
   * render — the actions exist for the UI, but must never be exposed. This
   * walks the real registered tool surface rather than trusting a comment.
   */
  it("registers no tool that can accept a draft or approve a render", () => {
    const names = buildTools().map((registered) => registered.name);

    expect(names).toContain("prism.write_storyboard");
    expect(names).toContain("prism.request_render");
    expect(names).toContain("prism.confirm_render");

    const forbidden = names.filter((name) =>
      /accept|approve|keep_current|publish|share/i.test(name),
    );
    expect(forbidden).toEqual([]);
  });

  it("gives every tool a schema, a description, and its own validation", async () => {
    for (const registered of buildTools()) {
      expect(registered.description.length).toBeGreaterThan(40);
      expect(registered.inputSchema?.type).toBe("object");

      // Chrome validates nothing, so garbage must come back as a corrective
      // message rather than an exception.
      const result = await registered.execute({ nonsense: true } as never);
      expect(typeof result).toBe("string");
    }
  });

  it("agent revisions always land as a draft", () => {
    const scene = current().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.approval).toBe("draft");
    expect(scene.revisionNote).toBe("Sharpened the proof line");
  });

  it("records the replaced headline so the diff is showable", () => {
    const scene = current().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.previousHeadline).toBe("Meet the command palette.");
    expect(scene.headline).toBe("The palette knows what you meant.");
  });

  it("accepting a draft keeps the agent's text and clears the draft state", () => {
    const drafted = current().scenes.find((s) => s.id === DRAFT)!.headline;

    expect(actions.acceptDraft(DRAFT).ok).toBe(true);

    const scene = current().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.headline).toBe(drafted);
    expect(scene.revisionNote).toBeUndefined();
    expect(scene.previousHeadline).toBeUndefined();
  });

  it("keeping current restores the headline the agent replaced", () => {
    const original = current().scenes.find((s) => s.id === DRAFT)!
      .previousHeadline;
    expect(original).toBeDefined();

    expect(actions.keepCurrent(DRAFT).ok).toBe(true);

    const scene = current().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.headline).toBe(original);
  });

  it("refuses to resolve a scene with no pending draft", () => {
    const result = actions.acceptDraft(ACCEPTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("no-draft");
  });

  it("blocks a render while any scene is still a draft", async () => {
    const result = await actions.requestRender("Looks good to me");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-input");
      expect(result.message).toMatch(/unreviewed draft/i);
    }
  });
});

describe("writeStoryboard", () => {
  type Four = Parameters<typeof actions.writeStoryboard>[0];

  const four: Four = [
    {
      headline: "Shipping is the slow part.",
      durationFrames: 84,
      motionPreset: "drift",
      emphasis: "problem",
    },
    {
      headline: "Beacon",
      durationFrames: 108,
      motionPreset: "snap",
      emphasis: "product",
    },
    {
      headline: "One command, every environment.",
      durationFrames: 132,
      motionPreset: "drift",
      emphasis: "feature",
      feature: { label: "Deploy", visualTokens: ["staging", "production"] },
    },
    {
      headline: "Ship on a Friday.",
      durationFrames: 108,
      motionPreset: "snap",
      emphasis: "outcome",
    },
  ];

  /** The same board, re-timed so the four no longer add up. */
  function retimed(durationFrames: number): Four {
    const [a, b, c, d] = four;
    return [
      { ...a, durationFrames },
      { ...b, durationFrames },
      { ...c, durationFrames },
      { ...d, durationFrames },
    ];
  }

  it("writes all four scenes as drafts", async () => {
    const result = await actions.writeStoryboard(four, "First pass");
    expect(result.ok).toBe(true);

    const scenes = current().scenes;
    expect(scenes.map((s) => s.headline)).toEqual(four.map((s) => s.headline));
    expect(scenes.every((s) => s.approval === "draft")).toBe(true);
  });

  it("keeps the fixed template order regardless of what the agent sends", async () => {
    await actions.writeStoryboard(four);
    expect(current().scenes.map((s) => s.template)).toEqual([
      "kinetic-type",
      "product-reveal",
      "feature-spotlight",
      "outcome-cta",
    ]);
  });

  it("rejects a board that falls outside the 16–22s window", async () => {
    const result = await actions.writeStoryboard(retimed(72));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("graph-invalid");
      expect(result.message).toMatch(/16–22s/);
    }
  });

  it("leaves the board untouched when the graph is rejected", async () => {
    const before = current().scenes.map((s) => s.headline);
    await actions.writeStoryboard(retimed(72));
    expect(current().scenes.map((s) => s.headline)).toEqual(before);
  });
});

describe("human edits", () => {
  it("do not change approval state", () => {
    actions.updateScene(ACCEPTED, { headline: "Directly edited" });
    const scene = current().scenes.find((s) => s.id === ACCEPTED)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.revisionNote).toBeUndefined();
  });

  it("reject an over-length headline with a corrective message", () => {
    const result = actions.updateScene(ACCEPTED, { headline: "x".repeat(80) });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-input");
      expect(result.message).toMatch(/headline/i);
    }
  });

  it("leave the board untouched when validation fails", () => {
    const before = current().scenes.find((s) => s.id === ACCEPTED)!.headline;
    actions.updateScene(ACCEPTED, { headline: "x".repeat(80) });
    expect(current().scenes.find((s) => s.id === ACCEPTED)!.headline).toBe(
      before,
    );
  });

  it("report a no-op rather than writing an empty activity event", () => {
    const before = current().activity.length;
    const result = actions.updateScene(ACCEPTED, {});

    expect(result.ok).toBe(true);
    expect(current().activity.length).toBe(before);
  });

  it("accept every draft at once when asked", () => {
    actions.updateScene(ACCEPTED, { headline: "Still accepted" });
    expect(actions.acceptAllDrafts().ok).toBe(true);
    expect(current().scenes.every((s) => s.approval === "accepted")).toBe(true);
  });
});

describe("focusScene", () => {
  it("moves the active scene and reports its headline", () => {
    const result = actions.focusScene("scene-02");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toContain("Vector");
    expect(current().activeSceneId).toBe("scene-02");
  });

  it("rejects an unknown scene id", () => {
    // Deliberately bypassing the type — this is exactly what arrives from an
    // agent, since Chrome validates nothing against inputSchema.
    const result = actions.focusScene("scene-99" as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown-scene");
  });
});

describe("setArtDirection", () => {
  it("switches the whole film", () => {
    expect(actions.setArtDirection("warm-playful").ok).toBe(true);
    expect(current().brief.artDirection).toBe("warm-playful");
  });

  it("rejects an unknown direction and lists the real ones", () => {
    const result = actions.setArtDirection("neon-brutalist" as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("minimal-dark");
  });
});

describe("getProjectContext", () => {
  it("summarises the board for an agent", () => {
    const { film: summary } = actions.getProjectContext();
    expect(summary).not.toBeNull();
    expect(summary!.scenes).toHaveLength(4);
    expect(summary!.pendingDraftSceneIds).toEqual([DRAFT]);
    expect(summary!.path).toBe(".prismlaunch/vector-launch/project.json");
  });

  /**
   * An agent's first call is almost always this one, and it will usually be
   * made before anyone has clicked anything. It has to explain the gesture it
   * cannot perform itself rather than returning an empty object.
   */
  it("explains what the person must click when no folder is linked", () => {
    resetStudio();
    const context = actions.getProjectContext();
    expect(context.film).toBeNull();
    expect(context.workspace.linked).toBe(false);
    expect(context.workspace.reason).toMatch(/link project folder/i);
  });
});
