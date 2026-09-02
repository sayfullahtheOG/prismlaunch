import { describe, expect, it } from "vitest";
import { SlugSchema } from "@/lib/studio/schema";
import { slugForName, slugify, uniqueSlug } from "@/lib/studio/slug";

/**
 * The folder name is what someone sees in Finder, so it follows the
 * composition's name rather than being minted once and left to rot. That only
 * works if every name a person can type produces a slug the schema accepts —
 * these are the cases that break it.
 */

describe("slugify", () => {
  it("makes an ordinary title into a folder name", () => {
    expect(slugify("First video")).toBe("first-video");
    expect(slugify("Untitled composition")).toBe("untitled-composition");
  });

  it("folds accents rather than dropping the word", () => {
    expect(slugify("Café launch")).toBe("cafe-launch");
  });

  it("collapses punctuation and trims the edges", () => {
    expect(slugify("  Vector — v2.0 (final!) ")).toBe("vector-v2-0-final");
  });

  it("never starts with a dash, whatever it was given", () => {
    expect(slugify("— leading")).toBe("leading");
    expect(slugify("2024 recap")).toBe("2024-recap");
  });

  it("returns nothing usable for a name with nothing in it", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  /** A slug is interpolated into a path, so this is the assertion that matters. */
  it("always produces something the schema accepts", () => {
    const names = [
      "First video",
      "Café launch",
      "  Vector — v2.0 (final!) ",
      "../../etc/passwd",
      ".hidden",
      "UPPER CASE",
      "a".repeat(200),
      "emoji 🎬 title",
    ];

    for (const name of names) {
      const slug = slugify(name);
      if (slug === "") continue;
      expect(
        SlugSchema.safeParse(slug).success,
        `"${name}" produced "${slug}"`,
      ).toBe(true);
    }
  });
});

describe("uniqueSlug", () => {
  it("leaves a free name alone", () => {
    expect(uniqueSlug("first-video", ["other"])).toBe("first-video");
  });

  it("numbers a taken one", () => {
    expect(uniqueSlug("untitled", ["untitled"])).toBe("untitled-2");
    expect(uniqueSlug("untitled", ["untitled", "untitled-2"])).toBe("untitled-3");
  });

  /** A long name plus a suffix must still fit, or the schema rejects it. */
  it("keeps a numbered variant inside the length limit", () => {
    const long = "a".repeat(48);
    const slug = uniqueSlug(long, [long]);

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(SlugSchema.safeParse(slug).success).toBe(true);
  });
});

describe("slugForName", () => {
  it("declines a name with nothing usable in it", () => {
    expect(slugForName("!!!", [])).toBeNull();
  });

  it("skips the folder it is renaming away from", () => {
    expect(slugForName("First video", ["something-else"])).toBe("first-video");
  });
});
