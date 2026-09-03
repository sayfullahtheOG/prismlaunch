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
  setDuration,
  setPlaying,
  shiftTrack,
  submitAnimatic,
  submitBrief,
  submitBuild,
  submitConcepts,
  submitPolish,
  submitScript,
  submitSound,
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
  AddElementInput,
  AddFromLibraryInput,
  AddImageInput,
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
  SetDurationInput,
  SubmitAnimaticInput,
  SubmitBriefInput,
  SubmitBuildInput,
  SubmitConceptsInput,
  SubmitPolishInput,
  SubmitScriptInput,
  SubmitSoundInput,
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
 * Notably absent: any tool that accepts a draft or approves a render.
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
}): { box: Box; animation: Animation; motion: Motion } {
  return {
    box: { ...DEFAULT_BOX, ...defined(input.box ?? {}) },
    animation: { ...DEFAULT_ANIMATION, ...defined(input.animation ?? {}) },
    motion: { ...DEFAULT_MOTION, ...defined(input.motion ?? {}) },
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
        "Where things stand: whether the person has linked a project folder, which compositions are in it, and — if one is open — its canvas, every track front to back, every clip with its id and timing, the playhead, and which clips are still unreviewed drafts. Call this first, and again after anything you are not sure landed.",
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
        "Stage 1 of 9. Submit the brief: one audience, one message, one feeling, one length. The person approves it in the Process panel before you go further. PRISM_METHOD.md §2.",
      schema: SubmitBriefInput,
      execute: ({ summary, ...brief }) => submitBrief(brief, summary),
    }),

    tool({
      name: "prism.submit_concepts",
      description:
        "Stage 2 of 9. Submit two to four directions with one recommended — generated from 8–12 angles, scored on the six tests, not the first idea. Refuses until the brief is approved. PRISM_METHOD.md §3.",
      schema: SubmitConceptsInput,
      execute: ({ summary, ...concept }) => submitConcepts(concept, summary),
    }),

    tool({
      name: "prism.submit_script",
      description:
        "Stage 3 of 9. Submit the beats with their words and seconds, and the voiceover if there is one. Read it aloud against the length first. Refuses until the concept is approved. PRISM_METHOD.md §5.",
      schema: SubmitScriptInput,
      execute: ({ summary, ...script }) => submitScript(script, summary),
    }),

    tool({
      name: "prism.submit_storyboard",
      description:
        "Stage 4 of 9. One panel per script beat: what is in the frame, what moves, durationInFrames, transition in and out, what the sound does, the words. This is the film before it exists — the person reads it as boards. Refuses until the script is approved. PRISM_METHOD.md §6.",
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
        "Stage 5 of 9. The animatic IS the timeline: the boards laid by prism.lay_animatic, adjusted to the beat grid, with the music underneath. Call this when it is laid out. Approving it LOCKS the timing — after that, visual clips must sit inside the approved beats. Refuses until the storyboard is approved. PRISM_METHOD.md §6.",
      schema: SubmitAnimaticInput,
      execute: (input) => submitAnimatic(input.summary),
    }),

    tool({
      name: "prism.submit_style_frames",
      description:
        "Stage 6 of 9. Name the look and the two or three clips you built for real — the hook, the reveal, the endcard. Everything else will copy them. Refuses until the animatic is approved. PRISM_METHOD.md §7.",
      schema: SubmitStyleFramesInput,
      execute: ({ summary, ...style }) => submitStyleFrames(style, summary),
    }),

    tool({
      name: "prism.submit_build",
      description:
        "Stage 7 of 9. Every remaining placeholder replaced with real clips, inside their locked windows, in the approved look. Refuses until the style frames are approved. PRISM_METHOD.md §10.",
      schema: SubmitBuildInput,
      execute: (input) => submitBuild(input.summary),
    }),

    tool({
      name: "prism.submit_sound",
      description:
        "Stage 8 of 9. Effects on the transitions, ducking under any voice, room tone under everything. Include the filled-in sound plan. Refuses until the build is approved. PRISM_METHOD.md §9.",
      schema: SubmitSoundInput,
      execute: ({ summary, ...sound }) => submitSound(sound, summary),
    }),

    tool({
      name: "prism.submit_polish",
      description:
        "Stage 9 of 9. The §14 checklist, run and reported line by line with a verdict on each. Watched three times: sound on, muted, half size. After the person approves this, prism.request_render. PRISM_METHOD.md §11 and §14.",
      schema: SubmitPolishInput,
      execute: ({ summary, ...polish }) => submitPolish(polish, summary),
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
        "Put words on screen. Position with `box` in canvas fractions — x/y are the CENTRE, so { x: 0.5, y: 0.5 } is centred. `fontSize` is a fraction of canvas height. Lands as a DRAFT for the person to accept; you cannot accept it yourself.",
      schema: AddTextInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "text",
            from: input.from,
            durationInFrames: input.durationInFrames,
            approval: "draft",
            text: input.text,
            fontSize: input.fontSize ?? 0.09,
            fontFamily: input.fontFamily ?? "display",
            fontWeight: input.fontWeight ?? 600,
            color: input.color ?? "#F7F8F8",
            align: input.align ?? "center",
            lineHeight: input.lineHeight ?? 1.1,
            letterSpacing: input.letterSpacing ?? -0.02,
            reveal: input.reveal,
            revealFrames: input.revealFrames,
            caret: input.caret,
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
        "Add a rectangle or ellipse — a colour block behind a title, a rule, a dot. Lands as a DRAFT.",
      schema: AddShapeInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "shape",
            from: input.from,
            durationInFrames: input.durationInFrames,
            approval: "draft",
            shape: input.shape,
            fill: input.fill ?? "#FFFFFF",
            radius: input.radius ?? 0,
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
        "Show an image from the project's own folder, e.g. 'assets/logo.png'. The file must already be there — put it in the folder with your file tools first, or ask the person to. Lands as a DRAFT.",
      schema: AddImageInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "image",
            from: input.from,
            durationInFrames: input.durationInFrames,
            approval: "draft",
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
        "Show a video from the project's own folder, e.g. 'assets/demo.mp4'. `startFrom` trims its head. Silent by default — set `volume` if you want its sound. Lands as a DRAFT.",
      schema: AddVideoInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "video",
            from: input.from,
            durationInFrames: input.durationInFrames,
            approval: "draft",
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
        "Add music, a voiceover or a sound effect from the project's own folder. Must go on an audio track. `fadeInFrames` and `fadeOutFrames` ramp the gain, which is how you duck music under a voiceover without editing the file. Lands as a DRAFT.",
      schema: AddAudioInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "audio",
            from: input.from,
            durationInFrames: input.durationInFrames,
            approval: "draft",
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
        "Define a piece of the look, to be placed later: a type style (kind 'text' — Headline, Support, Label; leave `text` empty, the words arrive when it is placed), a shape (an accent rule, a block), an image or video from the project folder (a device frame, the product shot), or a sound. Elements are the style stage's artifact: define them, build the two or three style frames by placing them, and submit_style_frames names them. Refuses until the animatic is approved. PRISM_METHOD.md §7.",
      schema: AddElementInput,
      execute: (input) => {
        const { kind, name, role, note, box, animation, motion, ...fields } = input;
        const identity = { name, ...defined({ role }) };
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
              ...defined({ text: fields.text }),
              fontSize: fields.fontSize ?? 0.09,
              fontFamily: fields.fontFamily ?? "display",
              fontWeight: fields.fontWeight ?? 600,
              color: fields.color ?? "#F7F8F8",
              align: fields.align ?? "center",
              lineHeight: fields.lineHeight ?? 1.1,
              letterSpacing: fields.letterSpacing ?? -0.02,
              reveal: fields.reveal ?? "none",
              revealFrames: fields.revealFrames ?? 30,
              caret: fields.caret ?? false,
              ...visual({ box, animation, motion }),
            };
            break;
          case "shape":
            element = {
              kind,
              ...identity,
              shape: fields.shape ?? "rect",
              fill: fields.fill ?? "#FFFFFF",
              radius: fields.radius ?? 0,
              ...visual({ box, animation, motion }),
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
              ...visual({ box, animation, motion }),
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
              ...visual({ box, animation, motion }),
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
        "Change an element — and every clip placed from it follows. Send only the fields you are changing. This is how the look is adjusted: the Headline's size once, not once per headline. Clips that follow the element become DRAFTS again for the person to accept.",
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
        "Add one of the studio's prebuilt pieces as an element of this film, exactly as the person clicking it in the Text, Shapes, Motion or Audio section would: a cursor that glides to a spot and clicks, a tap ring, a typewriter line, a word-by-word headline, a counter, a highlight, the type styles, the shapes, the sound effects and the music beds. Then place it with prism.place_element and tune it with prism.update_element. Refuses until the animatic is approved, like add_element.",
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
        "Put an element on the timeline as a clip: the element supplies the look, you supply the track, the first frame, the length, and — for a text style — the words. Obeys the timing lock like add_text, and lands as a DRAFT. This is how the build should be done; add_text and friends are for things that are genuinely one-off.",
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
        "Change one clip — its timing, position, animation, text or colour. Send only the fields you are changing. The clip becomes a DRAFT again for the person to accept.",
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

    tool({
      name: "prism.wait_for_decision",
      description:
        "Wait for the person to decide on the stage you submitted. Returns the moment they click Approve or Send back in PrismLaunch — with the decision, their note if they wrote one, and what to do next — so you never have to ask them to tell you. Call it right after every prism.submit_*. If it returns \"still waiting\" after the timeout (default 60 seconds), call it again; do not move on and do not resubmit. Read-only.",
      schema: WaitForDecisionInput,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        waitForDecision({ stage: input.stage, timeoutSeconds: input.timeoutSeconds }),
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
        "Propose exporting the composition as an MP4. This renders NOTHING: it records what would be rendered and raises a confirmation in the app. The person must approve it, and only then can confirm_render proceed. Fails while any clip is still an unreviewed draft.",
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
