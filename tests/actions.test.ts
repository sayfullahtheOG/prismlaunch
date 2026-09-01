import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { readProject, resetStudio } from "@/lib/studio/store";

/**
 * These tests exist mostly to pin the approval boundary.
 *
 * The product's central claim is that an agent proposes and a human disposes.
 * That claim is only worth making if it is enforced by the shape of the code,
 * so the most important assertion in this file is the one that walks the
 * module's public surface and confirms an agent has no function to call.
 */

beforeEach(() => {
  resetStudio();
});

const DRAFT = "scene-03" as const;
const ACCEPTED = "scene-01" as const;

describe("the approval boundary", () => {
  it("exposes no action that sets approval directly", () => {
    const surface = Object.keys(actions);

    // acceptDraft/keepCurrent exist, but they are human-only and are never
    // wrapped as WebMCP tools. Nothing else may touch approval at all.
    expect(surface).toContain("acceptDraft");
    expect(surface).toContain("keepCurrent");

    const suspicious = surface.filter(
      (name) =>
        /approve|accept|publish|render|export/i.test(name) &&
        !["acceptDraft"].includes(name),
    );
    expect(suspicious).toEqual([]);
  });

  it("agent revisions always land as a draft", () => {
    const result = actions.reviseSceneDraft(
      ACCEPTED,
      { headline: "A sharper hook" },
      "Tightened the hook",
    );

    expect(result.ok).toBe(true);
    const scene = readProject().scenes.find((s) => s.id === ACCEPTED)!;
    expect(scene.approval).toBe("draft");
    expect(scene.revisionNote).toBe("Tightened the hook");
  });

  it("records the replaced headline so the diff is showable", () => {
    const before = readProject().scenes.find((s) => s.id === ACCEPTED)!.headline;
    actions.reviseSceneDraft(ACCEPTED, { headline: "A sharper hook" }, "note");

    const scene = readProject().scenes.find((s) => s.id === ACCEPTED)!;
    expect(scene.previousHeadline).toBe(before);
    expect(scene.headline).toBe("A sharper hook");
  });

  it("accepting a draft keeps the agent's text and clears the draft state", () => {
    const drafted = readProject().scenes.find((s) => s.id === DRAFT)!.headline;

    expect(actions.acceptDraft(DRAFT).ok).toBe(true);

    const scene = readProject().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.headline).toBe(drafted);
    expect(scene.revisionNote).toBeUndefined();
    expect(scene.previousHeadline).toBeUndefined();
  });

  it("keeping current restores the headline the agent replaced", () => {
    const original = readProject().scenes.find((s) => s.id === DRAFT)!
      .previousHeadline;
    expect(original).toBeDefined();

    expect(actions.keepCurrent(DRAFT).ok).toBe(true);

    const scene = readProject().scenes.find((s) => s.id === DRAFT)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.headline).toBe(original);
  });

  it("refuses to resolve a scene with no pending draft", () => {
    const result = actions.acceptDraft(ACCEPTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("no-draft");
  });

  it("clears the blocked render proposal once the human answers", () => {
    expect(readProject().activity.some((e) => e.blocked)).toBe(true);
    actions.acceptDraft(DRAFT);
    expect(readProject().activity.some((e) => e.blocked)).toBe(false);
  });
});

describe("human edits", () => {
  it("do not change approval state", () => {
    actions.updateScene(ACCEPTED, { headline: "Directly edited" });
    const scene = readProject().scenes.find((s) => s.id === ACCEPTED)!;
    expect(scene.approval).toBe("accepted");
    expect(scene.revisionNote).toBeUndefined();
  });

  it("reject an over-length headline with a corrective message", () => {
    const result = actions.updateScene(ACCEPTED, {
      headline: "x".repeat(80),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-input");
      expect(result.message).toMatch(/headline/i);
    }
  });

  it("leave the board untouched when validation fails", () => {
    const before = readProject().scenes.find((s) => s.id === ACCEPTED)!.headline;
    actions.updateScene(ACCEPTED, { headline: "x".repeat(80) });
    expect(readProject().scenes.find((s) => s.id === ACCEPTED)!.headline).toBe(
      before,
    );
  });

  it("reject an unknown componentId and list what is available", () => {
    const result = actions.updateScene(DRAFT, { componentId: "cmp-nope" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown-component");
      expect(result.message).toContain("cmp-command-palette");
    }
  });

  it("report a no-op rather than writing an empty activity event", () => {
    const scene = readProject().scenes.find((s) => s.id === ACCEPTED)!;
    const before = readProject().activity.length;

    const result = actions.updateScene(ACCEPTED, { headline: scene.headline });

    expect(result.ok).toBe(true);
    expect(readProject().activity.length).toBe(before);
  });
});

describe("focusScene", () => {
  it("moves the active scene and reports its headline", () => {
    const result = actions.focusScene("scene-02");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toContain("Vector");
    expect(readProject().activeSceneId).toBe("scene-02");
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
    expect(readProject().brief.artDirection).toBe("warm-playful");
  });

  it("rejects an unknown direction and lists the real ones", () => {
    const result = actions.setArtDirection("neon-brutalist" as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("minimal-dark");
  });
});

describe("getProjectContext", () => {
  it("summarises the board for an agent", () => {
    const context = actions.getProjectContext();
    expect(context.scenes).toHaveLength(4);
    expect(context.pendingDraftSceneId).toBe(DRAFT);
    expect(context.candidates.length).toBeGreaterThan(0);
  });

  it("never leaks raw source snippets", () => {
    // Evidence text is untrusted. It belongs behind a tool annotated with
    // untrustedContentHint, not in a general context dump.
    const serialised = JSON.stringify(actions.getProjectContext());
    expect(serialised).not.toContain("export function CommandPalette");
    expect(serialised).not.toContain("snippet");
  });
});
