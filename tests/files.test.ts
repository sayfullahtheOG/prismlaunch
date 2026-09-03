import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { middleView } from "@/lib/studio/review";
import { EMPTY_PROCESS } from "@/lib/studio/schema";
import { resetStudio, useStudioStore } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";
import { browserWorkspace, listDirectory, readFileAt } from "@/lib/workspace/fs";
import { preparedTools } from "./guide-setup";

/**
 * The Files section and the way back to the editor.
 *
 * A film is files, and a person should be able to see them from the tool
 * that reads them. A browser workspace has no folder, so it is drawn as
 * one, in the shape the disk has.
 */

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  await actions.startInBrowser();
});

describe("the files section", () => {
  it("draws a browser workspace as a folder of compositions", async () => {
    const create = (await preparedTools()).find((tool) => tool.name === "prism.create_project")!;
    await create.execute({ slug: "vector", name: "Vector" });
    await actions.flushWrites();
    const workspace = browserWorkspace();

    const root = await listDirectory(workspace, "");
    expect(root.ok && root.value.map((entry) => entry.path)).toEqual(["compositions"]);

    const compositions = await listDirectory(workspace, "compositions");
    expect(compositions.ok && compositions.value.map((entry) => entry.name)).toContain("vector");

    const inside = await listDirectory(workspace, "compositions/vector");
    expect(inside.ok && inside.value.map((entry) => [entry.name, entry.kind])).toEqual([
      ["assets", "directory"],
      ["project.json", "file"],
    ]);

    const file = await readFileAt(workspace, "compositions/vector/project.json");
    expect(file.ok && file.value.name).toBe("project.json");
    expect(file.ok && JSON.parse(await file.value.text()).name).toBe("Vector");

    expect((await readFileAt(workspace, "compositions/vector/nope.txt")).ok).toBe(false);
    expect((await listDirectory(workspace, "somewhere/else")).ok && true).toBe(true);
  });

  it("takes the middle while it is up, as the boards do; the editor section is always the film", () => {
    expect(middleView("files", null, EMPTY_PROCESS)).toBe("files");
    expect(middleView("storyboard", null, EMPTY_PROCESS)).toBe("boards");
    expect(middleView("storyboard", "brief", EMPTY_PROCESS, false)).toBe("boards");
    expect(middleView("editor", "brief", EMPTY_PROCESS, true)).toBe("editor");
    expect(middleView("process", "brief", EMPTY_PROCESS, true)).toBe("review");
    expect(middleView("elements", "brief", EMPTY_PROCESS, true)).toBe("editor");
  });

  it("opens a file, and comes back to the editor from anywhere", () => {
    // A fresh film is at the brief: document work, so it lands on the process.
    expect(useStudioStore.getState().tab).toBe("process");
    actions.openFile("compositions/vector/project.json");
    expect(useStudioStore.getState().tab).toBe("files");
    expect(useStudioStore.getState().filePath).toBe("compositions/vector/project.json");

    actions.reviewStage("brief");
    expect(useStudioStore.getState().tab).toBe("process");
    actions.showEditor();
    expect(useStudioStore.getState().tab).toBe("editor");
    expect(useStudioStore.getState().reviewing).toBe(false);
  });
});
