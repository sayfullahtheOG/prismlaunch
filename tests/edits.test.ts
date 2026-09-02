import { describe, expect, it } from "vitest";
import {
  addTrack,
  duplicateClip,
  findClip,
  fitDuration,
  moveClip,
  moveTrack,
  referencedAssets,
  slotBounds,
  splitClip,
  trimClip,
  trimToContent,
} from "@/lib/studio/edits";
import { ProjectFileSchema } from "@/lib/studio/schema";
import { audioTrack, projectFile, textClip, visualTrack } from "./fixture";

/**
 * The timeline's real logic.
 *
 * Dragging, trimming and splitting are where an editor goes subtly wrong —
 * a clip that overlaps its neighbour, a split video that jumps back to its
 * first frame, a trim that slides instead of trimming. All of it is pure
 * functions on a composition, so all of it is testable without a browser, a
 * folder, or a pointer event.
 *
 * Several tests assert the result still parses. That is the property that
 * matters most: no drag, however wild, may produce a file the app cannot read
 * back.
 */

describe("slotBounds", () => {
  it("reports the gap between neighbours", () => {
    const file = projectFile();
    const track = file.tracks[0]!;

    // clip-a occupies 0–60, clip-b occupies 90–150. Asking about frame 75
    // should report the gap between them.
    const bounds = slotBounds(track, "none", 75);
    expect(bounds.min).toBe(60);
    expect(bounds.max).toBe(90);
  });

  it("ignores the clip being moved, so a clip can stay where it is", () => {
    const file = projectFile();
    const track = file.tracks[0]!;

    const bounds = slotBounds(track, "clip-a", 10);
    expect(bounds.min).toBe(0);
    expect(bounds.max).toBe(90);
  });
});

describe("moveClip", () => {
  it("moves a clip along its own track", () => {
    const file = moveClip(projectFile(), "clip-a", "track-1", 20);
    expect(findClip(file, "clip-a")?.clip.from).toBe(20);
  });

  /** Dragging well past a neighbour lands in the space beyond it, not on it. */
  it("drops into the gap after a clip it was dragged past", () => {
    const file = moveClip(projectFile(), "clip-a", "track-1", 200);
    expect(findClip(file, "clip-a")!.clip.from).toBe(200);
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });

  /**
   * The case the first implementation got wrong: a drop point *inside* another
   * clip is neither before it nor after it, and treating it as one produced
   * silently overlapping clips.
   */
  it("stops against a neighbour when dragged into it", () => {
    const file = moveClip(projectFile(), "clip-b", "track-1", -500);
    const clip = findClip(file, "clip-b")!.clip;

    expect(clip.from).toBe(60);
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });

  /**
   * The pipeline `commit` actually runs: move, then grow the composition to
   * fit. `moveClip` alone does not own the duration — dropping a clip past the
   * end is a legitimate way to lengthen a film — so asserting on its output in
   * isolation would be testing a contract it does not have.
   */
  it("never produces an overlap, wherever it is thrown", () => {
    for (const target of [-999, 0, 30, 61, 89, 120, 400, 99999]) {
      const file = fitDuration(
        moveClip(projectFile(), "clip-a", "track-1", target),
      );
      expect(
        ProjectFileSchema.safeParse(file).success,
        `dropping at ${target} produced an invalid file`,
      ).toBe(true);
    }
  });

  it("moves a clip to another visual track", () => {
    const base = projectFile({
      tracks: [
        visualTrack([textClip({ id: "clip-a", from: 0, durationInFrames: 60 })]),
        visualTrack([], { id: "track-2", name: "Overlay" }),
        audioTrack([]),
      ],
    });

    const file = moveClip(base, "clip-a", "track-2", 30);
    expect(findClip(file, "clip-a")?.track.id).toBe("track-2");
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });

  /**
   * The UI prevents this, but the backstop matters: one bad drop must not make
   * the whole file unreadable.
   */
  it("refuses to put a visual clip on an audio track", () => {
    const before = projectFile();
    const after = moveClip(before, "clip-a", "audio-1", 0);
    expect(findClip(after, "clip-a")?.track.id).toBe("track-1");
  });
});

