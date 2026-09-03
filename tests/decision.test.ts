import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { middleView, openingTab, reviewedStage } from "@/lib/studio/review";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { buildTools } from "@/lib/webmcp/tools";
import { resetBrowserStore } from "@/lib/workspace/browser-store";

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
