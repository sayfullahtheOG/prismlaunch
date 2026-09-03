import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import {
  agentMayPlaceClips,
  currentStage,
  fitsLockedBeats,
  nextInstruction,
  snapshotBeats,
  timingLocked,
} from "@/lib/studio/process";
import { EMPTY_PROCESS, ProjectFileSchema, STAGES } from "@/lib/studio/schema";
import { approvedThrough, boardVisual } from "./fixture";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { buildTools } from "@/lib/webmcp/tools";
import type { Clip, FilmProject, Process } from "@/types/prism";
import { film, projectFile, textClip, visualTrack } from "./fixture";

/**
 * The process is the method made structural, and these tests pin the two
 * rules that make it more than a document:
 *
 * 1. An agent cannot reach a later stage — or the timeline — until the person
 *    has approved the earlier ones. The person is never gated.
 * 2. Approving the animatic locks the timing. After that an agent may fill
 *    the beats but not move them.
 *
 * As with the approval boundary in actions.test.ts, the load-bearing checks
 * walk the real tool surface: there must be no tool that approves a stage or
 * reopens a lock.
 */

const AGENT_TEXT: Omit<Clip, "id"> = {
  kind: "text",
  from: 0,
  durationInFrames: 60,
  approval: "draft",
  text: "Six clicks to assign an issue.",
  fontSize: 0.1,
  fontFamily: "display",
  fontWeight: 400,
  color: "#F7F8F8",
  align: "center",
  lineHeight: 1.1,
  letterSpacing: -0.02,
  box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
  animation: { enter: "rise", exit: "fade", enterFrames: 14, exitFrames: 8 },
} as Omit<Clip, "id">;

/** A film whose stages up to `through` are approved, and nothing on the timeline. */
function filmApprovedThrough(through: (typeof STAGES)[number] | null): FilmProject {
  return film({
    process: approvedThrough(through),
    tracks: projectFile().tracks.map((t) => ({ ...t, clips: [] })),
  });
}

function current(): FilmProject {
  const project = readProject();
  if (!project) throw new Error("expected a seeded project");
  return project;
}

beforeEach(() => {
  resetStudio();
});

describe("editing a board by hand", () => {
  beforeEach(() => {
    resetStudio();
    useStudioStore.getState().setProject(
      film({
        process: {
          ...approvedThrough("script"),
          storyboard: { status: "submitted", panels: PANELS },
        },
      }),
      0,
    );
  });

  it("changes one panel and leaves the rest alone", () => {
    const result = actions.patchStoryboardPanel("p1", { durationInFrames: 48, words: "Six clicks." });
    expect(result.ok).toBe(true);

    const panels = readProject()!.file.process.storyboard.panels;
    expect(panels[0]!.durationInFrames).toBe(48);
    expect(panels[0]!.words).toBe("Six clicks.");
    expect(panels[1]).toEqual(PANELS[1]);
  });

  it("refuses a panel that does not exist, and a value the schema rejects", () => {
    expect(actions.patchStoryboardPanel("nope", { label: "x" }).ok).toBe(false);
    const short = actions.patchStoryboardPanel("p1", { durationInFrames: 2 });
    expect(short.ok).toBe(false);
    expect(readProject()!.file.process.storyboard.panels[0]!.durationInFrames).toBe(PANELS[0]!.durationInFrames);
  });

  it("selects a panel by id, like anything else", () => {
    expect(actions.select("p2").ok).toBe(true);
    expect(readProject()!.selection).toEqual({ kind: "panel", id: "p2" });
    expect(actions.select("no-such-thing").ok).toBe(false);
    actions.selectBackground();
    expect(readProject()!.selection).toEqual({ kind: "background" });
  });
});

describe("the file", () => {
  /**
   * The bug that was on screen: a file written by the eight-stage build has a
   * process without `storyboard`, and defaulting only the outer object refused
   * it. Each stage must fill itself in.
   */
  it("opens a project.json whose process predates a stage", () => {
    const file = projectFile();
    const { storyboard: _dropped, ...older } = file.process;
    void _dropped;
    const parsed = ProjectFileSchema.safeParse({ ...file, process: older });

    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues[0])).toBe(true);
    if (parsed.success) {
      expect(parsed.data.process.storyboard.status).toBe("pending");
      expect(parsed.data.process.storyboard.panels).toEqual([]);
    }
  });

  it("opens an older project.json with every stage pending", () => {
    const { process: _dropped, ...withoutProcess } = projectFile();
    void _dropped;
    const parsed = ProjectFileSchema.safeParse(withoutProcess);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(currentStage(parsed.data.process)).toBe("brief");
      expect(timingLocked(parsed.data.process)).toBe(false);
    }
  });
});

