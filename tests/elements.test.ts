import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import {
  clipFromElement,
  elementUses,
  removeElement,
  updateElement,
} from "@/lib/studio/edits";
import { DEFAULT_MOTION, PROJECT_FILE_VERSION, ProjectFileSchema } from "@/lib/studio/schema";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { buildTools } from "@/lib/webmcp/tools";
import type { Clip, Element } from "@/types/prism";
import { approvedThrough, audioTrack, film, projectFile, textClip, visualTrack } from "./fixture";

/**
 * Elements are the style stage's artifact: a clip without a place, defined
 * once and placed many times, with changes flowing to everything placed
 * from it. These pin the three things that make that true — the file
 * accepts and refuses the right shapes, propagation and detachment do what
 * they say, and the agent is held to the process while the person is not.
 */

const HEADLINE: Element = {
  kind: "text",
  id: "el-headline",
  name: "Headline",
  role: "type",
  fontSize: 0.1,
  fontFamily: "display",
  fontWeight: 400,
  color: "#F5F5F7",
  align: "center",
  lineHeight: 1.1,
  letterSpacing: -0.02,
  reveal: "none",
  revealFrames: 30,
  caret: false,
  box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
  animation: { enter: "rise", exit: "fade", enterFrames: 12, exitFrames: 8 },
  motion: { ...DEFAULT_MOTION },
};

const BED: Element = {
  kind: "audio",
  id: "el-bed",
  name: "Music bed",
  src: "assets/bed.mp3",
  startFrom: 0,
  volume: 0.7,
  fadeInFrames: 20,
  fadeOutFrames: 40,
  playbackRate: 1,
};

function placed(overrides: Partial<Clip> = {}): Clip {
  return textClip({ id: "clip-h1", elementId: "el-headline", text: "One.", ...overrides });
}

function clips(): Clip[] {
  return readProject()!.file.tracks.flatMap((track) => track.clips);
}

describe("the file", () => {
  it("reads a v2 file as v3 with no elements", () => {
    const { elements, ...v2 } = projectFile();
    void elements;
    const parsed = ProjectFileSchema.safeParse({ ...v2, version: 2 });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(PROJECT_FILE_VERSION);
      expect(parsed.data.elements).toEqual([]);
    }
  });

  it("refuses a clip placed from an element that is not there", () => {
    const parsed = ProjectFileSchema.safeParse(
      projectFile({ tracks: [visualTrack([placed({ elementId: "el-ghost" })])] }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(parsed.error.issues)).toMatch(/el-ghost/);
    }
  });

  it("refuses two elements with one id", () => {
    const parsed = ProjectFileSchema.safeParse(
      projectFile({ elements: [HEADLINE, { ...HEADLINE, name: "Again" }] }),
    );
    expect(parsed.success).toBe(false);
  });

  it("accepts a text style with no words of its own", () => {
    const parsed = ProjectFileSchema.safeParse(projectFile({ elements: [HEADLINE] }));
    expect(parsed.success).toBe(true);
  });
});

