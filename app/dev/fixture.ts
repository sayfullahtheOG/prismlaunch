import { blankProjectFile } from "@/lib/studio/blank";
import { snapshotBeats } from "@/lib/studio/process";
import { DEFAULT_MOTION, FilmProjectSchema, STAGES } from "@/lib/studio/schema";
import type {
  Clip,
  Element,
  FilmProject,
  Process,
  ProjectFile,
  StageId,
  StoryboardPanel,
} from "@/types/prism";

/**
 * An invented film, at three moments.
 *
 * Development only — see app/dev/page.tsx. Validated on the way out, so a
 * fixture that drifts from the schema fails loudly here rather than
 * rendering half a panel.
 *
 *   brief   — nothing approved; the brief just arrived.
 *   boards  — script approved; the storyboard is waiting for review.
 *   build   — timing locked; the look is defined as elements and the style
 *             frames are waiting for review; two of the agent's clips are
 *             unreviewed.
 */
export type DevState = "brief" | "boards" | "build";

const FPS = 30;

const PANELS: StoryboardPanel[] = [
  {
    id: "p1",
    beatId: "b1",
    label: "Hook",
    frame: "Black ground. One line of display type, centred, slightly below the middle. Nothing else.",
    action: "Rises 12px and settles. Holds.",
    durationInFrames: 66,
    transitionIn: "rise",
    transitionOut: "fade",
    sound: "Room tone only; the first downbeat lands on the cut out.",
    words: "Six clicks to assign an issue.",
  },
  {
    id: "p2",
    beatId: "b2",
    label: "Turn",
    frame: "Same ground. The line is replaced by a single word, larger, same axis.",
    action: "Hard cut in on the downbeat. Scale from 0.94.",
    durationInFrames: 36,
    transitionIn: "scale",
    transitionOut: "fade",
    sound: "Music enters: low pulse, 120 BPM.",
    words: "One.",
  },
  {
    id: "p3",
    beatId: "b3",
    label: "Reveal",
    frame: "The product name, display, very large. A hairline accent rule beneath it.",
    action: "Name scales in; the rule draws left to right 8 frames later.",
    durationInFrames: 60,
    transitionIn: "scale",
    transitionOut: "fade",
    sound: "Pulse opens up; a soft impact on the name.",
    words: "Vector",
  },
  {
    id: "p4",
    beatId: "b4",
    label: "Proof 1",
    frame: "A screenshot of the assign shortcut, centred, in a device frame with a 16px radius. A caption in body type below.",
    action: "Screenshot slides in from the right, caption fades 10 frames later.",
    durationInFrames: 72,
    transitionIn: "slide-left",
    transitionOut: "fade",
    sound: "A UI tick on the shortcut.",
    words: "Press A. Type a name.",
  },
  {
    id: "p5",
    beatId: "b5",
    label: "Proof 2",
    frame: "Second screenshot: the issue, assigned. Same frame, same position.",
    action: "Cut. The caption changes; the frame stays.",
    durationInFrames: 54,
    transitionIn: "fade",
    transitionOut: "fade",
    sound: "Second tick, a fifth higher.",
    words: "Done.",
  },
  {
    id: "p6",
    beatId: "b6",
    label: "Endcard",
    frame: "Ground darkens. Name small at the top, the one line of body type at the centre, the URL in mono below.",
    action: "Everything fades up together, staggered 6 frames. Holds to black.",
    durationInFrames: 90,
    transitionIn: "fade",
    transitionOut: "none",
    sound: "Music resolves and holds a low note under the endcard.",
    words: "Issues, at the speed of thought.",
  },
];