describe("the stage order, for agents", () => {
  it("starts at the brief and tells the agent so", () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    const next = nextInstruction(current().file.process);
    expect(next.stage).toBe("brief");
    expect(next.instruction).toMatch(/submit_brief/);
  });

  it("refuses a later stage until the earlier one is approved", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);

    const result = await actions.submitScript(
      { beats: [{ id: "b1", label: "Hook", words: "Six clicks.", seconds: 2.5 }] },
      "jumped ahead",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("stage-gated");
      expect(result.message).toMatch(/Brief/);
    }
  });

  it("accepts a stage in order and marks it submitted", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);

    const result = await actions.submitBrief(
      {
        audience: "Engineers who ship on Friday",
        message: "Assign in one keystroke.",
        feeling: "relief",
        lengthSeconds: 30,
      },
      "One audience, one line.",
    );

    expect(result.ok).toBe(true);
    expect(current().file.process.brief.status).toBe("submitted");
    expect(current().file.process.brief.summary).toBe("One audience, one line.");
    expect(nextInstruction(current().file.process).instruction).toMatch(/END YOUR TURN/);
  });

  it("refuses to resubmit a stage the person already approved", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough("brief"), 0);

    const result = await actions.submitBrief(
      { audience: "x", message: "y", feeling: "z", lengthSeconds: 15 },
      "changed my mind",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/already approved/);
  });

  /**
   * The rule the whole thing exists for: no clips before the script is
   * approved. An agent that skips concept and script and starts placing text
   * is the failure mode the method was written against.
   */
  it("keeps the agent off the timeline until the storyboard is approved", () => {
    useStudioStore.getState().setProject(filmApprovedThrough("script"), 0);
    expect(agentMayPlaceClips(current().file.process)).toBe(false);

    const result = actions.createClip("track-1", AGENT_TEXT, "agent", "eager");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("stage-gated");
      expect(result.message).toMatch(/storyboard is approved/);
    }
  });

  it("lets the agent onto the timeline once the storyboard is approved", () => {
    useStudioStore.getState().setProject(filmApprovedThrough("storyboard"), 0);
    expect(agentMayPlaceClips(current().file.process)).toBe(true);

    const result = actions.createClip("track-1", AGENT_TEXT, "agent", "the hook");
    expect(result.ok).toBe(true);
  });

  it("never gates the person", () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    expect(actions.createClip("track-1", AGENT_TEXT, "human").ok).toBe(true);
  });
});

