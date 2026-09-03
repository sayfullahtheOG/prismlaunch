import { describe, expect, it } from "vitest";
import { referencedAssets } from "@/lib/studio/edits";
import { LIBRARY, LIVE_CARD_HTML } from "@/lib/studio/library";
import { ClipSchema, ElementSchema } from "@/lib/studio/schema";
import { AddHtmlInput } from "@/lib/studio/tool-inputs";
import { buildTools } from "@/lib/webmcp/tools";
import { liveHtml, sanitizeHtml } from "@/remotion/html";
import { projectFile, visualTrack } from "./fixture";

/**
 * A component from the product: rebuilt from its source as one snippet,
 * made safe, and made to move frame by frame. The film lives in a
 * repository, so a snippet is text anyone could have written; nothing in
 * it may run. And the export renders frame by frame, so its liveness has
 * to be a function of the frame, not of the clock.
 */

describe("sanitizeHtml", () => {
  it("removes anything that runs, loads, or navigates", () => {
    const dirty = `<div onclick="steal()" style="color:red"><script>alert(1)</script>
      <a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe>
      <img src="x" onerror="alert(1)"><style>@import url(evil.css); .a{color:blue}</style></div>`;
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/<script|<iframe|onclick|onerror|javascript:|@import/i);
    expect(clean).toContain('style="color:red"');
    expect(clean).toContain(".a{color:blue}");
    expect(clean).toContain('href="#"');
  });
});

describe("liveHtml", () => {
  const card = `<div class="card"><h3 data-in="10">Title</h3><span data-in="20 rise">Row</span><b data-count="0">1,200</b><p data-type="0">Hi</p><img src="assets/shot.png"><i data-press="30">Go</i></div>`;

  it("hides a part before its frame and settles it after", () => {
    const before = liveHtml(card, 0);
    expect(before).toMatch(/<h3 data-in="10" style="opacity:0\.0000;transform:scale\(1\.1200\);filter:blur\(5\.00px\)"/);
    const after = liveHtml(card, 40);
    expect(after).toMatch(/<h3 data-in="10" style="opacity:1\.0000"/);
    // An inline element gets display:inline-block so its transform applies.
    expect(liveHtml(card, 22)).toMatch(/<span data-in="20 rise" style="opacity:[\d.]+;transform:translateY\([\d.]+px\);display:inline-block"/);
  });

  it("counts, types, presses and resolves assets by the frame", () => {
    expect(liveHtml(card, 0)).toContain("<b data-count=\"0\">0</b>");
    expect(liveHtml(card, 60)).toContain("<b data-count=\"0\">1,200</b>");
    expect(liveHtml(card, 2)).toContain('<p data-type="0">H</p>');
    expect(liveHtml(card, 33)).toMatch(/<i data-press="30" style="opacity:1\.0000;transform:scale\(0\.9[\d]+\);display:inline-block"/);
    expect(liveHtml(card, 0, { "assets/shot.png": "blob:x" })).toContain('src="blob:x"');
    expect(liveHtml(card, 0)).toContain('src="assets/shot.png"');
  });

  it("keeps an existing inline style and appends its own", () => {
    const out = liveHtml(`<div style="color:red;" data-in="0 fade">x</div>`, 3);
    expect(out).toMatch(/style="color:red;opacity:0\.[\d]+"/);
  });

  it("is a pure function of the frame", () => {
    expect(liveHtml(LIVE_CARD_HTML, 17)).toBe(liveHtml(LIVE_CARD_HTML, 17));
    expect(liveHtml(LIVE_CARD_HTML, 17)).not.toBe(liveHtml(LIVE_CARD_HTML, 18));
  });
});

describe("in the file and the tools", () => {
  it("accepts an html clip and element, and finds the assets in its markup", () => {
    const clip = ClipSchema.parse({
      kind: "html",
      id: "c-card",
      from: 0,
      durationInFrames: 60,
      html: '<div><img src="assets/logo.png"></div>',
    });
    expect(clip.kind === "html" && clip.width).toBe(800);
    const element = ElementSchema.safeParse({ kind: "html", id: "el-card", name: "Card", html: LIVE_CARD_HTML, width: 520 });
    expect(element.success).toBe(true);

    const file = projectFile({ tracks: [visualTrack([clip])] });
    expect(referencedAssets(file)).toContain("assets/logo.png");
  });

  it("registers add_html and ships the live card", () => {
    expect(buildTools().map((tool) => tool.name)).toContain("prism.add_html");
    expect(AddHtmlInput.safeParse({ trackId: "t", from: 0, durationInFrames: 60, html: "<b>x</b>", width: 400 }).success).toBe(true);
    expect(AddHtmlInput.safeParse({ trackId: "t", from: 0, durationInFrames: 60 }).success).toBe(false);
    const piece = LIBRARY.find((item) => item.id === "live-card");
    expect(piece?.draft.kind).toBe("html");
  });
});
