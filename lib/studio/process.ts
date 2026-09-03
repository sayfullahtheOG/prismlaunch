import { STAGES } from "./schema";
import type { Clip, Process, ProjectFile, StageId } from "@/types/prism";

/**
 * The pipeline's rules, as pure functions.
 *
 * Which stage is current, what the agent is allowed to do there, and whether a
 * clip fits the timing lock. No store, no side effects — `actions.ts` asks
 * these questions and refuses or proceeds; the Process panel asks them to
 * decide what to draw.
 */

export const STAGE_LABELS: Record<StageId, string> = {
  brief: "Brief",
  concept: "Concept",
  script: "Script",
  storyboard: "Storyboard",
  animatic: "Animatic",
  style: "Style frames",
  polish: "Polish",
  build: "Build",
};

/** One line per stage on what it is for, for the panel and the agent. */
export const STAGE_PURPOSE: Record<StageId, string> = {
  brief: "Who is watching, the one message, the one feeling, and how long.",
  concept: "Three directions, one of them recommended. Everything after this serves the idea you pick.",
  script: "The beats and their words, timed. Read aloud with a stopwatch.",
  storyboard: "One panel per beat: what is in the frame, what moves, how long it holds, how it enters and leaves, and what the sound does. The film before it exists.",
  style: "The look, defined as elements (the type roles, the accent, the device, the product), with two or three beats built from them for real.",
  animatic: "The boards laid on the real timeline, cut to the real music. Approving this locks the timing.",
  polish: "The rough, reviewed: the sound rethought against your notes, and the checklist run. The last look before the build.",
  build: "Every beat built final inside its locked window, in the approved look, with the sound placed. Then the render.",
};

export function stageIndex(stage: StageId): number {
  return STAGES.indexOf(stage);
}

/** The first stage that is not approved, or null when the whole process is. */
export function currentStage(process: Process): StageId | null {
  for (const stage of STAGES) {
    if (process[stage].status !== "approved") return stage;
  }
  return null;
}

export function isApproved(process: Process, stage: StageId): boolean {
  return process[stage].status === "approved";
}

/** Every stage before this one is approved. */
export function previousApproved(process: Process, stage: StageId): boolean {
  const index = stageIndex(stage);
  return STAGES.slice(0, index).every((earlier) => isApproved(process, earlier));
}

/**
 * Whether an agent may put clips on the timeline yet.
 *
 * Clips exist from the animatic onward — that stage IS placing clips. Before
 * it there is nothing to place: no approved storyboard means no boards, and a
 * clip without a board is a guess. The person can always add clips; this only
 * gates the tools.
 */
export function agentMayPlaceClips(process: Process): boolean {
  return previousApproved(process, "style");
}

/**
 * Whether an agent may define elements yet.
 *
 * Elements are the style stage's artifact — the type roles, the accent, the
 * device frame — and the style stage follows the storyboard: the approved
 * boards say what pieces the film needs, and only then is an element a
 * decision about a real film. Once every element exists, the animatic lays
 * the cut and locks the timing they animate inside.
 */
export function agentMayShapeElements(process: Process): boolean {
  return previousApproved(process, "style");
}