describe("the animatic and the timing lock", () => {
  it("refuses to submit an empty animatic", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough("storyboard"), 0);
    const result = await actions.submitAnimatic("nothing here");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/timeline is empty/);
  });

  it("wants one placeholder per storyboard panel", async () => {
    const project = filmApprovedThrough("storyboard");
    project.file.process.storyboard.panels = PANELS;
    useStudioStore.getState().setProject(project, 0);
    actions.createClip("track-1", AGENT_TEXT, "agent", "hook");

    const result = await actions.submitAnimatic("only one");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/3 panels.*1 visual clip/);
  });

  it("snapshots every visual clip as a beat on approval", () => {
    const project = filmApprovedThrough("storyboard");
    project.file.tracks[0]!.clips = [
      textClip({ id: "hook", from: 0, durationInFrames: 60, label: "Hook" }),
      textClip({ id: "reveal", from: 90, durationInFrames: 90, label: "Reveal" }),
    ];
    useStudioStore.getState().setProject(project, 0);

    expect(actions.approveStage("animatic").ok).toBe(true);

    const beats = current().file.process.animatic.beats;
    expect(beats).toHaveLength(2);
    expect(beats[0]).toMatchObject({ label: "Hook", from: 0, durationInFrames: 60 });
    expect(beats[1]).toMatchObject({ label: "Reveal", from: 90, durationInFrames: 90 });
    expect(timingLocked(current().file.process)).toBe(true);
  });

  it("lets an agent fill a section, cross into the next, but not run past the end", () => {
    const project = filmApprovedThrough("storyboard");
    project.file.tracks[0]!.clips = [
      textClip({ id: "hook", from: 0, durationInFrames: 60, label: "Hook" }),
      textClip({ id: "reveal", from: 90, durationInFrames: 90, label: "Reveal" }),
    ];
    // Filling a beat means a second layer: clips on one track cannot overlap,
    // and the placeholder is still on the first one until the build removes it.
    project.file.tracks.unshift(visualTrack([], { id: "track-2", name: "Support" }));
    useStudioStore.getState().setProject(project, 0);
    actions.approveStage("animatic");
    actions.approveStage("style");

    // Inside the Hook window, on the support layer: fine.
    const inside = actions.createClip(
      "track-2",
      { ...AGENT_TEXT, from: 10, durationInFrames: 40 },
      "agent",
      "a sub-line",
    );
    expect(inside.ok).toBe(true);

    // Straddling the cut between the sections: fine — that is an object
    // carrying the cut, which is what the method wants.
    const across = actions.createClip(
      "track-2",
      { ...AGENT_TEXT, from: 50, durationInFrames: 60 },
      "agent",
      "the phone dragging the bar",
    );
    expect(across.ok, across.ok ? "" : across.message).toBe(true);

    // Past the end of the locked film: refused, with the end named.
    const past = actions.createClip(
      "track-2",
      { ...AGENT_TEXT, from: 150, durationInFrames: 60 },
      "agent",
      "sloppy",
    );
    expect(past.ok).toBe(false);
    if (!past.ok) {
      expect(past.code).toBe("timing-locked");
      expect(past.message).toMatch(/ends at frame 180/);
      expect(past.message).toMatch(/Hook 0–60/);
      expect(past.message).toMatch(/reopen the animatic/);
    }
  });

  it("refuses an agent moving a clip out of its beat, but not recolouring it", () => {
    const project = filmApprovedThrough("storyboard");
    project.file.tracks[0]!.clips = [
      textClip({ id: "hook", from: 0, durationInFrames: 60, label: "Hook" }),
    ];
    useStudioStore.getState().setProject(project, 0);
    actions.approveStage("animatic");

    const moved = actions.patchClip("hook", { from: 30 }, "agent", "later");
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.code).toBe("timing-locked");

    const recoloured = actions.patchClip("hook", { color: "#0C50FF" }, "agent", "blue");
    expect(recoloured.ok).toBe(true);
  });

  it("exempts audio from the lock — a music bed spans the film", () => {
    const process = structuredClone(EMPTY_PROCESS) as Process;
    process.animatic.status = "approved";
    process.animatic.beats = [{ id: "b", label: "Hook", from: 0, durationInFrames: 60 }];

    const music: Clip = {
      kind: "audio",
      id: "bed",
      from: 0,
      durationInFrames: 900,
      approval: "draft",
      src: "assets/bed.mp3",
      startFrom: 12,
      volume: 0.75,
      fadeInFrames: 4,
      fadeOutFrames: 45,
      playbackRate: 1,
    };
    expect(fitsLockedBeats(process, music)).toBe(true);
  });

  it("unlocks when the person reopens the animatic", () => {
    const project = filmApprovedThrough("storyboard");
    project.file.tracks[0]!.clips = [
      textClip({ id: "hook", from: 0, durationInFrames: 60, label: "Hook" }),
    ];
    useStudioStore.getState().setProject(project, 0);
    actions.approveStage("animatic");
    expect(timingLocked(current().file.process)).toBe(true);

    expect(actions.reopenStage("animatic").ok).toBe(true);
    expect(timingLocked(current().file.process)).toBe(false);
    expect(current().file.process.animatic.beats).toEqual([]);
  });

  it("derives beat labels from the clip when none was given", () => {
    const file = projectFile({
      tracks: [{ ...projectFile().tracks[0]!, clips: [textClip({ id: "a", from: 0, durationInFrames: 30 })] }],
    });
    expect(snapshotBeats(file)[0]!.label).toBe("Most tools make you click.");
  });
});

const PANELS = [
  { id: "p1", label: "Hook", frame: "Black. One line, centred.", durationInFrames: 60, transitionIn: "rise" as const, transitionOut: "fade" as const, words: "Six clicks." },
  { id: "p2", label: "Reveal", frame: "Wordmark, large.", durationInFrames: 90, transitionIn: "scale" as const, transitionOut: "fade" as const, words: "Vector" },
  { id: "p3", label: "Proof", frame: "One row of the UI, 2×.", durationInFrames: 120, transitionIn: "fade" as const, transitionOut: "none" as const },
];

