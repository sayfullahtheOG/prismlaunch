import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import {
  browserWorkspace,
  deleteProjectFolder,
  listProjects,
  projectExists,
  readProjectFile,
  renameProjectFolder,
  writeProjectFile,
  writeRender,
} from "@/lib/workspace/fs";
import { hostedByAgent } from "@/lib/studio/hosted";
import { buildTools } from "@/lib/webmcp/tools";
import { readGuides } from "./guide-setup";
import { projectFile } from "./fixture";

/**
 * The browser workspace: compositions kept in the page, for the browsers
 * that cannot hand over a folder — ChatGPT's built-in browser among them.
 * The same functions the disk takes, against `localStorage` (or memory,
 * here, where there is none), and the whole editor working on top of it
 * with no folder anywhere.
 */

beforeEach(async () => {
  await actions.flushWrites();
  resetBrowserStore();
  resetStudio();
});

describe("the browser workspace", () => {
  const workspace = browserWorkspace();

  it("writes, lists, reads back, and remembers when", async () => {
    const before = Date.now();
    expect(await listProjects(workspace)).toEqual([]);

    const written = await writeProjectFile(workspace, "first", projectFile({ name: "First" }));
    expect(written.ok).toBe(true);

    const listed = await listProjects(workspace);
    expect(listed.map((entry) => [entry.slug, entry.name, entry.problem])).toEqual([
      ["first", "First", null],
    ]);
    expect(listed[0]!.modifiedAt).toBeGreaterThanOrEqual(before);

    const read = await readProjectFile(workspace, "first");
    expect(read.ok && read.value.file.name).toBe("First");
    expect(await projectExists(workspace, "first")).toBe(true);
    expect(await projectExists(workspace, "second")).toBe(false);
  });

  it("refuses to store what it could not read back", async () => {
    const written = await writeProjectFile(workspace, "bad", {
      ...projectFile(),
      durationInFrames: 0,
    });
    expect(written.ok).toBe(false);
    expect(await projectExists(workspace, "bad")).toBe(false);
  });

  it("renames, refuses a taken name, and deletes", async () => {
    await writeProjectFile(workspace, "a", projectFile({ name: "A" }));
    await writeProjectFile(workspace, "b", projectFile({ name: "B" }));

    expect((await renameProjectFolder(workspace, "a", "b")).ok).toBe(false);
    expect((await renameProjectFolder(workspace, "a", "c")).ok).toBe(true);
    expect((await listProjects(workspace)).map((entry) => entry.slug).sort()).toEqual(["b", "c"]);

    expect((await deleteProjectFolder(workspace, "c")).ok).toBe(true);
    expect(await projectExists(workspace, "c")).toBe(false);
  });

  it("has nowhere to put a render, so the caller downloads instead", async () => {
    const saved = await writeRender(workspace, "a", "a.mp4", new Blob(["x"]));
    expect(saved.ok).toBe(false);
  });
});

describe("starting in the browser", () => {
  it("lands in a blank composition with no folder anywhere", async () => {
    const result = await actions.startInBrowser();
    expect(result.ok, result.message).toBe(true);

    const { workspace } = useStudioStore.getState();
    expect(workspace.kind === "linked" && workspace.workspace.kind).toBe("browser");

    const project = readProject();
    expect(project).not.toBeNull();
    expect(project!.file.durationInFrames).toBe(1);
    expect(project!.file.tracks.map((track) => track.kind)).toEqual(["visual", "audio"]);
  });

  it("reopens what it had the next time", async () => {
    await actions.startInBrowser();
    await actions.renameProject("Launch film");
    await actions.flushWrites();
    const slug = readProject()!.slug;

    resetStudio();
    await actions.restoreWorkspace();

    expect(readProject()?.slug).toBe(slug);
    expect(readProject()?.file.name).toBe("Launch film");
  });

  it("lets the agent create and build through the tools alone", async () => {
    await actions.startInBrowser();
    const tools = buildTools();
    await readGuides(tools);
    const create = tools.find((tool) => tool.name === "prism.create_project")!;
    const context = tools.find((tool) => tool.name === "prism.get_project_context")!;

    const message = await create.execute({ slug: "vector", name: "Vector" });
    expect(message).toMatch(/Created/);
    expect(message).not.toMatch(/\.prismlaunch/);

    const seen = JSON.parse(String(await context.execute({})));
    expect(seen.workspace.storage).toBe("browser");
    expect(seen.composition.slug).toBe("vector");
    expect(seen.composition.path).toMatch(/browser/);
  });

  it("is forgotten when a folder is unlinked", async () => {
    await actions.startInBrowser();
    await actions.unlinkFolder();
    // "unlinked" where a folder could be picked; "unsupported" where it
    // cannot — which is what a test runner with no window is.
    expect(["unlinked", "unsupported"]).toContain(useStudioStore.getState().workspace.kind);
    expect(readProject()).toBeNull();

    resetStudio();
    await actions.restoreWorkspace();
    expect(readProject()).toBeNull();
  });
});

describe("an agent's browser", () => {
  it("is told by name alone — a flagged Chrome with native WebMCP keeps its folder", () => {
    expect(hostedByAgent("native", "Mozilla/5.0 Chrome/130")).toBe(false);
    expect(hostedByAgent("fallback", "Mozilla/5.0 ChatGPT/1.2")).toBe(true);
    expect(hostedByAgent("native", "Mozilla/5.0 OpenAI Atlas")).toBe(true);
    expect(hostedByAgent("fallback", "Mozilla/5.0 Chrome/130 Safari/537")).toBe(false);
    expect(hostedByAgent("absent", "Mozilla/5.0 Firefox/130")).toBe(false);
  });
});
