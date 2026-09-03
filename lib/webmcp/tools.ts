import type { z } from "zod";
import {
  captureFrames,
  confirmRender,
  createClip,
  createElement,
  createProject,
  createTrack,
  deleteClip,
  deleteElement,
  flushWrites,
  getProjectContext,
  openProject,
  patchClip,
  patchElement,
  patchTrack,
  placeElement,
  requestRender,
  seek,
  setBackground,
  setCamera,
  setDuration,
  setPlaying,
  shiftTrack,
  submitAnimatic,
  submitBrief,
  submitBuild,
  submitConcepts,
  submitPolish,
  submitScript,
  submitStoryboard,
  submitStyleFrames,
  layAnimatic,
  waitForDecision,
  type ActionResult,
} from "@/lib/studio/actions";
import {
  DEFAULT_ANIMATION,
  DEFAULT_BOX,
  DEFAULT_MOTION,
  explainZodError,
  toolInputJsonSchema,
} from "@/lib/studio/schema";
import {
  AddAudioInput,
  AddDeviceInput,
  AddElementInput,
  AddFromLibraryInput,
  AddIconInput,
  AddImageInput,
  AddParticlesInput,
  AddShapeInput,
  AddTextInput,
  AddTrackInput,
  AddVideoInput,
  CaptureFramesInput,
  ConfirmRenderInput,
  CreateProjectInput,
  EmptyInput,
  MoveTrackInput,
  OpenProjectInput,
  PlaceElementInput,
  PreviewInput,
  RemoveClipInput,
  RemoveElementInput,
  RequestRenderInput,
  SeekInput,
  SetBackgroundInput,
  SetCameraInput,
  SetDurationInput,
  SubmitAnimaticInput,
  SubmitBriefInput,
  SubmitBuildInput,
  SubmitConceptsInput,
  SubmitPolishInput,
  SubmitScriptInput,
  SubmitStoryboardInput,
  SubmitStyleFramesInput,
  LayAnimaticInput,
  TrackIdInput,
  UpdateClipInput,
  UpdateElementInput,
  UpdateTrackInput,
  WaitForDecisionInput,
} from "@/lib/studio/tool-inputs";
import { useStudioStore } from "@/lib/studio/store";
import { LIBRARY } from "@/lib/studio/library";
import type { Animation, Box, Clip, Element, ElementDraft, Motion } from "@/types/prism";
import type { JsonSchema, ModelContextTool } from "./types";

/**
 * The tools PrismLaunch registers on the studio page.
 *
 * Three rules hold across every one of them:
 *
 * 1. **Each tool wraps an existing action.** There is no tool-only code path,
 *    so anything an agent does produces exactly the visible result a human
 *    click would (context/architecture.md invariant 1).
 *
 * 2. **Each executor validates its own input.** Chrome does not check input
 *    against `inputSchema` — verified against a live implementation: missing
 *    required fields and unexpected properties reach the handler untouched.
 *    A validation failure returns a corrective sentence rather than throwing,
 *    because the agent can act on the former (invariant 8).
 *
 * 3. **Anything that writes flushes to disk before returning.** The film lives
 *    in the person's folder, so a tool that says it wrote something must have
 *    written it — an agent reading `project.json` on the next line has to find
 *    what it was just told about.
 *
 * These are tools, not a workflow. There is no `make_the_video` that takes a
 * brief and returns a finished film, because the app has no idea what makes a
 * good one — the agent does. What is offered is a canvas, layers, clips and a
 * playhead, and the agent decides what to build with them.
 *
 * An agent with file tools can skip most of this and write `project.json`
 * directly; the studio picks it up within a second. These exist so an agent
 * *without* file access is not locked out, and for the things a file cannot do
 * — moving the playhead, playing the composition on someone's screen.
 *
 * Descriptions are authored here as literals and never built from user content
 * (invariant 6).
 *
 * Notably absent: any tool that approves a stage or a render.
 * `acceptClip`, `rejectClip`, `acceptAllDrafts` and `approveRender` exist as
 * actions but are deliberately never wrapped, so the agent has no function to
 * call (invariant 2).
 */