function filled(process: Process): Process {
  return {
    ...process,
    brief: {
      ...process.brief,
      audience: "Engineering leads at 20–200 person startups who live in Linear",
      message: "Assigning an issue should take one keystroke",
      feeling: "relief",
      lengthSeconds: 15,
      truth: "Every other tracker makes assignment a form. Vector makes it a key.",
      demoMoment: "Press A, type two letters of a name, it is assigned.",
      summary: "One audience, one message. The demo moment is the A key.",
    },
    concept: {
      ...process.concept,
      directions: [
        {
          id: "c1",
          title: "The cost",
          line: "Open on how many clicks the old way costs, then show the one key.",
          angle: "the enemy",
          feel: "relief",
          score: 11,
        },
        {
          id: "c2",
          title: "Before / after",
          line: "Split the frame: a form on the left, a keystroke on the right.",
          angle: "before/after",
          feel: "envy",
          score: 8,
        },
        {
          id: "c3",
          title: "The speed",
          line: "A single unbroken shot of twelve issues assigned in ten seconds.",
          angle: "the contrast",
          feel: "awe",
          score: 7,
        },
      ],
      recommended: "c1",
      chosen: "c1",
      summary: "Twelve angles, three kept. The cost angle lands the feeling with the fewest frames.",
    },
    script: {
      ...process.script,
      beats: PANELS.map((panel, index) => ({
        id: `b${index + 1}`,
        label: panel.label,
        words: panel.words ?? "",
        seconds: Number((panel.durationInFrames / FPS).toFixed(1)),
        ...(panel.sound ? { sound: panel.sound } : {}),
      })),
      summary: "Six beats, 12.6s. Read aloud at 11.9s.",
    },
    storyboard: {
      ...process.storyboard,
      panels: PANELS,
      summary: "Boarded first and last, then filled. Two screenshots, both the same frame.",
    },
  };
}

function through(stage: StageId | null, next?: StageId): Process {
  const process = filled(structuredClone(blankProjectFile("x").process));
  if (stage) {
    for (const id of STAGES) {
      process[id].status = "approved";
      if (id === stage) break;
    }
  }
  if (next) process[next].status = "submitted";
  return process;
}

