import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { middleView, openingTab, reviewedStage } from "@/lib/studio/review";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { buildTools } from "@/lib/webmcp/tools";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { boardVisual } from "./fixture";

/**
 * The decision, delivered.
 *
 * WebMCP is request and response, so the page cannot tell an agent "they
 * approved it". What it can do is hold a call open until it can. These test
 * that the call resolves the instant a person decides, says what they
 * decided, and never lies about a stage that has nothing to wait for — and
 * that the middle of the editor opens the right view for the stage under
 * review.
 */

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  // A blank composition in the browser workspace: every stage pending.
  await actions.startInBrowser();
});

async function submitBrief() {
  const result = await actions.submitBrief({
    audience: "Indie developers",
    message: "One key. Every issue.",
    feeling: "calm",
    lengthSeconds: 15,
  });
  expect(result.ok, result.message).toBe(true);
}

describe("waiting for a decision", () => {
  it("resolves the moment the person approves, and says what comes next", async () => {
    await submitBrief();
    const waiting = actions.waitForDecision({ timeoutSeconds: 5 });

    // Nothing has resolved yet: the person has not clicked.
    let settled = false;
    void waiting.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    actions.approveStage("brief");
    const result = await waiting;
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Brief approved/);
    expect(result.message).toMatch(/Concept/);
    expect(result.message).toMatch(/prism\.submit_concepts/);
  });

  it("carries the note when the person sends it back", async () => {
    await submitBrief();
    const waiting = actions.waitForDecision({});
    actions.requestChanges("brief", "The audience is too broad.");
    const result = await waiting;
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/sent back/);
    expect(result.message).toMatch(/too broad/);
    expect(result.message).toMatch(/prism\.submit_brief/);
  });

  it("returns at once if the decision was already made", async () => {
    await submitBrief();
    actions.approveStage("brief");
    const result = await actions.waitForDecision({ stage: "brief" });
    expect(result.ok && result.message).toMatch(/Brief approved/);
  });

  it("delivers approval feedback to both a waiting and a returning agent", async () => {
    await submitBrief();
    const tool = buildTools().find((tool) => tool.name === "prism.wait_for_decision")!;
    const waiting = tool.execute({ stage: "brief", timeoutSeconds: 5 });
    const note = "Keep the opening product shot.";
    actions.approveStage("brief", { note });

    for (const response of [await waiting, await tool.execute({ stage: "brief" })]) {
      expect(String(response)).toContain("Brief approved");
      expect(String(response)).toContain(note);
      expect(String(response)).toContain("prism.submit_concepts");
    }
  });

  it("says so, politely, when the wait runs out", async () => {
    await submitBrief();
    const result = await actions.waitForDecision({ timeoutSeconds: 1 });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Still waiting/);
    // The agent is told to hand the turn back, not to poll.
    expect(result.message).toMatch(/end your turn/i);
    expect(result.message).toMatch(/message you/);
  }, 5000);

  it("refuses to wait on a stage that was never submitted", async () => {
    const result = await actions.waitForDecision({ stage: "script" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not been submitted/);
  });

  it("is a registered, read-only tool that reaches the same wait", async () => {
    const tool = buildTools().find((tool) => tool.name === "prism.wait_for_decision")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
    await submitBrief();
    const waiting = tool.execute({ timeoutSeconds: 5 });
    actions.approveStage("brief");
    expect(String(await waiting)).toMatch(/Brief approved/);
  });

  it("opens the submitted stage for the person, wherever they were", async () => {
    actions.showEditor();
    expect(useStudioStore.getState().tab).toBe("editor");
    await submitBrief();
    const state = useStudioStore.getState();
    expect(state.tab).toBe("process");
    expect(state.openStage).toBe("brief");
    expect(state.reviewing).toBe(true);
    expect(middleView(state.tab, state.openStage, readProject()!.file.process, state.reviewing)).toBe("review");
  });

  it("tells the agent to wait, in the submit result itself", async () => {
    const result = await actions.submitBrief({
      audience: "a",
      message: "b",
      feeling: "c",
      lengthSeconds: 15,
    });
    expect(result.message).toMatch(/prism\.wait_for_decision/);
  });
});