type Executor<S extends z.ZodType> = (
  input: z.infer<S>,
) => Promise<ActionResult> | ActionResult;

function tool<S extends z.ZodType>(config: {
  name: string;
  description: string;
  schema: S;
  annotations?: ModelContextTool["annotations"];
  execute: Executor<S>;
}): ModelContextTool {
  return {
    name: config.name,
    description: config.description,
    inputSchema: toolInputJsonSchema(config.schema) as JsonSchema,
    ...(config.annotations ? { annotations: config.annotations } : {}),
    execute: async (raw) => {
      const parsed = config.schema.safeParse(raw ?? {});
      if (!parsed.success) {
        return `Invalid input — ${explainZodError(parsed.error)}`;
      }

      // Awaiting here is what guarantees the visible state has already changed
      // by the time the agent reads the result (invariant 3).
      const result = await config.execute(parsed.data);

      // …and this extends the same guarantee to the file on disk.
      if (config.annotations?.readOnlyHint !== true) await flushWrites();

      return result.ok ? result.message : `Could not do that — ${result.message}`;
    },
  };
}

/** The composition's fps, for tools that speak seconds. */
function fps(): number {
  return useStudioStore.getState().project?.file.fps ?? 30;
}

/**
 * Every key optional AND allowed to be explicitly undefined.
 *
 * This is the shape Zod's `.partial()` produces, and it is not `Partial<T>`
 * under `exactOptionalPropertyTypes` — the difference is exactly what `defined`
 * below erases.
 */
type Loose<T> = { [K in keyof T]?: T[K] | undefined };

/** Merge a partial box or animation onto the defaults, so agents can send one field. */
function visual(input: {
  box?: Loose<Box> | undefined;
  animation?: Loose<Animation> | undefined;
  motion?: Loose<Motion> | undefined;
  shadow?: number | undefined;
  glow?: number | undefined;
  blur?: number | undefined;
}): { box: Box; animation: Animation; motion: Motion; shadow: number; glow: number; blur: number } {
  return {
    box: { ...DEFAULT_BOX, ...defined(input.box ?? {}) },
    animation: { ...DEFAULT_ANIMATION, ...defined(input.animation ?? {}) },
    motion: { ...DEFAULT_MOTION, ...defined(input.motion ?? {}) },
    shadow: input.shadow ?? 0,
    glow: input.glow ?? 0,
    blur: input.blur ?? 0,
  };
}

/**
 * Drop undefined keys.
 *
 * `exactOptionalPropertyTypes` distinguishes "absent" from "present and
 * undefined", and an agent omitting an optional field produces the second. This
 * turns it into the first, which is what every action signature expects.
 */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function defined<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Defined<T>;
}