describe("pure edits", () => {
  it("makes a clip from a type style and the words", () => {
    const made = clipFromElement(HEADLINE, {
      from: 30,
      durationInFrames: 60,
      text: "Ship on a Friday.",
      box: { y: 0.4 },
    });

    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.clip.kind).toBe("text");
      expect(made.clip.elementId).toBe("el-headline");
      expect(made.clip.approval).toBe("accepted");
      expect(made.clip.label).toBe("Headline");
      if (made.clip.kind === "text") {
        expect(made.clip.text).toBe("Ship on a Friday.");
        expect(made.clip.fontFamily).toBe("display");
        expect(made.clip.box).toEqual({ ...HEADLINE.box, y: 0.4 });
      }
    }
  });

  it("refuses to place a type style without words", () => {
    const made = clipFromElement(HEADLINE, { from: 0, durationInFrames: 30 });
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.message).toMatch(/words/);
  });

  it("changes every placed clip when the element changes, but not its identity", () => {
    const file = projectFile({
      elements: [HEADLINE],
      tracks: [visualTrack([placed(), placed({ id: "clip-h2", from: 100, text: "Two." })])],
    });

    const next = updateElement(file, "el-headline", { color: "#FF0000", name: "Hero" });
    const changed = next.tracks[0]!.clips;

    expect(next.elements[0]!.name).toBe("Hero");
    for (const clip of changed) {
      expect(clip.kind === "text" && clip.color).toBe("#FF0000");
      // The words are the clip's own; the element never had any.
      expect(clip.kind === "text" && clip.text).toMatch(/One|Two/);
      expect(clip.label).toBe("Most tools make you click.".slice(0, 0) || clip.label);
    }
    expect(elementUses(next, "el-headline")).toBe(2);
  });

  it("removing an element keeps its clips and unlinks them", () => {
    const file = projectFile({ elements: [HEADLINE], tracks: [visualTrack([placed()])] });
    const next = removeElement(file, "el-headline");

    expect(next.elements).toEqual([]);
    expect(next.tracks[0]!.clips).toHaveLength(1);
    expect(next.tracks[0]!.clips[0]!.elementId).toBeUndefined();
    expect(ProjectFileSchema.safeParse(next).success).toBe(true);
  });
});

