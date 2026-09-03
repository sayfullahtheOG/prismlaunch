import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTools } from "@/lib/webmcp/tools";
import { GUIDE_NAMES } from "@/lib/webmcp/guides";
import { PRISM_TOOLSETS } from "@/lib/webmcp/register";
import { patchClip, requestChanges } from "@/lib/studio/actions";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { approvedThrough, film } from "./fixture";
import { readGuides } from "./guide-setup";

beforeEach(() => {
  resetStudio();
  useStudioStore.getState().setProject(film(), 0);
});
afterEach(() => vi.restoreAllMocks());

const edit = { clipId: "clip-a", from: 10, note: "Move earlier" };
const script = {
  beats: [
    { id: "a", label: "Hook", words: "Made here.", seconds: 2 },
    { id: "b", label: "Proof", words: "Watch it change.", seconds: 3 },
  ],
};

describe("required guide reading", () => {
  it("announces both guides even with no project, and leaves context readable", async () => {
    resetStudio();
    const context = buildTools().find((t) => t.name === "prism.get_project_context")!;
    const result = JSON.parse(String(await context.execute({})));
    expect(result.agentGuidance.requiredBeforeWork).toEqual(GUIDE_NAMES);
    expect(result.agentGuidance.instruction).toMatch(/Before planning, drafting or editing/);
    expect(result.composition).toBeNull();
  });

  it("includes the requirement alongside a resumed stage and its real rejection note", async () => {
    requestChanges("script", "Make it faster");
    const context = buildTools().find((t) => t.name === "prism.get_project_context")!;
    const result = JSON.parse(String(await context.execute({})));
    expect(result.agentGuidance.requiredBeforeWork).toEqual(GUIDE_NAMES);
    expect(result.process.stages.script.personSaid).toBe("Make it faster");
  });

  it("blocks real edits until both full documents are delivered, without changing the film", async () => {
    const tools = buildTools();
    const update = tools.find((t) => t.name === "prism.update_clip")!;
    const read = tools.find((t) => t.name === "prism.read_guide")!;
    const original = structuredClone(readProject());
    expect(await update.execute(edit)).toMatch(/SKILL.md and PRISM_METHOD.md/);
    expect(readProject()).toEqual(original);

    const markdown = readFileSync(join(process.cwd(), "public/SKILL.md"), "utf8");
    const fetchGuide = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(markdown));
    expect(await read.execute({ document: "SKILL.md" })).toContain(markdown);
    expect(await update.execute(edit)).toMatch(/Call prism.read_guide for PRISM_METHOD.md/);
    expect(readProject()).toEqual(original);
    fetchGuide.mockRestore();

    await readGuides(tools);
    expect(await update.execute(edit)).not.toMatch(/Read the required guides|Could not do that/);
    expect(readProject()!.file.tracks.flatMap((t) => t.clips).find((c) => c.id === "clip-a")!.from).toBe(10);
  });

  it("gates script submission too, then preserves the human stage gate", async () => {
    const tools = buildTools();
    const submit = tools.find((t) => t.name === "prism.submit_script")!;
    const project = film();
    project.file.process = approvedThrough(null);
    useStudioStore.getState().setProject(project, 0);
    expect(await submit.execute(script)).toMatch(/Read the required guides/);
    await readGuides(tools);
    expect(await submit.execute(script)).toMatch(/Could not do that/);
    expect(readProject()!.file.process.script.status).toBe("pending");

    project.file.process = approvedThrough("concept");
    useStudioStore.getState().setProject(project, 0);
    expect(await submit.execute(script)).toMatch(/Script submitted/);
    expect(readProject()!.file.process.script.status).toBe("submitted");
  });

  it.each(["http", "html", "empty", "network", "wrong-guide"])("does not satisfy the requirement after a %s failure", async (failure) => {
    const tools = buildTools();
    const read = tools.find((t) => t.name === "prism.read_guide")!;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (failure === "network") throw new Error("Offline");
      if (failure === "http") return new Response("Not found", { status: 404 });
      if (failure === "wrong-guide") return new Response(readFileSync(join(process.cwd(), "public/PRISM_METHOD.md"), "utf8"));
      return new Response(failure === "html" ? "<!doctype html><html>Fallback</html>" : "");
    });
    expect(await read.execute({ document: "SKILL.md" })).toMatch(/Could not load SKILL.md/);
    const context = tools.find((t) => t.name === "prism.get_project_context")!;
    expect(JSON.parse(String(await context.execute({}))).agentGuidance.requiredBeforeWork).toEqual(GUIDE_NAMES);
  });

  it("validates guide names without fetching arbitrary URLs", async () => {
    const fetchGuide = vi.spyOn(globalThis, "fetch");
    const read = buildTools().find((t) => t.name === "prism.read_guide")!;
    expect(await read.execute({ document: "https://example.com/private" })).toMatch(/Invalid input/);
    expect(fetchGuide).not.toHaveBeenCalled();
  });

  it("starts each fresh registration with a new requirement", async () => {
    await readGuides(buildTools());
    const fresh = buildTools().find((t) => t.name === "prism.update_clip")!;
    expect(await fresh.execute(edit)).toMatch(/Read the required guides/);
  });

  it("does not gate the person's own editing actions", () => {
    expect(patchClip("clip-a", { from: 10 }).ok).toBe(true);
  });

  it("keeps guide reading reachable in every toolset", () => {
    for (const names of Object.values(PRISM_TOOLSETS)) expect(names).toContain("prism.read_guide");
  });
});