export function buildTools(): ModelContextTool[] {
  return [
    tool({
      name: "prism.get_project_context",
      description:
        "Where things stand: whether the person has linked a project folder, which compositions are in it, and — if one is open — its canvas, every track front to back, every clip with its id and timing, the playhead, and where the process stands. Call this first, and again after anything you are not sure landed.",
      schema: EmptyInput,
      annotations: { readOnlyHint: true },
      execute: () => ({ ok: true, message: JSON.stringify(getProjectContext()) }),
    }),

    tool({
      name: "prism.create_project",
      description:
        "Create an empty composition at .prismlaunch/<slug>/project.json and open it. You get a background, one visual track and one audio track, no clips and no runtime — it grows as you place things, so there is no length to guess. PrismLaunch writes no content. Needs a folder to be linked first.",
      schema: CreateProjectInput,
      execute: (input) =>
        createProject({
          slug: input.slug,
          name: input.name,
          ...defined({
            width: input.width,
            height: input.height,
            fps: input.fps,
            background: input.background,
          }),
          ...(input.durationSeconds
            ? {
                durationInFrames: Math.round(
                  input.durationSeconds * (input.fps ?? 30),
                ),
              }
            : {}),
        }),
    }),

    tool({
      name: "prism.open_project",
      description:
        "Show a composition that already exists in the linked folder, by its folder name. Use the slugs from get_project_context.",
      schema: OpenProjectInput,
      execute: (input) => openProject(input.slug),
    }),

    // ---- the process ---------------------------------------------------

    tool({
      name: "prism.submit_brief",
      description:
        "Stage 1 of 8. Submit the brief: one audience, one message, one feeling, one length — after asking the person for the product (logo, screenshots, brand colour). The person approves it in the Process panel before you go further. PRISM_METHOD.md §5.",
      schema: SubmitBriefInput,
      execute: ({ summary, ...brief }) => submitBrief(brief, summary),
    }),

    tool({
      name: "prism.submit_concepts",
      description:
        "Stage 2 of 8. Submit two to four directions with one recommended — generated from 8–12 angles, scored on the six tests, not the first idea. Refuses until the brief is approved. PRISM_METHOD.md §5.",
      schema: SubmitConceptsInput,
      execute: ({ summary, ...concept }) => submitConcepts(concept, summary),
    }),

    tool({
      name: "prism.submit_script",
      description:
        "Stage 3 of 8. Submit the lines and runs with their seconds — seconds that follow from what happens, never a budget filled with a headline — and the voiceover if there is one. Refuses until the concept is approved. PRISM_METHOD.md §1 and §6.",
      schema: SubmitScriptInput,
      execute: ({ summary, ...script }) => submitScript(script, summary),
    }),

    tool({
      name: "prism.submit_storyboard",
      description:
        "Stage 4 of 8. One panel per section, written as its events: what is in the frame, the events in order with their frames (action), what carries into the next panel (handoff), durationInFrames as the SUM of the events, transition in and out, what the sound does, the words. This is the film before it exists — the person reads it as boards. Refuses until the script is approved. PRISM_METHOD.md §2 and §10.",
      schema: SubmitStoryboardInput,
      execute: ({ summary, ...storyboard }) => submitStoryboard(storyboard, summary),
    }),

    tool({
      name: "prism.lay_animatic",
      description:
        "Put the approved storyboard on the timeline: one placeholder clip per panel, at cumulative frames from the panels' durations, with each panel's words and transitions. Does the frame arithmetic so you do not. Then add the music with prism.add_audio and call prism.submit_animatic. Refuses until the storyboard is approved; re-running replaces the placeholders.",
      schema: LayAnimaticInput,
      execute: () => layAnimatic(),
    }),

    tool({
      name: "prism.submit_animatic",
      description:
        "Stage 6 of 8. The animatic IS the timeline: the boards laid by prism.lay_animatic, adjusted to the beat grid, with the music underneath. Call this when it is laid out. Approving it LOCKS the length and the section starts — after that, clips may cross sections but not run past the end. Refuses until the storyboard is approved. PRISM_METHOD.md §10.",
      schema: SubmitAnimaticInput,
      execute: (input) => submitAnimatic(input.summary),
    }),

    tool({
      name: "prism.submit_style_frames",
      description:
        "Stage 5 of 8. Name the look and the two or three clips you built for real — the hook, the reveal, the endcard. Everything else will copy them. Refuses until the storyboard is approved. PRISM_METHOD.md §7.",
      schema: SubmitStyleFramesInput,
      execute: ({ summary, ...style }) => submitStyleFrames(style, summary),
    }),

    tool({
      name: "prism.submit_build",
      description:
        "Stage 8 of 8, the last. Every remaining placeholder replaced with real clips in the approved look — two events a second, the handoff object built as one clip across each cut, the product on screen most of the time — with the sound placed from the polish plan. Refuses until the polish is approved. After the person approves this, prism.request_render. PRISM_METHOD.md §10.",
      schema: SubmitBuildInput,
      execute: (input) => submitBuild(input.summary),
    }),

    tool({
      name: "prism.submit_polish",
      description:
        "Stage 7 of 8. The rough, reviewed before the build: rethink the sound against the person's notes (include the updated soundPlan), then run the §12 checklist against the animatic — sound on, muted, half size — and report it line by line with a verdict on each. Refuses until the animatic is approved. PRISM_METHOD.md §9 and §12.",
      schema: SubmitPolishInput,
      execute: ({ summary, ...polish }) => submitPolish(polish, summary),
    }),

    tool({
      name: "prism.wait_for_decision",
      description:
        "Read the person's decision on the stage you submitted — approved or sent back, their note, and what to do next. Call it ONCE when they ping you after a review (it also waits up to timeoutSeconds if they are mid-click). Do not use it to poll: after submitting, end your turn and ask them to message you when they have decided. Read-only.",
      schema: WaitForDecisionInput,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        waitForDecision({ stage: input.stage, timeoutSeconds: input.timeoutSeconds }),
    }),

    tool({
      name: "prism.add_track",
      description:
        "Add a layer. Visual tracks stack above the background — the first is nearest the viewer — and audio tracks sit below it for music, voiceover and effects. Clips on one track cannot overlap, so two things on screen at once means two tracks.",
      schema: AddTrackInput,
      execute: (input) => createTrack(input.kind, input.name),
    }),

    tool({
      name: "prism.update_track",
      description:
        "Rename a layer, hide it, or set its volume. Hiding a visual track removes it from the picture; hiding an audio track mutes it.",
      schema: UpdateTrackInput,
      execute: (input) =>
        patchTrack(
          input.trackId,
          defined({
            name: input.name,
            hidden: input.hidden,
            volume: input.volume,
          }),
        ),
    }),

    tool({
      name: "prism.move_track",
      description:
        "Move a layer forward or back in the stack. Visual layers cannot cross below the background, and audio layers cannot cross above it.",
      schema: MoveTrackInput,
      execute: (input) =>
        shiftTrack(input.trackId, input.direction === "forward" ? -1 : 1),
    }),

    tool({
      name: "prism.remove_track",
      description:
        "Delete a layer and every clip on it. Refuses if the person has locked it.",
      schema: TrackIdInput,
      execute: async (input) => {
        const { deleteTrack } = await import("@/lib/studio/actions");
        return deleteTrack(input.trackId);
      },
    }),

    tool({
      name: "prism.add_text",
      description:
        "Put words on screen. Position with `box` in canvas fractions — x/y are the CENTRE, so { x: 0.5, y: 0.5 } is centred. `fontSize` is a fraction of canvas height. Star a word (\"Turn *books* into audio\") and set `accent` for a two-tone line; `fill` with `radius` 0.5 makes it a button.",
      schema: AddTextInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "text",
            from: input.from,
            durationInFrames: input.durationInFrames,
            text: input.text,
            fontSize: input.fontSize ?? 0.09,
            fontFamily: input.fontFamily ?? "display",
            fontWeight: input.fontWeight ?? 600,
            color: input.color ?? "#F7F8F8",
            accent: input.accent,
            align: input.align ?? "center",
            lineHeight: input.lineHeight ?? 1.1,
            letterSpacing: input.letterSpacing ?? -0.02,
            reveal: input.reveal,
            revealFrames: input.revealFrames,
            revealStagger: input.revealStagger,
            revealStyle: input.revealStyle,
            caret: input.caret,
            fill: input.fill,
            radius: input.radius,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_shape",
      description:
        "Add a rectangle or ellipse — a colour block behind a title, a rule, a dot; with `fillTo`, a gradient bar. `enter: \"wipe\"` over 45 frames makes it a progress bar.",
      schema: AddShapeInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "shape",
            from: input.from,
            durationInFrames: input.durationInFrames,
            shape: input.shape,
            fill: input.fill ?? "#FFFFFF",
            fillTo: input.fillTo,
            fillAngle: input.fillAngle,
            radius: input.radius ?? 0,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_icon",
      description:
        "Add one of the studio's own icons — a check, an arrow, a sparkle, a cursor — crisp at any size, in any colour. `draw: true` draws an outlined icon on over its enter, like a pen: the check under \"Done\". Size it with `box`.",
      schema: AddIconInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "icon",
            from: input.from,
            durationInFrames: input.durationInFrames,
            icon: input.icon,
            color: input.color ?? "#F7F8F8",
            stroke: input.stroke ?? 2,
            draw: input.draw ?? false,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_particles",
      description:
        "Add particles: confetti bursting from a point, a burst in every direction, sparkles twinkling in a region, or dust rising through it. The clip's `box` is the emitter; its length is how long the burst lasts (40 frames for confetti). Deterministic from `seed`, so the export matches the preview. Once per film for confetti — on the payoff.",
      schema: AddParticlesInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "particles",
            from: input.from,
            durationInFrames: input.durationInFrames,
            style: input.style,
            count: input.count,
            colors: input.colors,
            spread: input.spread,
            gravity: input.gravity,
            size: input.size,
            seed: input.seed,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_device",
      description:
        "Add a device around a screenshot: a phone with a bezel and an island, a browser with three dots in its bar, a frameless window with a hairline, or a white card. `src` is the screenshot in the project folder; without it the screen is a colour. Tilt it with `box.tiltX`/`tiltY`, float it with `shadow`, fly it in with `animation.travel` and `spring`, and drift it with `motion`.",
      schema: AddDeviceInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "device",
            from: input.from,
            durationInFrames: input.durationInFrames,
            device: input.device ?? "browser",
            src: input.src,
            fit: input.fit ?? "cover",
            screen: input.screen,
            frame: input.frame,
            radius: input.radius,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_image",
      description:
        "Show an image from the project's own folder, e.g. 'assets/logo.png'. The file must already be there — put it in the folder with your file tools first, or ask the person to.",
      schema: AddImageInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "image",
            from: input.from,
            durationInFrames: input.durationInFrames,
            src: input.src,
            fit: input.fit ?? "cover",
            radius: input.radius ?? 0,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_video",
      description:
        "Show a video from the project's own folder, e.g. 'assets/demo.mp4'. `startFrom` trims its head. Silent by default — set `volume` if you want its sound.",
      schema: AddVideoInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "video",
            from: input.from,
            durationInFrames: input.durationInFrames,
            src: input.src,
            fit: input.fit ?? "cover",
            radius: 0,
            startFrom: input.startFrom ?? 0,
            volume: input.volume ?? 0,
            playbackRate: input.playbackRate ?? 1,
            label: input.label,
            ...visual(input),
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    tool({
      name: "prism.add_audio",
      description:
        "Add music, a voiceover or a sound effect from the project's own folder. Must go on an audio track. `fadeInFrames` and `fadeOutFrames` ramp the gain, which is how you duck music under a voiceover without editing the file.",
      schema: AddAudioInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "audio",
            from: input.from,
            durationInFrames: input.durationInFrames,
            src: input.src,
            startFrom: input.startFrom ?? 0,
            volume: input.volume ?? 1,
            fadeInFrames: input.fadeInFrames ?? 0,
            fadeOutFrames: input.fadeOutFrames ?? 0,
            playbackRate: input.playbackRate ?? 1,
            label: input.label,
          }) as Omit<Clip, "id">,
          "agent",
          input.note,
        ),
    }),

    // ---- elements ------------------------------------------------------

    tool({
      name: "prism.add_element",
      description:
        "Define a piece of the look, to be placed later: a type style (kind 'text' — Headline, Support, Label; leave `text` empty, the words arrive when it is placed), a shape (an accent rule, a block), an image or video from the project folder (a device frame, the product shot), or a sound. Elements are the style stage's artifact, right after the storyboard: the approved boards say what pieces the film needs. Define them, build the two or three style frames by placing them, and submit_style_frames names them. Refuses until the storyboard is approved. PRISM_METHOD.md §7.",
      schema: AddElementInput,
      execute: (input) => {
        const { kind, name, role, note, box, animation, motion, shadow, glow, blur, ...fields } = input;
        const identity = { name, ...defined({ role }) };
        const depth = visual({ box, animation, motion, shadow, glow, blur });
        const media = () =>
          fields.src
            ? { ok: true as const, src: fields.src }
            : {
                ok: false as const,
                message: `A ${kind} element needs \`src\` — the file's path inside the project folder, e.g. assets/app.png. Put the file there first.`,
              };

        let element: ElementDraft;
        switch (kind) {
          case "text":
            element = {
              kind,
              ...identity,
              ...defined({ text: fields.text, accent: fields.accent, fill: fields.fill }),
              fontSize: fields.fontSize ?? 0.09,
              fontFamily: fields.fontFamily ?? "display",
              fontWeight: fields.fontWeight ?? 600,
              color: fields.color ?? "#F7F8F8",
              align: fields.align ?? "center",
              lineHeight: fields.lineHeight ?? 1.1,
              letterSpacing: fields.letterSpacing ?? -0.02,
              reveal: fields.reveal ?? "none",
              revealFrames: fields.revealFrames ?? 30,
              revealStagger: fields.revealStagger ?? 0,
              revealStyle: fields.revealStyle ?? "rise",
              caret: fields.caret ?? false,
              radius: fields.radius ?? 0,
              ...depth,
            };
            break;
          case "shape":
            element = {
              kind,
              ...identity,
              ...defined({ fillTo: fields.fillTo }),
              shape: fields.shape ?? "rect",
              fill: fields.fill ?? "#FFFFFF",
              fillAngle: fields.fillAngle ?? 180,
              radius: fields.radius ?? 0,
              ...depth,
            };
            break;
          case "icon":
            element = {
              kind,
              ...identity,
              icon: fields.icon ?? "check",
              color: fields.color ?? "#F7F8F8",
              stroke: fields.stroke ?? 2,
              draw: fields.draw ?? false,
              ...depth,
            };
            break;
          case "particles":
            element = {
              kind,
              ...identity,
              style: fields.style ?? "confetti",
              count: fields.count ?? 80,
              colors: fields.colors ?? ["#5B8CFF", "#7CC7FF", "#F5A9E1"],
              spread: fields.spread ?? 0.6,
              gravity: fields.gravity ?? 1,
              size: fields.size ?? 0.016,
              seed: fields.seed ?? 1,
              ...depth,
            };
            break;
          case "device":
            element = {
              kind,
              ...identity,
              ...defined({ src: fields.src }),
              device: fields.device ?? "browser",
              fit: fields.fit ?? "cover",
              screen: fields.screen ?? "#FFFFFF",
              frame: fields.frame ?? "#111114",
              radius: fields.radius ?? 0.06,
              ...depth,
            };
            break;
          case "image": {
            const file = media();
            if (!file.ok) return { ok: false, code: "invalid-input", message: file.message };
            element = {
              kind,
              ...identity,
              src: file.src,
              fit: fields.fit ?? "cover",
              radius: fields.radius ?? 0,
              ...depth,
            };
            break;
          }
          case "video": {
            const file = media();
            if (!file.ok) return { ok: false, code: "invalid-input", message: file.message };
            element = {
              kind,
              ...identity,
              src: file.src,
              fit: fields.fit ?? "cover",
              radius: fields.radius ?? 0,
              startFrom: fields.startFrom ?? 0,
              volume: fields.volume ?? 0,
              playbackRate: fields.playbackRate ?? 1,
              ...depth,
            };
            break;
          }
          case "audio": {
            const file = media();
            if (!file.ok) return { ok: false, code: "invalid-input", message: file.message };
            element = {
              kind,
              ...identity,
              src: file.src,
              startFrom: fields.startFrom ?? 0,
              volume: fields.volume ?? 1,
              fadeInFrames: fields.fadeInFrames ?? 0,
              fadeOutFrames: fields.fadeOutFrames ?? 0,
              playbackRate: fields.playbackRate ?? 1,
            };
            break;
          }
        }
        return createElement(element, "agent", note);
      },
    }),

    tool({
      name: "prism.update_element",
      description:
        "Change an element — and every clip placed from it follows. Send only the fields you are changing. This is how the look is adjusted: the Headline's size once, not once per headline. The clips that follow it keep your note as provenance.",
      schema: UpdateElementInput,
      execute: (input) => {
        const { elementId, note, box, animation, motion, ...rest } = input;
        const patch = defined(rest) as Partial<Element>;

        const current = useStudioStore
          .getState()
          .project?.file.elements.find((element) => element.id === elementId);

        if (box && current && "box" in current) {
          (patch as { box: typeof current.box }).box = { ...current.box, ...defined(box) };
        }
        if (animation && current && "animation" in current) {
          (patch as { animation: typeof current.animation }).animation = {
            ...current.animation,
            ...defined(animation),
          };
        }
        if (motion && current && "motion" in current) {
          (patch as { motion: typeof current.motion }).motion = {
            ...current.motion,
            ...defined(motion),
          };
        }

        return patchElement(elementId, patch, "agent", note);
      },
    }),

    tool({
      name: "prism.remove_element",
      description:
        "Delete an element. Clips placed from it stay on the timeline, no longer linked to anything.",
      schema: RemoveElementInput,
      execute: (input) => deleteElement(input.elementId, "agent"),
    }),

    tool({
      name: "prism.add_from_library",
      description:
        "Add one of the studio's prebuilt pieces as an element of this film, exactly as the person clicking it in the Text, Shapes, Motion or Audio section would: a cursor that glides to a spot and clicks, a tap ring, a typewriter line, a word-by-word headline, a counter, a highlight, the type styles, the shapes, the sound effects and the music beds. Then place it with prism.place_element and tune it with prism.update_element. Refuses until the storyboard is approved, like add_element.",
      schema: AddFromLibraryInput,
      execute: (input) => {
        const item = LIBRARY.find((candidate) => candidate.id === input.itemId);
        if (!item) {
          return { ok: false, code: "not-found", message: `No library piece "${input.itemId}".` };
        }
        return createElement(
          { ...item.draft, name: input.name ?? item.draft.name },
          "agent",
          input.note ?? item.blurb,
        );
      },
    }),

    tool({
      name: "prism.place_element",
      description:
        "Put an element on the timeline as a clip: the element supplies the look, you supply the track, the first frame, the length, and — for a text style — the words. Obeys the timing lock like add_text. This is how the build should be done; add_text and friends are for things that are genuinely one-off.",
      schema: PlaceElementInput,
      execute: (input) => {
        const { elementId, trackId, from, durationInFrames, label, note, text, box, animation, motion } =
          input;
        return placeElement(
          elementId,
          trackId,
          {
            from,
            durationInFrames,
            ...defined({ label, text }),
            ...(box ? { box: defined(box) } : {}),
            ...(animation ? { animation: defined(animation) } : {}),
            ...(motion ? { motion: defined(motion) } : {}),
          },
          "agent",
          note,
        );
      },
    }),

    tool({
      name: "prism.update_clip",
      description:
        "Change one clip: any property it has, and trackId moves it to another layer. Send only the fields you are changing.",
      schema: UpdateClipInput,
      execute: (input) => {
        const { clipId, note, box, animation, motion, ...rest } = input;
        const patch = defined(rest) as Partial<Clip>;

        // Partial box, animation and motion merge onto what is already there,
        // so an agent nudging `y` does not reset the width someone tuned by hand.
        const current = useStudioStore.getState().project?.file.tracks
          .flatMap((track) => track.clips)
          .find((clip) => clip.id === clipId);

        if (box && current && "box" in current) {
          (patch as { box: typeof current.box }).box = {
            ...current.box,
            ...defined(box),
          };
        }
        if (animation && current && "animation" in current) {
          (patch as { animation: typeof current.animation }).animation = {
            ...current.animation,
            ...defined(animation),
          };
        }
        if (motion && current && "motion" in current) {
          (patch as { motion: typeof current.motion }).motion = {
            ...current.motion,
            ...defined(motion),
          };
        }

        return patchClip(clipId, patch, "agent", note);
      },
    }),

    tool({
      name: "prism.remove_clip",
      description: "Delete a clip. Refuses if its track is locked.",
      schema: RemoveClipInput,
      execute: (input) => deleteClip(input.clipId),
    }),

    tool({
      name: "prism.set_background",
      description:
        "Set the ground everything sits on — a solid colour or a two-stop gradient. Always present, always behind every visual layer.",
      schema: SetBackgroundInput,
      execute: (input) => setBackground(input.background),
    }),

    tool({
      name: "prism.set_camera",
      description:
        "Set the camera's moves, replacing the whole list. Every visual layer is drawn, then the camera looks at a point of the canvas at a zoom: a move says where it looks and how close by the time it is done, and it holds there until the next. Push into the button as the cursor reaches it (scale 1.6 over 18 frames), pull back to show the whole window. It starts at the centre at ×1; an empty list stills it. At most four moves in a film, none faster than 15 frames, and the thing being pushed into holds still while the camera moves.",
      schema: SetCameraInput,
      execute: (input) =>
        setCamera(
          input.moves.map((move) => ({
            from: move.from,
            frames: move.frames ?? 20,
            x: move.x ?? 0.5,
            y: move.y ?? 0.5,
            scale: move.scale ?? 1,
            easing: move.easing ?? "in-out",
          })),
          "agent",
        ),
    }),

    tool({
      name: "prism.set_duration",
      description:
        "Set how long the whole composition runs. It also grows on its own when you place a clip past the end, so you rarely need this before adding clips — mostly to trim afterwards.",
      schema: SetDurationInput,
      execute: (input) => setDuration(Math.round(input.durationSeconds * fps())),
    }),

    tool({
      name: "prism.seek",
      description:
        "Move the playhead, so the person is looking at the moment you are talking about. The preview follows it.",
      schema: SeekInput,
      annotations: { readOnlyHint: true },
      execute: (input) => seek(Math.round(input.seconds * fps())),
    }),

    tool({
      name: "prism.preview",
      description:
        "Play or pause the composition on the person's screen. Use it after you build something, so they watch it rather than reading your description of it.",
      schema: PreviewInput,
      annotations: { readOnlyHint: true },
      execute: (input) => {
        if (input.fromSeconds !== undefined) {
          seek(Math.round(input.fromSeconds * fps()));
        }
        return setPlaying(input.play);
      },
    }),

    /*
     * The one tool that does not go through `tool()`, because its result is
     * not a sentence: it is an image. Returned as MCP content — a text block
     * and an image block — which is what a WebMCP host passes to the model.
     * Read-only, so no flush.
     */
    {
      name: "prism.capture_frames",
      description:
        "See your own work. Renders exact frames of the open composition — the same pixels export produces, not a screenshot of a playing video — and returns them as storyboard sheets by default: six frames to a sheet, three across, read left to right then top to bottom, each cell captioned with its board number, time and frame. Pass `layout: \"single\"` for one full-width image per frame instead — to study one or two moments closely, or if a grid is hard to read. Ask for a cadence (`every` seconds, optionally between `from` and `to`) or exact moments (`at`). Use it after you build a section to check timing, overlap, legibility and easing before asking the person to look; when something is off, name the board and fix it. Up to 24 frames per call — six frames on one sheet is the cheapest look. Read-only.",
      inputSchema: toolInputJsonSchema(CaptureFramesInput) as JsonSchema,
      annotations: { readOnlyHint: true },
      execute: async (raw) => {
        const parsed = CaptureFramesInput.safeParse(raw ?? {});
        if (!parsed.success) {
          return `Invalid input — ${explainZodError(parsed.error)}`;
        }
        const result = await captureFrames(parsed.data);
        if (!result.ok) return `Could not do that — ${result.message}`;
        return {
          content: [
            { type: "text", text: result.message },
            ...result.images.map((image) => ({
              type: "image",
              data: image.base64,
              mimeType: image.mimeType,
            })),
          ],
        };
      },
    },

    tool({
      name: "prism.request_render",
      description:
        "Propose exporting the composition as an MP4. This renders NOTHING: it records what would be rendered and raises a confirmation in the app. The person must approve it, and only then can confirm_render proceed. The person's approval is the only thing that starts it.",
      schema: RequestRenderInput,
      execute: (input) => requestRender(input.reason),
    }),

    tool({
      name: "prism.confirm_render",
      description:
        "Start the render that request_render proposed, using the confirmation id it returned. This only works after the person has approved that confirmation in the app — the id alone is not permission, and retrying will not change that. The MP4 is encoded in their browser and saved into the project folder.",
      schema: ConfirmRenderInput,
      execute: (input) => confirmRender(input.confirmationId),
    }),
  ];
}