/** The stage the agent should be working on, and what it should do there. */
export function nextInstruction(process: Process): {
  stage: StageId | null;
  status: string;
  instruction: string;
} {
  const stage = currentStage(process);
  if (stage === null) {
    return {
      stage: null,
      status: "approved",
      instruction:
        "Every stage is approved. Run the pre-ship checklist in PRISM_METHOD.md §14 once more, then prism.request_render.",
    };
  }

  const state = process[stage];
  const label = STAGE_LABELS[stage];

  if (state.status === "changes-requested") {
    return {
      stage,
      status: state.status,
      instruction: `The person sent ${label} back${state.note ? `: “${state.note}”` : ""}. Address that and resubmit with prism.submit_${stage}.`,
    };
  }

  if (state.status === "submitted") {
    return {
      stage,
      status: state.status,
      instruction: `${label} is submitted and open for the person in PrismLaunch. Do not build past it and do not poll: tell them it is waiting for their review, END YOUR TURN, and ask them to message you once they have approved it or sent it back. When they do, read the decision here.`,
    };
  }

  const how: Record<StageId, string> = {
    brief: "Write the brief with prism.submit_brief: one audience, one message, one feeling, one length. PRISM_METHOD.md §2.",
    concept: "Generate 8 to 12 angles, keep three, recommend one. Submit with prism.submit_concepts. PRISM_METHOD.md §3.",
    script: "Write the beats with their words and seconds; read it aloud against the length. Submit with prism.submit_script. PRISM_METHOD.md §5.",
    storyboard: "Board every script beat: frame, action, durationInFrames, transition in and out, sound, words. Board the first beat, then the last, then fill in between. Submit with prism.submit_storyboard. PRISM_METHOD.md §6.",
    style: "Pick a look from PRISM_METHOD.md §7. Define every piece the approved boards need as elements with prism.add_element (Headline, Support, Label, the accent, the device frame, the product shot), then build the hook, the reveal and the endcard for real by placing them with prism.place_element at the boards' times. Submit with prism.submit_style_frames, naming the elements and the clips.",
    animatic: "Choose the music first (PRISM_METHOD.md §9). Call prism.lay_animatic to put the approved boards on the timeline as placeholders beside what you built, then prism.add_audio the music with startFrom on a downbeat, adjust boards to the beat grid, then prism.submit_animatic. Approving locks the timing.",
    polish: "Watch the animatic through with the person's notes in hand. Rethink the sound (PRISM_METHOD.md §9): effects on the transitions, ducking under any voice, room tone. Run the §14 checklist against the rough — sound on, muted, half size — and submit each line with its verdict via prism.submit_polish, with the updated sound plan.",
    build: "Replace every remaining placeholder by placing the approved elements with prism.place_element, inside their windows, and place the final sound from the polish plan. Change an element, not its clips, when the look needs adjusting. Submit with prism.submit_build; after the person approves it, prism.request_render. PRISM_METHOD.md §10.",
  };

  return { stage, status: state.status, instruction: how[stage] };
}

// ---------------------------------------------------------------------------
// The timing lock
// ---------------------------------------------------------------------------

export function timingLocked(process: Process): boolean {
  return process.animatic.status === "approved" && process.animatic.beats.length > 0;
}

/**
 * Snapshot the timeline's visual clips as beats.
 *
 * Called on animatic approval. Each visual clip on the timeline at that moment
 * becomes a window; the agent may later fill a window with as many clips as it
 * likes, but not place one across a boundary or outside all of them.
 */
export function snapshotBeats(file: ProjectFile): Process["animatic"]["beats"] {
  return file.tracks
    .filter((track) => track.kind === "visual")
    .flatMap((track) => track.clips)
    .sort((a, b) => a.from - b.from)
    .map((clip) => ({
      id: `beat-${clip.id}`,
      label: clip.label ?? clipWords(clip),
      from: clip.from,
      durationInFrames: clip.durationInFrames,
    }));
}

/**
 * Does a visual clip sit inside one locked beat?
 *
 * Audio is exempt: a music bed spans the whole film and a riser crosses a cut
 * on purpose. Only picture is held to the boards.
 */
export function fitsLockedBeats(process: Process, clip: Clip): boolean {
  if (clip.kind === "audio") return true;
  if (!timingLocked(process)) return true;

  const end = clip.from + clip.durationInFrames;
  return process.animatic.beats.some(
    (beat) => clip.from >= beat.from && end <= beat.from + beat.durationInFrames,
  );
}

/** The locked beat a clip belongs to, for messages and the timeline bands. */
export function beatFor(
  process: Process,
  clip: Pick<Clip, "from" | "durationInFrames">,
): Process["animatic"]["beats"][number] | undefined {
  const end = clip.from + clip.durationInFrames;
  return process.animatic.beats.find(
    (beat) => clip.from >= beat.from && end <= beat.from + beat.durationInFrames,
  );
}

function clipWords(clip: Clip): string {
  switch (clip.kind) {
    case "text":
      return clip.text.slice(0, 40);
    case "shape":
      return clip.shape;
    default:
      return clip.src.split("/").pop() ?? clip.kind;
  }
}