describe("trimClip", () => {
  it("moves the start without moving the end", () => {
    const file = trimClip(projectFile(), "clip-a", "start", 20);
    const clip = findClip(file, "clip-a")!.clip;

    expect(clip.from).toBe(20);
    expect(clip.from + clip.durationInFrames).toBe(60);
  });

  it("moves the end without moving the start", () => {
    const file = trimClip(projectFile(), "clip-a", "end", 40);
    const clip = findClip(file, "clip-a")!.clip;

    expect(clip.from).toBe(0);
    expect(clip.durationInFrames).toBe(40);
  });

  it("never lets an edge cross the other one", () => {
    const file = trimClip(projectFile(), "clip-a", "start", 500);
    const clip = findClip(file, "clip-a")!.clip;
    expect(clip.durationInFrames).toBeGreaterThan(0);
  });

  it("stops at the neighbour rather than overlapping it", () => {
    const file = trimClip(projectFile(), "clip-a", "end", 500);
    const clip = findClip(file, "clip-a")!.clip;

    expect(clip.from + clip.durationInFrames).toBeLessThanOrEqual(90);
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });

  /**
   * Trimming the head of a media clip must reveal less of the source, not
   * retime it. Without the `startFrom` walk, dragging the left edge shows the
   * same first frame later — which looks like nothing happening.
   */
  it("walks startFrom so media keeps showing the same frames", () => {
    const base = projectFile({
      tracks: [
        audioTrack([
          {
            kind: "audio",
            id: "clip-audio",
            from: 0,
            durationInFrames: 120,
            approval: "accepted",
            src: "assets/music.mp3",
            startFrom: 30,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            playbackRate: 1,
          },
        ]),
      ],
    });

    const file = trimClip(base, "clip-audio", "start", 40);
    const clip = findClip(file, "clip-audio")!.clip;

    expect(clip.from).toBe(40);
    expect("startFrom" in clip && clip.startFrom).toBe(70);
  });

  it("never drives startFrom below zero", () => {
    const base = projectFile({
      tracks: [
        audioTrack([
          {
            kind: "audio",
            id: "clip-audio",
            from: 100,
            durationInFrames: 120,
            approval: "accepted",
            src: "assets/music.mp3",
            startFrom: 5,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            playbackRate: 1,
          },
        ]),
      ],
    });

    const file = trimClip(base, "clip-audio", "start", 0);
    const clip = findClip(file, "clip-audio")!.clip;
    expect("startFrom" in clip && clip.startFrom).toBe(0);
  });
});

describe("splitClip", () => {
  it("cuts one clip into two that meet exactly", () => {
    const result = splitClip(projectFile(), "clip-a", 25)!;
    expect(result).not.toBeNull();

    const left = findClip(result.file, "clip-a")!.clip;
    const right = findClip(result.file, result.newClipId)!.clip;

    expect(left.from).toBe(0);
    expect(left.durationInFrames).toBe(25);
    expect(right.from).toBe(25);
    expect(right.durationInFrames).toBe(35);
    expect(ProjectFileSchema.safeParse(result.file).success).toBe(true);
  });

  /** The bug every editor ships once: the right half restarting the source. */
  it("advances startFrom so the right half keeps playing where the left stopped", () => {
    const base = projectFile({
      tracks: [
        audioTrack([
          {
            kind: "audio",
            id: "clip-audio",
            from: 0,
            durationInFrames: 120,
            approval: "accepted",
            src: "assets/music.mp3",
            startFrom: 10,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            playbackRate: 1,
          },
        ]),
      ],
    });

    const result = splitClip(base, "clip-audio", 50)!;
    const right = findClip(result.file, result.newClipId)!.clip;
    expect("startFrom" in right && right.startFrom).toBe(60);
  });

  it("refuses a cut outside the clip", () => {
    expect(splitClip(projectFile(), "clip-a", 500)).toBeNull();
    expect(splitClip(projectFile(), "clip-a", 0)).toBeNull();
  });
});