describe("the storyboard", () => {
  it("is its own stage, after the script; the elements come next, then the animatic", () => {
    const index = STAGES.indexOf("storyboard");
    expect(STAGES[index - 1]).toBe("script");
    expect(STAGES[index + 1]).toBe("style");
    expect(STAGES[index + 2]).toBe("animatic");
  });

  it("refuses until the script is approved", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough("concept"), 0);
    const result = await actions.submitStoryboard({ panels: PANELS }, "boards");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stage-gated");
  });

  it("carries one panel per beat with the board's five fields", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough("script"), 0);
    const result = await actions.submitStoryboard({ panels: PANELS.map((panel) => ({ ...panel, visual: boardVisual() })) }, "first, last, then between");
    expect(result.ok).toBe(true);

    const panels = current().file.process.storyboard.panels;
    expect(panels).toHaveLength(3);
    expect(panels[0]).toMatchObject({ label: "Hook", durationInFrames: 60, transitionIn: "rise" });
    expect(panels[2]!.transitionOut).toBe("none");
  });

  /**
   * The transcription: nine panels of hand-computed cumulative frames is the
   * arithmetic an agent gets wrong. The tool does it, from the artifact the
   * person already approved.
   */
  it("lays a board whose frame description runs to the schema's limit", async () => {
    const project = filmApprovedThrough("storyboard");
    project.file.process.storyboard.panels = [
      {
        ...PANELS[0]!,
        // 280 characters is legal for a panel's frame; a clip's revision
        // note holds 240. This board used to refuse the whole animatic.
        frame: "A very deliberate description. ".repeat(9).slice(0, 280),
      },
    ];
    useStudioStore.getState().setProject(project, 0);

    const result = await actions.layAnimatic();
    expect(result.ok, result.message).toBe(true);
    const laid = current().file.tracks.flatMap((track) => track.clips);
    expect(laid).toHaveLength(1);
    expect(laid[0]!.revisionNote!.length).toBeLessThanOrEqual(240);
  });

  it("lays the approved boards on the timeline at cumulative frames", async () => {
    const project = filmApprovedThrough("storyboard");
    project.file.process.storyboard.panels = PANELS;
    useStudioStore.getState().setProject(project, 0);

    const result = await actions.layAnimatic();
    expect(result.ok).toBe(true);

    const boards = current().file.tracks.find((t) => t.name === "Boards");
    expect(boards).toBeDefined();
    expect(boards!.clips.map((c) => [c.from, c.durationInFrames])).toEqual([
      [0, 60],
      [60, 90],
      [150, 120],
    ]);
    // The film grew to fit them.
    expect(current().file.durationInFrames).toBe(270);
    // Words and transitions are the panel's; the third has no words, so its label stands in.
    const [hook, , proof] = boards!.clips;
    expect(hook!.kind === "text" && hook!.text).toBe("Six clicks.");
    expect(hook!.kind === "text" && hook!.animation.enter).toBe("rise");
    expect(proof!.kind === "text" && proof!.text).toBe("Proof");
    // Transcribed from an approved artifact: not a draft to click through.
    expect(boards!.clips.every((c) => c.approval === "accepted")).toBe(true);
  });

  it("refuses to lay before the storyboard is approved", async () => {
    const project = filmApprovedThrough("script");
    project.file.process.storyboard.panels = PANELS;
    useStudioStore.getState().setProject(project, 0);
    const result = await actions.layAnimatic();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stage-gated");
  });

  it("replaces the boards when re-laid, rather than doubling them", async () => {
    const project = filmApprovedThrough("storyboard");
    project.file.process.storyboard.panels = PANELS;
    useStudioStore.getState().setProject(project, 0);

    await actions.layAnimatic();
    await actions.layAnimatic();

    const boards = current().file.tracks.find((t) => t.name === "Boards");
    expect(boards!.clips).toHaveLength(3);
  });

  it("will not re-lay once the timing is locked", async () => {
    const project = filmApprovedThrough("storyboard");
    project.file.process.storyboard.panels = PANELS;
    useStudioStore.getState().setProject(project, 0);
    await actions.layAnimatic();
    actions.approveStage("animatic");

    const result = await actions.layAnimatic();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("timing-locked");
  });
});

