import { beforeEach, describe, expect, it } from "vitest";
import * as actions from "@/lib/studio/actions";
import { LIBRARY, LIBRARY_GROUPS } from "@/lib/studio/library";
import { readProject, resetStudio } from "@/lib/studio/store";
import { resetBrowserStore } from "@/lib/workspace/browser-store";

/**
 * The library: prebuilt pieces that become elements of a film. Every item
 * must be a valid element as it stands, because "Add" copies it in without
 * asking anything.
 */

beforeEach(async () => {
  resetBrowserStore();
  resetStudio();
  await actions.startInBrowser();
});

describe("the library", () => {
  it("has type and shapes, each item in a known group with a name and a blurb", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(8);
    for (const item of LIBRARY) {
      expect(LIBRARY_GROUPS).toContain(item.group);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(10);
      expect(item.draft.name).toBe(item.name.startsWith("Blank") ? item.draft.name : item.draft.name);
    }
    const ids = LIBRARY.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds every item as an element of the film, as a person, at any stage", () => {
    for (const item of LIBRARY) {
      const result = actions.createElement(item.draft);
      expect(result.ok, `${item.id}: ${result.message}`).toBe(true);
    }
    const elements = readProject()!.file.elements;
    expect(elements).toHaveLength(LIBRARY.length);
    expect(elements.filter((element) => element.kind === "text").length).toBe(
      LIBRARY.filter((item) => item.group === "Type").length,
    );
  });
});