describe("where a film opens", () => {
  async function reachScript() {
    await submitBrief();
    actions.approveStage("brief");
    await actions.submitConcepts({
      directions: [
        { id: "demo", title: "Self demo", line: "The film opens into its editor." },
        { id: "note", title: "One note", line: "Feedback changes the film." },
      ],
      recommended: "demo",
    });
    actions.approveStage("concept", { chosen: "demo" });
    await actions.submitScript({
      beats: [
        { id: "hook", label: "Hook", words: "Made here.", seconds: 2 },
        { id: "proof", label: "Proof", words: "Watch it change.", seconds: 3 },
      ],
    });
  }

  it.each([null, "script"] as const)("keeps the approved script and note visible when openStage was %s", async (openStage) => {
    await reachScript();
    useStudioStore.getState().setOpenStage(openStage);
    const result = actions.approveStage("script", { note: "Show the UI of the app." });
    expect(result.ok).toBe(true);

    const state = useStudioStore.getState();
    const context = actions.getProjectContext();
    expect(context.process?.stage).toBe("storyboard");
    expect(context.process?.stages.script?.personSaid).toBe("Show the UI of the app.");
    expect(state.openStage).toBe("script");
    expect(middleView(state.tab, state.openStage, readProject()!.file.process, state.reviewing)).toBe("review");

    // A real submission opens the next artifact once it exists.
    const submitted = await actions.submitStoryboard({
      panels: [
        { id: "p1", beatId: "hook", label: "Hook", frame: "The editor preview.", durationInFrames: 60, transitionIn: "none", transitionOut: "none", visual: boardVisual() },
        { id: "p2", beatId: "proof", label: "Proof", frame: "The same editable timeline.", durationInFrames: 90, transitionIn: "none", transitionOut: "none", visual: boardVisual() },
      ],
    });
    expect(submitted.ok, submitted.message).toBe(true);
    expect(useStudioStore.getState().openStage).toBe("storyboard");
    expect(middleView("process", "storyboard", readProject()!.file.process)).toBe("boards");
  });

  it("keeps an unsuccessful approval on the same review without changing navigation", async () => {
    await reachScript();
    useStudioStore.getState().setOpenStage(null);
    expect(actions.approveStage("script", { note: "x".repeat(601) }).ok).toBe(false);
    expect(useStudioStore.getState().openStage).toBeNull();
    expect(readProject()!.file.process.script.status).toBe("submitted");
  });

  it("does not take over another view when a stage is approved", async () => {
    await reachScript();
    actions.showEditor();
    actions.approveStage("script");
    expect(useStudioStore.getState().tab).toBe("editor");
    expect(useStudioStore.getState().reviewing).toBe(false);
  });

  it("lands on the process while the work is documents, the editor once it is the film", async () => {
    expect(openingTab(readProject()!.file.process)).toBe("process");
    expect(useStudioStore.getState().tab).toBe("process");

    const process = structuredClone(readProject()!.file.process);
    for (const stage of ["brief", "concept", "script", "storyboard"] as const) {
      process[stage].status = "approved";
    }
    expect(openingTab(process)).toBe("editor");
    for (const stage of ["animatic", "style", "build", "sound", "polish"] as const) {
      process[stage].status = "approved";
    }
    expect(openingTab(process)).toBe("editor");
  });
});

describe("what the middle shows", () => {
  it("opens a page for a document stage and the editor for a built one", () => {
    const process = readProject()!.file.process;
    expect(middleView("process", "brief", process)).toBe("review");
    expect(middleView("process", "script", process)).toBe("review");
    expect(middleView("process", "storyboard", process)).toBe("boards");
    // The animatic is judged by watching it: a screening, not the editor.
    expect(middleView("process", "animatic", process)).toBe("screening");
    expect(middleView("process", "style", process)).toBe("editor");
    expect(middleView("process", "build", process)).toBe("editor");
    expect(middleView("elements", "brief", process)).toBe("editor");
    // The Storyboard section is the boards at full size, whatever stage is open.
    expect(middleView("storyboard", null, process)).toBe("boards");
    expect(middleView("storyboard", "brief", process)).toBe("boards");
    // "Back to editor": the canvas, whatever stage the film is at.
    expect(middleView("process", "brief", process, false)).toBe("editor");
  });

  it("follows the film when nothing is opened, and the person when something is", () => {
    const process = readProject()!.file.process;
    expect(reviewedStage(null, process)).toBe("brief");
    expect(reviewedStage("polish", process)).toBe("polish");
    useStudioStore.getState().setOpenStage("script");
    expect(useStudioStore.getState().openStage).toBe("script");
    actions.showEditor();
    expect(useStudioStore.getState().reviewing).toBe(false);
    useStudioStore.getState().setOpenStage("brief");
    expect(useStudioStore.getState().reviewing).toBe(true);
    resetStudio();
    expect(useStudioStore.getState().openStage).toBeNull();
  });
});