describe("approving with feedback", () => {
  it.each(STAGES)("preserves the note for %s in the saved project, activity and agent context", async (stage) => {
    const project = filmApprovedThrough(null);
    project.file.process[stage].status = "submitted";
    useStudioStore.getState().setProject(project, 0);

    const note = "Keep the real product visible throughout.";
    const result = actions.approveStage(stage, { note: `  ${note}\n` });
    expect(result.ok, result.message).toBe(true);

    const saved = ProjectFileSchema.parse(JSON.parse(JSON.stringify(current().file)));
    expect(saved.process[stage]).toMatchObject({ status: "approved", note });
    expect(current().activity.at(-1)?.detail).toContain(note);
    const contextTool = buildTools().find((tool) => tool.name === "prism.get_project_context")!;
    const context = JSON.parse(String(await contextTool.execute({})));
    expect(context.process.stages[stage].personSaid).toBe(note);
  });

  it("keeps the chosen concept alongside its approval note", () => {
    useStudioStore.getState().setProject(filmApprovedThrough("brief"), 0);
    const result = actions.approveStage("concept", { chosen: "c2", note: "Use the first opening shot." });
    expect(result.ok, result.message).toBe(true);
    expect(current().file.process.concept).toMatchObject({
      status: "approved", chosen: "c2", note: "Use the first opening shot.",
    });
  });

  it("accepts approval without feedback and does not carry an old rejection note", () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    actions.requestChanges("brief", "An old request.");
    expect(actions.approveStage("brief", { note: " \n " }).ok).toBe(true);
    expect(current().file.process.brief.note).toBeUndefined();
  });

  it("rejects an oversized note without approving the stage", () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    const before = current();
    expect(actions.approveStage("brief", { note: "x".repeat(601) }).ok).toBe(false);
    expect(current()).toBe(before);
  });
});

describe("sending a stage back", () => {
  it("records the note and hands it to the agent as the next instruction", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    await actions.submitBrief(
      { audience: "everyone", message: "it's great", feeling: "wow", lengthSeconds: 30 },
    );

    expect(actions.requestChanges("brief", "Everyone is nobody. Pick one person.").ok).toBe(true);

    const state = current().file.process.brief;
    expect(state.status).toBe("changes-requested");
    expect(state.note).toBe("Everyone is nobody. Pick one person.");

    const next = nextInstruction(current().file.process);
    expect(next.instruction).toMatch(/Everyone is nobody/);
    expect(next.instruction).toMatch(/submit_brief/);
  });

  it("clears the note when the agent resubmits", async () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    await actions.submitBrief({ audience: "a", message: "b", feeling: "c", lengthSeconds: 30 });
    actions.requestChanges("brief", "no");
    await actions.submitBrief({ audience: "Engineers", message: "One keystroke.", feeling: "relief", lengthSeconds: 30 });

    expect(current().file.process.brief.status).toBe("submitted");
    expect(current().file.process.brief.note).toBeUndefined();
  });

  it("refuses an empty note — a rejection has to say why", () => {
    useStudioStore.getState().setProject(filmApprovedThrough(null), 0);
    expect(actions.requestChanges("brief", "   ").ok).toBe(false);
  });
});

describe("the approval boundary, extended to the process", () => {
  it("registers eight submit tools and none that approve, reopen or skip", () => {
    const names = buildTools().map((tool) => tool.name);

    for (const stage of STAGES) {
      const expected = `prism.submit_${stage === "concept" ? "concepts" : stage === "style" ? "style_frames" : stage}`;
      expect(names, `${expected} is missing`).toContain(expected);
    }
    expect(names).toContain("prism.lay_animatic");

    const forbidden = names.filter((name) =>
      /approve|reopen|skip|unlock|accept/i.test(name),
    );
    expect(forbidden).toEqual([]);
  });

  it("keeps approveStage, requestChanges and reopenStage as actions for the UI", () => {
    const surface = Object.keys(actions);
    expect(surface).toContain("approveStage");
    expect(surface).toContain("requestChanges");
    expect(surface).toContain("reopenStage");
  });

  it("tells the agent where it is, first, in the context", () => {
    useStudioStore.getState().setProject(filmApprovedThrough("brief"), 0);
    const context = actions.getProjectContext();

    expect(context.composition).not.toBeNull();
    expect(context.process?.stage).toBe("concept");
    expect(context.process?.instruction).toMatch(/submit_concepts/);
    expect(context.process?.stages.brief?.status).toBe("approved");
    expect(context.process?.timingLocked).toBe(false);
  });
});