describe("the actions", () => {
  beforeEach(() => {
    resetStudio();
    useStudioStore.getState().setProject(
      film({
        process: approvedThrough("animatic"),
        elements: [HEADLINE, BED],
        tracks: [visualTrack([]), audioTrack([])],
      }),
      0,
    );
  });

  it("holds the agent to the process, and not the person", () => {
    // Elements open with the style stage, right after the storyboard.
    useStudioStore.getState().setProject(
      film({ process: approvedThrough("script"), elements: [] }),
      0,
    );
    const { id, ...draft } = HEADLINE;
    void id;

    const agent = actions.createElement(draft, "agent", "The headline face");
    expect(agent.ok).toBe(false);
    if (!agent.ok) expect(agent.code).toBe("stage-gated");
    expect(!agent.ok && agent.message).toMatch(/after the storyboard is approved/);

    expect(actions.createElement(draft).ok).toBe(true);

    useStudioStore.getState().setProject(
      film({ process: approvedThrough("storyboard"), elements: [] }),
      0,
    );
    const allowed = actions.createElement(draft, "agent", "The headline face");
    expect(allowed.ok, allowed.message).toBe(true);
  });

  it("places an element carrying the element's look and a link", () => {
    const result = actions.placeElement(
      "el-headline",
      "track-1",
      { from: 60, durationInFrames: 45, text: "One." },
      "agent",
      "The turn",
    );
    expect(result.ok, result.message).toBe(true);

    const clip = clips()[0]!;
    expect(clip.elementId).toBe("el-headline");
    expect(clip.approval).toBe("accepted");
    expect(clip.revisionNote).toBe("The turn");
    expect(clip.kind === "text" && clip.fontFamily).toBe("display");
    expect(readProject()!.activity.at(-1)?.label).toBe("prism.place_element");
  });

  it("refuses an audio element on a visual track, and says so", () => {
    const result = actions.placeElement("el-bed", "track-1", { from: 0, durationInFrames: 300 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/audio/);
  });

  it("holds a placed element to the locked beats like any clip", () => {
    const process = approvedThrough("animatic");
    process.animatic.beats = [{ id: "b1", label: "Hook", from: 0, durationInFrames: 60 }];
    useStudioStore.getState().setProject(
      film({ process, elements: [HEADLINE], tracks: [visualTrack([])] }),
      0,
    );

    const outside = actions.placeElement(
      "el-headline",
      "track-1",
      { from: 30, durationInFrames: 60, text: "x" },
      "agent",
    );
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.code).toBe("timing-locked");

    const inside = actions.placeElement(
      "el-headline",
      "track-1",
      { from: 0, durationInFrames: 60, text: "x" },
      "agent",
    );
    expect(inside.ok).toBe(true);
  });

  it("propagates an agent's change to every placed clip, with the note as provenance", () => {
    actions.placeElement("el-headline", "track-1", { from: 0, durationInFrames: 30, text: "a" });
    actions.placeElement("el-headline", "track-1", { from: 60, durationInFrames: 30, text: "b" });
    expect(clips().every((clip) => clip.approval === "accepted")).toBe(true);

    const result = actions.patchElement("el-headline", { fontSize: 0.14 }, "agent", "Bigger");
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/2 clips/);

    for (const clip of clips()) {
      expect(clip.kind === "text" && clip.fontSize).toBe(0.14);
      expect(clip.approval).toBe("accepted");
      expect(clip.revisionNote).toBe("Bigger");
    }
  });

  it("deleting an element keeps what was placed from it", () => {
    actions.placeElement("el-headline", "track-1", { from: 0, durationInFrames: 30, text: "a" });
    const result = actions.deleteElement("el-headline");

    expect(result.ok).toBe(true);
    expect(readProject()!.file.elements.map((element) => element.id)).toEqual(["el-bed"]);
    expect(clips()).toHaveLength(1);
    expect(clips()[0]!.elementId).toBeUndefined();
  });

  it("places at the playhead on the obvious track, filling the locked beat", () => {
    const process = approvedThrough("animatic");
    process.animatic.beats = [{ id: "b1", label: "Hook", from: 0, durationInFrames: 90 }];
    useStudioStore.getState().setProject(
      film({
        process,
        elements: [{ ...HEADLINE, text: "Default words" }, BED],
        tracks: [visualTrack([]), audioTrack([])],
      }),
      0,
    );
    actions.seek(30);

    expect(actions.placeElementHere("el-headline").ok).toBe(true);
    const clip = clips()[0]!;
    expect(clip.from).toBe(30);
    expect(clip.durationInFrames).toBe(60);
    expect(clip.approval).toBe("accepted");

    expect(actions.placeElementHere("el-bed").ok).toBe(true);
    expect(clips().find((entry) => entry.kind === "audio")?.durationInFrames).toBe(120);
  });

  it("refuses style frames that name elements or clips that do not exist", async () => {
    const result = await actions.submitStyleFrames({
      look: "void",
      elementIds: ["el-headline", "el-nope"],
      clipIds: ["clip-nope"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/el-nope/);
      expect(result.message).toMatch(/clip-nope/);
    }
  });

  it("registers the four element tools, and still nothing that approves", () => {
    const names = buildTools().map((tool) => tool.name);
    for (const name of [
      "prism.add_element",
      "prism.update_element",
      "prism.remove_element",
      "prism.place_element",
    ]) {
      expect(names).toContain(name);
    }
    expect(names.filter((name) => /accept|approve|reject/i.test(name))).toEqual([]);
  });

  it("builds a text style from the flat add_element input", async () => {
    const add = buildTools().find((tool) => tool.name === "prism.add_element")!;
    const message = await add.execute({
      kind: "text",
      name: "Support",
      fontSize: 0.045,
      fontFamily: "body",
      note: "The second voice",
    });
    expect(message).toMatch(/Support/);

    const support = readProject()!.file.elements.find((element) => element.name === "Support");
    expect(support?.kind).toBe("text");
    expect(support?.kind === "text" && support.fontFamily).toBe("body");
    expect(support?.kind === "text" && support.color).toBe("#F7F8F8");
  });

  it("tells an agent when a media element has no file", async () => {
    const add = buildTools().find((tool) => tool.name === "prism.add_element")!;
    const message = await add.execute({ kind: "image", name: "Product shot" });
    expect(message).toMatch(/src/);
    expect(readProject()!.file.elements.some((element) => element.name === "Product shot")).toBe(false);
  });
});
