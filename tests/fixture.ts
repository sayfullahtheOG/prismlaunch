import { EMPTY_PROCESS, PROJECT_FILE_VERSION, STAGES } from "@/lib/studio/schema";
import type { Clip, FilmProject, Process, ProjectFile, StageId, Track } from "@/types/prism";

/**
 * The shared test fixture.
 *
 * Hand-authored, and — with `remotion/Root.tsx` — one of only two invented
 * compositions in the codebase. The product ships no sample content: a film
 * comes from a person's own `.prismlaunch/<slug>/project.json`, written by
 * their agent. So a fixture is purely a test concern and lives here.
 *
 * 30fps, 300 frames, ten seconds.
 */

export const FPS = 30;

export function textClip(overrides: Partial<Clip> = {}): Clip {
  return {
    kind: "text",
    id: "clip-text",
    from: 0,
    durationInFrames: 60,
    approval: "accepted",
    text: "Most tools make you click.",
    fontSize: 0.09,
    fontFamily: "display",
    fontWeight: 600,
    color: "#FFFFFF",
    align: "center",
    lineHeight: 1.1,
    letterSpacing: -0.02,
    box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
    animation: { enter: "fade", exit: "fade", enterFrames: 10, exitFrames: 10 },
    ...overrides,
  } as Clip;
}

export function audioClip(overrides: Partial<Clip> = {}): Clip {
  return {
    kind: "audio",
    id: "clip-audio",
    from: 0,
    durationInFrames: 300,
    approval: "accepted",
    src: "assets/music.mp3",
    startFrom: 0,
    volume: 0.8,
    fadeInFrames: 15,
    fadeOutFrames: 30,
    playbackRate: 1,
    ...overrides,
  } as Clip;
}

export function visualTrack(clips: Clip[], overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    kind: "visual",
    name: "Titles",
    hidden: false,
    locked: false,
    volume: 1,
    clips,
    ...overrides,
  };
}

export function audioTrack(clips: Clip[], overrides: Partial<Track> = {}): Track {
  return {
    id: "audio-1",
    kind: "audio",
    name: "Music",
    hidden: false,
    locked: false,
    volume: 1,
    clips,
    ...overrides,
  };
}

/**
 * A process with every stage up to and including `through` approved.
 *
 * `null` leaves everything pending. The default fixture is approved through
 * the storyboard, because most tests are about what happens on the timeline
 * and the timeline only opens to an agent once the storyboard is — a fixture
 * that starts at the brief would have every clip test fail on the stage gate,
 * which is the gate working, not the thing under test.
 */
export function approvedThrough(through: StageId | null): Process {
  const process = structuredClone(EMPTY_PROCESS) as Process;
  if (through) {
    for (const stage of STAGES) {
      process[stage].status = "approved";
      if (stage === through) break;
    }
  }
  return process;
}

export function projectFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    name: "Vector launch video",
    width: 1920,
    height: 1080,
    fps: FPS,
    durationInFrames: 300,
    background: { kind: "solid", color: "#0A0A0C" },
    process: approvedThrough("storyboard"),
    tracks: [
      visualTrack([
        textClip({ id: "clip-a", from: 0, durationInFrames: 60 }),
        textClip({ id: "clip-b", from: 90, durationInFrames: 60 }),
      ]),
      audioTrack([audioClip()]),
    ],
    ...overrides,
  };
}

export function film(overrides: Partial<ProjectFile> = {}): FilmProject {
  return {
    file: projectFile(overrides),
    slug: "vector-launch",
    selection: null,
    activity: [],
  };
}
