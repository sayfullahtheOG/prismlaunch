import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as actions from "@/lib/studio/actions";
import { activityEvent } from "@/lib/studio/activity";
import { readProject, resetStudio, useStudioStore } from "@/lib/studio/store";
import { readStoredFiles, resetBrowserStore } from "@/lib/workspace/browser-store";
import { browserWorkspace, modifiedAt, readFileAt, readProjectFile, writeProjectFile } from "@/lib/workspace/fs";
import { ProjectFileSchema } from "@/lib/studio/schema";
import { fakeWorkspace } from "./fake-disk";
import { approvedThrough, projectFile } from "./fixture";

const values = new Map<string, string>();
const local = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
beforeEach(async () => {
  await actions.flushWrites();
  resetStudio();
  resetBrowserStore();
  values.clear();
  vi.stubGlobal("localStorage", local);
});
afterEach(async () => {
  await actions.flushWrites();
  resetStudio();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const log = () => [activityEvent({ origin: "agent", label: "prism.submit_script", detail: "Script submitted" })];
const film = () => ProjectFileSchema.parse(projectFile({ process: { ...approvedThrough("script"), storyboard: { status: "submitted", panels: [] } } }));

describe.each(["browser", "disk"] as const)("durable %s projects", (kind) => {
  const setup = () => kind === "browser" ? browserWorkspace() : fakeWorkspace().workspace;
  const path = (slug: string, file: string) => `${kind === "browser" ? "compositions" : ".prismlaunch"}/${slug}/${file}`;

  it("keeps every process in its own file and round-trips decisions and activity", async () => {
    const workspace = setup();
    const original = film();
    original.process.script.note = "Show the real UI.";
    const events = log();
    expect((await writeProjectFile(workspace, "launch", original, events)).ok).toBe(true);
    const main = await readFileAt(workspace, path("launch", "project.json"));
    const manifest = main.ok && JSON.parse(await main.value.text());
    expect(manifest.process.script).toBe("process/script.json");
    expect(manifest.process.storyboard).toBe("process/storyboard.json");
    expect(manifest.tracks.every((track: unknown) => typeof track === "string")).toBe(true);
    const part = await readFileAt(workspace, path("launch", "process/script.json"));
    expect(part.ok && JSON.parse(await part.value.text())).toEqual(original.process.script);
    const read = await readProjectFile(workspace, "launch");
    expect(read.ok && read.value.file).toEqual(original);
    expect(read.ok && read.value.activity).toEqual(events);
  });

  it("preserves activity through reopen and later decisions, with unique event ids", async () => {
    const workspace = setup();
    const events = log();
    await writeProjectFile(workspace, "launch", film(), events);
    useStudioStore.setState({ workspace: { kind: "linked", workspace, projects: [] } });
    await actions.openProject("launch");
    expect(readProject()!.activity).toContainEqual(events[0]);
    actions.approveStage("storyboard", { note: "Keep the product visible." });
    await actions.flushWrites();
    const approval = readProject()!.activity.at(-1)!;
    await actions.openProject("launch");
    expect(readProject()!.activity).toContainEqual(approval);
    expect(readProject()!.file.process.storyboard.note).toBe("Keep the product visible.");
    expect(new Set(readProject()!.activity.map((event) => event.id)).size).toBe(readProject()!.activity.length);
    expect(approval.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

it("migrates an existing browser film on open and labels recovered progress honestly", async () => {
  const legacy = film();
  legacy.process.script.note = "Preserve this note.";
  local.setItem("prismlaunch.browser.old", JSON.stringify({ file: legacy, modifiedAt: 123 }));
  useStudioStore.setState({ workspace: { kind: "linked", workspace: browserWorkspace(), projects: [] } });
  await actions.openProject("old");
  expect(readProject()!.file).toEqual(legacy);
  const recovered = readProject()!.activity.filter((event) => event.id.startsWith("recovered-"));
  expect(recovered).toHaveLength(4);
  expect(recovered.every((event) => event.at === "Time not recorded")).toBe(true);
  const stored = JSON.parse(local.getItem("prismlaunch.browser.old")!);
  expect(stored.file).toBeUndefined();
  expect(stored.format).toBe(2);
  expect(Object.keys(stored.files)).toContain("process/storyboard.json");
  expect(JSON.parse(readStoredFiles("old")!.files["process/script.json"]!).note).toBe("Preserve this note.");
  await actions.openProject("old");
  expect(readProject()!.activity.filter((event) => event.id.startsWith("recovered-"))).toHaveLength(4);
});

it("rolls back a failed migration without damaging the old project", async () => {
  const legacy = JSON.stringify({ file: film(), modifiedAt: 123 });
  local.setItem("prismlaunch.browser.old", legacy);
  vi.spyOn(local, "setItem").mockImplementation((key, value) => {
    if (key.endsWith("process/storyboard.json")) throw new DOMException("full", "QuotaExceededError");
    values.set(key, value);
  });
  expect((await writeProjectFile(browserWorkspace(), "old", film(), log())).ok).toBe(false);
  expect(local.getItem("prismlaunch.browser.old")).toBe(legacy);
  expect([...values.keys()]).toEqual(["prismlaunch.browser.old"]);
  expect((await readProjectFile(browserWorkspace(), "old")).ok).toBe(true);
});

it("changes only affected browser parts and does not trigger reloads for activity alone", async () => {
  const workspace = browserWorkspace();
  const original = film();
  await writeProjectFile(workspace, "launch", original, log());
  const before = JSON.parse(local.getItem("prismlaunch.browser.launch")!);
  const next = { ...original, process: { ...original.process, script: { ...original.process.script, note: "New note" } } };
  await writeProjectFile(workspace, "launch", next, log());
  const after = JSON.parse(local.getItem("prismlaunch.browser.launch")!);
  expect(after.files["project.json"]).toBe(before.files["project.json"]);
  expect(after.files["process/script.json"]).not.toBe(before.files["process/script.json"]);
  expect(after.files["process/brief.json"]).toBe(before.files["process/brief.json"]);
  expect(after.modifiedAt).toBeGreaterThan(before.modifiedAt);
  expect(local.getItem(before.files["process/script.json"])).toBeNull();
  await writeProjectFile(workspace, "launch", next, log());
  expect(await modifiedAt(workspace, "launch")).toBe(after.modifiedAt);
});

it("detects an external stage edit without rewriting unrelated disk parts", async () => {
  const { workspace, dir } = fakeWorkspace();
  const original = film();
  await writeProjectFile(workspace, "launch", original);
  const main = (await readFileAt(workspace, ".prismlaunch/launch/project.json"));
  const before = await modifiedAt(workspace, "launch");
  await dir.put("launch/process/script.json", JSON.stringify({ ...original.process.script, note: "Edited in a file" }));
  expect(await modifiedAt(workspace, "launch")).toBeGreaterThan(before);
  const read = await readProjectFile(workspace, "launch");
  expect(read.ok && read.value.file.process.script.note).toBe("Edited in a file");
  if (!read.ok) throw Error(read.message);
  await writeProjectFile(workspace, "launch", read.value.file, log());
  const mainAfter = await readFileAt(workspace, ".prismlaunch/launch/project.json");
  expect(mainAfter.ok && mainAfter.value.lastModified).toBe(main.ok && main.value.lastModified);
  await (await workspace.dir.getDirectoryHandle("launch")).getDirectoryHandle("process").then(dir => dir.removeEntry("script.json"));
  expect((await readProjectFile(workspace, "launch")).ok).toBe(false);
});

it("flushes the old project's pending activity before switching projects", async () => {
  await actions.startInBrowser();
  const first = readProject()!.slug;
  actions.approveStage("brief", { note: "Keep this on the first film." });
  await actions.createProject({ slug: "second", name: "Second" });
  await actions.openProject(first);
  expect(readProject()!.file.process.brief.note).toBe("Keep this on the first film.");
  const second = await readProjectFile(browserWorkspace(), "second");
  expect(second.ok && second.value.file.process.brief.note).toBeUndefined();
});

it("keeps ids unique after the 200-event history limit", async () => {
  const workspace = browserWorkspace();
  await writeProjectFile(workspace, "launch", film(), Array.from({ length: 200 }, (_, i) => activityEvent({ origin: "human", label: `Edit ${i}`, detail: "" })));
  useStudioStore.setState({ workspace: { kind: "linked", workspace, projects: [] } });
  await actions.openProject("launch");
  actions.approveStage("storyboard");
  expect(readProject()!.activity).toHaveLength(200);
  expect(new Set(readProject()!.activity.map((event) => event.id)).size).toBe(200);
});
