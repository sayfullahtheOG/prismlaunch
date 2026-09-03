import { describe, expect, it } from "vitest";
import { assembleProject, fileNameFor, isSplit, splitProject } from "@/lib/studio/modular";
import { ProjectFileSchema } from "@/lib/studio/schema";
import { listDirectory, modifiedAt, readFileAt, readProjectFile, writeProjectFile } from "@/lib/workspace/fs";
import { fakeWorkspace } from "./fake-disk";
import { projectFile, textClip } from "./fixture";

/**
 * The film as a folder of small files.
 *
 * On disk, project.json holds the film and lists its layers and elements
 * by id; each is its own file. An agent edits one file to change one thing.
 * These pin the split and the assembly, that a single-file film still
 * opens, that a change to any part is a change to the film, and that the
 * main file is the authority on what the film contains.
 */

function film() {
  return ProjectFileSchema.parse({
    ...projectFile({ name: "Split" }),
    elements: [
      {
        kind: "text",
        id: "el-headline",
        name: "Headline",
        fontSize: 0.1,
        fontFamily: "display",
        fontWeight: 400,
        color: "#F5F5F7",
        align: "center",
        lineHeight: 1.1,
        letterSpacing: -0.02,
        box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
        animation: { enter: "none", exit: "none", enterFrames: 12, exitFrames: 12 },
      },
    ],
  });
}

describe("splitting and assembling", () => {
  it("round-trips a film through its parts", () => {
    const original = film();
    const split = splitProject(original);
    expect(split.main.tracks).toEqual(original.tracks.map((track) => track.id));
    expect(split.main.elements).toEqual(["el-headline"]);
    expect(split.tracks.map((part) => part.name)).toEqual(original.tracks.map((track) => `${track.id}.json`));
    expect(isSplit(split.main)).toBe(true);
    expect(isSplit(original)).toBe(false);

    const back = assembleProject(split.main, split.tracks, split.elements, split.process);
    expect(ProjectFileSchema.parse(back)).toEqual(original);
  });

  it("keeps project.json in charge: listed ids in order, inline objects as they are, strays out", () => {
    const original = film();
    const split = splitProject(original);
    const [first, ...rest] = original.tracks;
    const main = { ...split.main, tracks: [...rest.map((track) => track.id), first!.id, "track-gone"] };
    const stray = { name: "stray.json", body: { ...first!, id: "track-stray" } };
    const back = assembleProject(main, [...split.tracks, stray], split.elements) as { tracks: { id: string }[] };
    expect(back.tracks.map((track) => track.id)).toEqual([...rest.map((track) => track.id), first!.id]);

    const inline = assembleProject({ ...split.main, elements: [original.elements[0]] }, split.tracks, []) as {
      elements: { id: string }[];
    };
    expect(inline.elements.map((element) => element.id)).toEqual(["el-headline"]);
  });

  it("takes every file, by name, when the main file does not list them", () => {
    const split = splitProject(film());
    const back = assembleProject({ ...split.main, tracks: undefined, elements: undefined }, split.tracks, split.elements, split.process);
    expect(ProjectFileSchema.safeParse(back).success).toBe(true);
  });

  it("names files safely and finds parts by their id, not their name", () => {
    expect(fileNameFor("track-a/b c")).toBe("track-a_b_c.json");
    const split = splitProject(film());
    const renamed = split.tracks.map((part) => ({ ...part, name: "whatever.json" }));
    const back = assembleProject(split.main, renamed, split.elements) as { tracks: unknown[] };
    expect(back.tracks).toHaveLength(split.tracks.length);
  });
});

describe("on disk", () => {
  it("writes a film as its parts and reads it back the same", async () => {
    const { workspace, dir } = fakeWorkspace();
    const original = film();
    expect((await writeProjectFile(workspace, "split", original)).ok).toBe(true);

    const files = dir.list("split");
    expect(files).toContain("project.json");
    expect(files).toContain("elements/el-headline.json");
    for (const track of original.tracks) expect(files).toContain(`tracks/${track.id}.json`);

    const main = JSON.parse(dir.read("split/project.json")!);
    expect(main.tracks).toEqual(original.tracks.map((track) => track.id));
    expect(main.elements).toEqual(["el-headline"]);

    const read = await readProjectFile(workspace, "split");
    expect(read.ok && read.value.file).toEqual(original);
  });

  it("still opens a film written as one file, and splits it on the next save", async () => {
    const { workspace, dir } = fakeWorkspace();
    const original = film();
    await dir.put("one/project.json", JSON.stringify(original));
    const read = await readProjectFile(workspace, "one");
    expect(read.ok && read.value.file).toEqual(original);

    expect((await writeProjectFile(workspace, "one", read.ok ? read.value.file : original)).ok).toBe(true);
    expect(dir.list("one")).toContain("elements/el-headline.json");
    expect(JSON.parse(dir.read("one/project.json")!).elements).toEqual(["el-headline"]);
  });

  it("notices a change to any part, and reads it", async () => {
    const { workspace, dir } = fakeWorkspace();
    const original = film();
    await writeProjectFile(workspace, "watch", original);
    const before = await modifiedAt(workspace, "watch");

    // An agent recolours the headline by editing its own file.
    const element = JSON.parse(dir.read("watch/elements/el-headline.json")!);
    await dir.put("watch/elements/el-headline.json", JSON.stringify({ ...element, color: "#FF0000" }));
    expect(await modifiedAt(workspace, "watch")).toBeGreaterThan(before);
    const read = await readProjectFile(workspace, "watch");
    const headline = read.ok ? read.value.file.elements[0] : undefined;
    expect(headline?.kind === "text" && headline.color).toBe("#FF0000");
  });

  it("drops a part from the folder when it leaves the film", async () => {
    const { workspace, dir } = fakeWorkspace();
    const original = film();
    await writeProjectFile(workspace, "drop", original);
    await writeProjectFile(workspace, "drop", { ...original, elements: [] });
    expect(dir.list("drop")).not.toContain("elements/el-headline.json");
    await dir.put("drop/tracks/notes.txt", "not a part");
    await writeProjectFile(workspace, "drop", original);
    expect(dir.list("drop")).toContain("tracks/notes.txt");
  });

  it("names a broken part file, not the whole film", async () => {
    const { workspace, dir } = fakeWorkspace();
    await writeProjectFile(workspace, "bad", film());
    await dir.put("bad/tracks/broken.json", "{ not json");
    const read = await readProjectFile(workspace, "bad");
    expect(read.ok).toBe(false);
    expect(!read.ok && read.message).toMatch(/tracks\/broken\.json/);
  });

  it("shows the parts in the Files section", async () => {
    const { workspace } = fakeWorkspace();
    await writeProjectFile(workspace, "seen", film());
    const inside = await listDirectory(workspace, ".prismlaunch/seen");
    expect(inside.ok && inside.value.map((entry) => entry.name)).toEqual(["elements", "process", "tracks", "project.json"]);
    const part = await readFileAt(workspace, ".prismlaunch/seen/elements/el-headline.json");
    expect(part.ok && JSON.parse(await part.value.text()).id).toBe("el-headline");
    void textClip;
  });
});
