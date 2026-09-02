import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { buildTools } from "@/lib/webmcp/tools";
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
  it("keeps the human-only actions available to the UI", () => {
    const surface = Object.keys(actions);
    expect(surface).toContain("acceptDraft");
    expect(surface).toContain("keepCurrent");
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

    expect(names).toContain("prism.revise_scene_draft");
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