function board(panel: StoryboardPanel, from: number): Clip {
  return {
    kind: "text",
    id: `board-${panel.id}`,
    from,
    durationInFrames: panel.durationInFrames,
    approval: "accepted",
    label: panel.label,
    revisionNote: `Board: ${panel.frame}`,
    text: panel.words ?? panel.label,
    fontSize: 0.07,
    fontFamily: "mono",
    fontWeight: 400,
    color: "#F7F8F899",
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    revealStagger: 0,
    revealStyle: "rise",
    radius: 0,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.47, width: 0.8, height: 0.3, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: {
      enter: panel.transitionIn,
      exit: panel.transitionOut,
      enterFrames: 10,
      exitFrames: 6, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  };
}

function boards(): Clip[] {
  let cursor = 0;
  return PANELS.map((panel) => {
    const clip = board(panel, cursor);
    cursor += panel.durationInFrames;
    return clip;
  });
}

const ELEMENTS: Element[] = [
  {
    kind: "text",
    id: "el-headline",
    name: "Headline",
    role: "type",
    fontSize: 0.09,
    fontFamily: "display",
    fontWeight: 400,
    color: "#F5F5F7",
    align: "center",
    lineHeight: 1.1,
    letterSpacing: -0.02,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    revealStagger: 0,
    revealStyle: "rise",
    radius: 0,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.52, width: 0.8, height: 0.2, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: { enter: "rise", exit: "fade", enterFrames: 14, exitFrames: 8, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  },
  {
    kind: "text",
    id: "el-hero",
    name: "Hero word",
    role: "type",
    fontSize: 0.24,
    fontFamily: "display",
    fontWeight: 400,
    color: "#FFFFFF",
    align: "center",
    lineHeight: 1,
    letterSpacing: -0.04,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    revealStagger: 0,
    revealStyle: "rise",
    radius: 0,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.48, width: 0.9, height: 0.3, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: { enter: "scale", exit: "fade", enterFrames: 14, exitFrames: 10, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  },
  {
    kind: "text",
    id: "el-support",
    name: "Support",
    role: "type",
    fontSize: 0.042,
    fontFamily: "body",
    fontWeight: 500,
    color: "#F5F5F7B3",
    align: "center",
    lineHeight: 1.3,
    letterSpacing: 0,
    reveal: "none",
    revealFrames: 30,
    caret: false,
    revealStagger: 0,
    revealStyle: "rise",
    radius: 0,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.78, width: 0.7, height: 0.1, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: { enter: "fade", exit: "fade", enterFrames: 10, exitFrames: 8, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  },
  {
    kind: "shape",
    id: "el-rule",
    name: "Accent rule",
    role: "motif",
    shape: "rect",
    fill: "#7C6CFF",
    radius: 0.5,
    fillAngle: 180,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.62, width: 0.08, height: 0.006, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: { enter: "fade", exit: "fade", enterFrames: 10, exitFrames: 10, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  },
  {
    kind: "image",
    id: "el-app",
    name: "Assign shortcut",
    role: "product",
    src: "assets/assign.png",
    fit: "cover",
    radius: 0.04,
    shadow: 0,
    glow: 0,
    blur: 0,
    box: { x: 0.5, y: 0.5, width: 0.7, height: 0.6, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
    animation: { enter: "slide-left", exit: "fade", enterFrames: 14, exitFrames: 10, travel: 0.03, spring: 0 },
    motion: { ...DEFAULT_MOTION },
  },
  {
    kind: "audio",
    id: "el-bed",
    name: "Music bed",
    role: "sound",
    src: "assets/bed.mp3",
    startFrom: 0,
    volume: 0.7,
    fadeInFrames: 20,
    fadeOutFrames: 45,
    playbackRate: 1,
  },
];

function buildFile(): ProjectFile {
  const base = blankProjectFile("Vector launch film");
  const total = PANELS.reduce((n, panel) => n + panel.durationInFrames, 0);
  const process = through("animatic", "style");
  process.style = {
    ...process.style,
    look: "void",
    elementIds: ELEMENTS.map((element) => element.id),
    clipIds: ["text-hook", "text-name", "text-turn"],
    summary: "Void look. Three type roles, one accent, the product in a soft-cornered frame. Hook, turn and reveal built for real.",
  };

  const withBoards: ProjectFile = {
    ...base,
    durationInFrames: total,
    background: { kind: "gradient", from: "#0A0A0C", to: "#15151B", angle: 160 },
    process,
    elements: ELEMENTS,
    tracks: [
      {
        id: "track-titles",
        kind: "visual",
        name: "Titles",
        hidden: false,
        locked: false,
        volume: 1,
        clips: [
          {
            kind: "text",
            id: "text-hook",
            from: 0,
            durationInFrames: 66,
            approval: "accepted",
            label: "Hook",
            elementId: "el-headline",
            text: "Six clicks to assign an issue.",
            fontSize: 0.09,
            fontFamily: "display",
            fontWeight: 400,
            color: "#F5F5F7",
            align: "center",
            lineHeight: 1.1,
            letterSpacing: -0.02,
            reveal: "none",
            revealFrames: 30,
            caret: false,
            revealStagger: 0,
            revealStyle: "rise",
            radius: 0,
            shadow: 0,
            glow: 0,
            blur: 0,
            box: { x: 0.5, y: 0.52, width: 0.8, height: 0.2, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
            animation: { enter: "rise", exit: "fade", enterFrames: 14, exitFrames: 8, travel: 0.03, spring: 0 },
            motion: { ...DEFAULT_MOTION },
          },
          {
            kind: "text",
            id: "text-turn",
            from: 66,
            durationInFrames: 36,
            approval: "draft",
            label: "Turn",
            elementId: "el-hero",
            revisionNote: "The turn: one word, large, on the downbeat.",
            text: "One.",
            fontSize: 0.22,
            fontFamily: "display",
            fontWeight: 400,
            color: "#FFFFFF",
            align: "center",
            lineHeight: 1,
            letterSpacing: -0.04,
            reveal: "none",
            revealFrames: 30,
            caret: false,
            revealStagger: 0,
            revealStyle: "rise",
            radius: 0,
            shadow: 0,
            glow: 0,
            blur: 0,
            box: { x: 0.5, y: 0.5, width: 0.9, height: 0.3, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
            animation: { enter: "scale", exit: "fade", enterFrames: 10, exitFrames: 8, travel: 0.03, spring: 0 },
            motion: { ...DEFAULT_MOTION },
          },
          {
            kind: "text",
            id: "text-name",
            from: 102,
            durationInFrames: 60,
            approval: "draft",
            label: "Reveal",
            elementId: "el-hero",
            revisionNote: "The name. Scale from 0.94, the rule follows on the Accent layer.",
            text: "Vector",
            fontSize: 0.26,
            fontFamily: "display",
            fontWeight: 400,
            color: "#FFFFFF",
            align: "center",
            lineHeight: 1,
            letterSpacing: -0.04,
            reveal: "none",
            revealFrames: 30,
            caret: false,
            revealStagger: 0,
            revealStyle: "rise",
            radius: 0,
            shadow: 0,
            glow: 0,
            blur: 0,
            box: { x: 0.5, y: 0.46, width: 0.9, height: 0.3, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
            animation: { enter: "scale", exit: "fade", enterFrames: 16, exitFrames: 12, travel: 0.03, spring: 0 },
            motion: { ...DEFAULT_MOTION },
          },
        ],
      },
      {
        id: "track-accent",
        kind: "visual",
        name: "Accent",
        hidden: false,
        locked: false,
        volume: 1,
        clips: [
          {
            kind: "shape",
            id: "shape-rule",
            from: 110,
            durationInFrames: 52,
            approval: "accepted",
            label: "rule",
            elementId: "el-rule",
            shape: "rect",
            fill: "#7C6CFF",
            radius: 0.5,
            fillAngle: 180,
            shadow: 0,
            glow: 0,
            blur: 0,
            box: { x: 0.5, y: 0.62, width: 0.08, height: 0.006, rotation: 0, opacity: 1, tiltX: 0, tiltY: 0 },
            animation: { enter: "fade", exit: "fade", enterFrames: 10, exitFrames: 10, travel: 0.03, spring: 0 },
            motion: { ...DEFAULT_MOTION },
          },
        ],
      },
      {
        id: "track-boards",
        kind: "visual",
        name: "Boards",
        hidden: false,
        locked: true,
        volume: 1,
        clips: boards(),
      },
      {
        id: "audio-music",
        kind: "audio",
        name: "Music",
        hidden: false,
        locked: false,
        volume: 1,
        clips: [
          {
            kind: "audio",
            id: "audio-bed",
            from: 0,
            durationInFrames: total,
            approval: "accepted",
            label: "bed 120bpm",
            elementId: "el-bed",
            src: "assets/bed.mp3",
            startFrom: 0,
            volume: 0.7,
            fadeInFrames: 20,
            fadeOutFrames: 45,
            playbackRate: 1,
          },
        ],
      },
    ],
  };

  // Lock the timing the way approving the animatic does: snapshot the boards.
  return {
    ...withBoards,
    process: {
      ...withBoards.process,
      animatic: {
        ...withBoards.process.animatic,
        beats: snapshotBeats({
          ...withBoards,
          tracks: withBoards.tracks.filter((track) => track.id === "track-boards"),
        }),
      },
    },
  };
}

export function devFilm(state: DevState): FilmProject {
  let file: ProjectFile;

  if (state === "brief") {
    file = { ...blankProjectFile("Vector launch film"), process: through(null, "brief") };
  } else if (state === "boards") {
    file = {
      ...blankProjectFile("Vector launch film"),
      process: through("script", "storyboard"),
    };
  } else {
    file = buildFile();
  }

  return FilmProjectSchema.parse({
    file,
    slug: "vector-launch-film",
    selection: null,
    activity: [
      {
        id: "ev-1",
        origin: "disk",
        label: "Opened from folder",
        detail: ".prismlaunch/vector-launch-film/project.json",
        at: "14:02:11",
      },
      {
        id: "ev-2",
        origin: "agent",
        label: "prism.submit_brief",
        detail: "One audience, one message. The demo moment is the A key.",
        at: "14:03:40",
      },
      {
        id: "ev-3",
        origin: "human",
        label: "Approved brief",
        detail: "",
        at: "14:05:02",
      },
    ],
  });
}