describe("duplicateClip", () => {
  it("places the copy in the gap after the original", () => {
    const base = projectFile({
      tracks: [
        visualTrack([textClip({ id: "clip-a", from: 0, durationInFrames: 60 })]),
      ],
    });

    const result = duplicateClip(base, "clip-a")!;
    const copy = findClip(result.file, result.newClipId)!.clip;

    expect(copy.from).toBe(60);
    expect(ProjectFileSchema.safeParse(result.file).success).toBe(true);
  });

  it("skips a gap too small to hold the copy", () => {
    // clip-a is 0–60 and clip-b starts at 90, so the 30-frame gap between them
    // cannot take a 60-frame copy. It goes after clip-b instead of squeezing in.
    const result = duplicateClip(projectFile(), "clip-a")!;
    expect(findClip(result.file, result.newClipId)!.clip.from).toBe(150);
    expect(ProjectFileSchema.safeParse(result.file).success).toBe(true);
  });
});

describe("moveTrack", () => {
  it("swaps a track with its neighbour", () => {
    const base = projectFile({
      tracks: [
        visualTrack([], { id: "track-1", name: "One" }),
        visualTrack([], { id: "track-2", name: "Two" }),
      ],
    });

    const file = moveTrack(base, "track-2", -1);
    expect(file.tracks.map((track) => track.id)).toEqual(["track-2", "track-1"]);
  });

  /**
   * The background sits between the visual and audio groups, so "a title
   * behind the music" is not a position that exists. The move is a no-op
   * rather than an error — holding the arrow should not raise a dialog.
   */
  it("will not move a visual track past the audio group", () => {
    const base = projectFile({
      tracks: [visualTrack([], { id: "track-1" }), audioTrack([])],
    });

    expect(moveTrack(base, "track-1", 1)).toBe(base);
  });
});

describe("addTrack", () => {
  it("puts a new visual layer at the front", () => {
    const { file } = addTrack(projectFile(), "visual", "Overlay");
    expect(file.tracks[0]!.name).toBe("Overlay");
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });

  it("puts a new audio layer at the end, keeping the group order valid", () => {
    const { file } = addTrack(projectFile(), "audio", "Voiceover");
    expect(file.tracks[file.tracks.length - 1]!.name).toBe("Voiceover");
    expect(ProjectFileSchema.safeParse(file).success).toBe(true);
  });
});

describe("duration", () => {
  it("grows the composition to fit a clip placed past the end", () => {
    const base = projectFile({
      durationInFrames: 100,
      tracks: [
        visualTrack([textClip({ id: "clip-a", from: 200, durationInFrames: 60 })]),
      ],
    });

    expect(fitDuration(base).durationInFrames).toBe(260);
  });

  it("trims to where the content actually stops", () => {
    expect(trimToContent(projectFile()).durationInFrames).toBe(300);
  });
});

describe("an empty composition", () => {
  /**
   * A new composition is created with a runtime of one frame and no clips, so
   * nobody has to guess a length before they have made anything. That only
   * works if the schema accepts it — a minimum of one frame rather than zero is
   * the whole reason `durationInFrames` is `.min(1)`, and a future tightening
   * would silently break every new project.
   */
  it("is a valid file at one frame with nothing in it", () => {
    const blank = projectFile({
      durationInFrames: 1,
      tracks: [visualTrack([]), audioTrack([])],
    });

    expect(ProjectFileSchema.safeParse(blank).success).toBe(true);
  });

  it("grows to the first clip placed in it", () => {
    const blank = projectFile({
      durationInFrames: 1,
      tracks: [
        visualTrack([textClip({ id: "clip-a", from: 0, durationInFrames: 60 })]),
      ],
    });

    expect(fitDuration(blank).durationInFrames).toBe(60);
  });
});

describe("referencedAssets", () => {
  it("lists every path a clip points at, once", () => {
    const base = projectFile({
      tracks: [
        audioTrack([
          {
            kind: "audio",
            id: "a",
            from: 0,
            durationInFrames: 30,
            approval: "accepted",
            src: "assets/music.mp3",
            startFrom: 0,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            playbackRate: 1,
          },
          {
            kind: "audio",
            id: "b",
            from: 40,
            durationInFrames: 30,
            approval: "accepted",
            src: "assets/music.mp3",
            startFrom: 0,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            playbackRate: 1,
          },
        ]),
      ],
    });

    expect(referencedAssets(base)).toEqual(["assets/music.mp3"]);
  });
});
