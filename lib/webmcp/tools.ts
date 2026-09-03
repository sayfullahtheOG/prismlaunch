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
  AddHtmlInput,
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
  ReadGuideInput,
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
import { createGuideSession } from "./guides";

/**
 * The tools PrismLaunch registers on the studio page.
 *
 * Three rules hold across every one of them:
 *
 * 1. **Each film-changing tool wraps an existing action.** There is no separate editing path,
 *    so anything an agent does produces exactly the visible result a human
 *    click would (context/architecture.md invariant 1).
 *    Guide delivery is session onboarding, not a change to the film.
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

type ToolConfig<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  annotations?: ModelContextTool["annotations"];
  execute: Executor<S>;
};

function defineTool<S extends z.ZodType>(
  config: ToolConfig<S>,
  guides: ReturnType<typeof createGuideSession>,
): ModelContextTool {
  return {
    name: config.name,
    description: config.annotations?.readOnlyHint === true
      ? config.description
      : `${config.description} Read both guides with prism.read_guide before work.`,
    inputSchema: toolInputJsonSchema(config.schema) as JsonSchema,
    ...(config.annotations ? { annotations: config.annotations } : {}),
    execute: async (raw) => {
      const parsed = config.schema.safeParse(raw ?? {});
      if (!parsed.success) {
        return `Invalid input — ${explainZodError(parsed.error)}`;
      }

      if (config.annotations?.readOnlyHint !== true) {
        const requirement = guides.beforeWrite();
        if (requirement) return requirement;
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
  const guides = createGuideSession();
  const tool = <S extends z.ZodType>(config: ToolConfig<S>) => defineTool(config, guides);
  return [
    tool({
      name: "prism.read_guide",
      description:
        "Required first: read SKILL.md and PRISM_METHOD.md before planning, drafting or editing. Call once per document; returns the full current guide. Editing tools require both this session. Re-read relevant sections before stages and revisions.",
      schema: ReadGuideInput,
      annotations: { readOnlyHint: true },
      execute: ({ document }) => guides.read(document),
    }),
    tool({
      name: "prism.get_project_context",
      description:
        "Read required agent guidance, storage, canvas and process state. Read agentGuidance first: call prism.read_guide for both guides before planning or editing, including when resuming an existing film. Then follow process and the person's notes.",
      schema: EmptyInput,
      annotations: { readOnlyHint: true },
      execute: () => ({
        ok: true,
        message: JSON.stringify({ agentGuidance: guides.context(), ...getProjectContext() }),
      }),
    }),

    tool({
      name: "prism.create_project",
      description:
        "Create and open an empty composition in linked storage. Starts with visual/audio tracks and grows as clips are placed. Needs storage setup first.",
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
        "Stage 1: audience, message, feeling, length. Gather product assets first. End your turn after submission; only the person approves in Process. Follow PRISM_METHOD.md §5.",
      schema: SubmitBriefInput,
      execute: ({ summary, ...brief }) => submitBrief(brief, summary),
    }),

    tool({
      name: "prism.submit_concepts",
      description:
        "Stage 2: submit 2–4 directions, scored with the six tests, and recommend one. Requires approved brief. PRISM_METHOD.md §5.",
      schema: SubmitConceptsInput,
      execute: ({ summary, ...concept }) => submitConcepts(concept, summary),
    }),

    tool({
      name: "prism.submit_script",
      description:
        "Stage 3: submit timed beats and optional voiceover. Timing follows events. Requires approved concept. PRISM_METHOD.md §1, §6.",
      schema: SubmitScriptInput,
      execute: ({ summary, ...script }) => submitScript(script, summary),
    }),

    tool({
      name: "prism.submit_storyboard",
      description:
        "Stage 4: DRAW every shot with required visual.layers (positioned UI, images, subjects, words, cursors and keyframes), plus action, duration, handoff and sound. Section titles alone are not boards. Read SKILL.md Visual storyboards. Requires approved script.",
      schema: SubmitStoryboardInput,
      execute: ({ summary, ...storyboard }) => submitStoryboard(storyboard, summary),
    }),

    tool({
      name: "prism.lay_animatic",
      description:
        "Optional planning scaffold: copy approved boards to the Boards track. Re-running replaces that track. Before animatic review, replace all roughs with approved style elements and remove/hide Boards; this tool does not build finished shots. Requires approved storyboard.",
      schema: LayAnimaticInput,
      execute: () => layAnimatic(),
    }),

    tool({
      name: "prism.submit_animatic",
      description:
        "Stage 6: submit all shots in the approved visual style with continuous music. Visible storyboard roughs are refused. Watch playback with sound first; still captures cannot verify audio or stalls. Human approval locks timing. Requires approved style frames. PRISM_METHOD.md §10.",
      schema: SubmitAnimaticInput,
      execute: (input) => submitAnimatic(input.summary),
    }),

    tool({
      name: "prism.submit_style_frames",
      description:
        "Stage 5: submit the look, elements and 2–3 real clips (hook, reveal, endcard). Requires approved storyboard. PRISM_METHOD.md §7.",
      schema: SubmitStyleFramesInput,
      execute: ({ summary, ...style }) => submitStyleFrames(style, summary),
    }),

    tool({
      name: "prism.submit_build",
      description:
        "Stage 8: submit the finished film with placeholders replaced and sound placed. Requires approved polish. After human approval, request_render. PRISM_METHOD.md §10.",
      schema: SubmitBuildInput,
      execute: (input) => submitBuild(input.summary),
    }),

    tool({
      name: "prism.submit_polish",
      description:
        "Stage 7: submit checklist verdicts and revised sound plan after reviewing the rough with sound, muted and half size. Requires approved animatic. PRISM_METHOD.md §9, §12.",
      schema: SubmitPolishInput,
      execute: ({ summary, ...polish }) => submitPolish(polish, summary),
    }),

    tool({
      name: "prism.wait_for_decision",
      description:
        "Read the submitted stage’s human decision and note. Call once when the person returns after review. Do not poll: submit, end your turn and ask for review. Read-only.",
      schema: WaitForDecisionInput,
      annotations: { readOnlyHint: true },
      execute: (input) =>
        waitForDecision({ stage: input.stage, timeoutSeconds: input.timeoutSeconds }),
    }),

    tool({
      name: "prism.add_track",
      description:
        "Add a visual or audio layer. First visual track is frontmost. Clips on one track cannot overlap; simultaneous objects need separate tracks.",
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
        "Add text. box uses canvas fractions with centre x/y; fontSize uses canvas height. Star words and set accent for two-tone text; fill and radius make a button.",
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
        "Add a rectangle or ellipse. fillTo adds a gradient; a wipe entrance can form a progress bar.",
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
        "Add a scalable studio icon. Size with box; draw animates outlined strokes over the entrance.",
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
        "Add seeded particles. box is the emitter; clip duration is burst duration. Use confetti once, on the payoff.",
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
      name: "prism.add_html",
      description:
        "Rebuild real product UI from its source as self-contained HTML/CSS. No scripts or external files. width is CSS pixels, scaled to box width and anchored top-left; match aspect ratio. Frame-driven data attributes and examples: SKILL.md.",
      schema: AddHtmlInput,
      execute: (input) =>
        createClip(
          input.trackId,
          defined({
            kind: "html",
            from: input.from,
            durationInFrames: input.durationInFrames,
            html: input.html,
            width: input.width ?? 800,
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
        "Frame a screenshot as a phone, browser, window or card. src must exist in project storage; omit for a solid screen. Supports tilt, shadow, animation and motion.",
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
        "Add an image already in project storage, e.g. assets/logo.png. Upload or write the asset first.",
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
        "Add a stored video. startFrom trims source frames; silent unless volume is set.",
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
        "Add stored music, voiceover or SFX to an audio track. fadeInFrames/fadeOutFrames ramp gain.",
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
        "Define a reusable style or media element, then place_element. Text styles may omit default words. Requires approved storyboard; submit_style_frames names the elements and sample clips. PRISM_METHOD.md §7.",
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
          case "html": {
            if (!fields.html) {
              return {
                ok: false,
                code: "invalid-input",
                message: "An html element needs `html` — the component's markup with an inline <style>. See prism.add_html.",
              };
            }
            element = {
              kind,
              ...identity,
              html: fields.html,
              width: fields.width ?? 800,
              ...depth,
            };
            break;
          }
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
        "Patch an element and its linked clips. Send only changed fields; note is kept on affected clips.",
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
        "Add a prebuilt motion, type, shape or sound element. Then place_element and tune with update_element. Requires approved storyboard.",
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
        "Place a reusable element with track, timing and optional text/visual overrides. Obeys timing locks. Prefer this for repeated styles; add_text etc. for one-offs.",
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
        "Replace all camera moves. Starts centred at ×1, holds between moves; [] resets. Keep the subject still during a push. Use at most four moves, each at least 15 frames.",
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
        "Set composition length; clips also grow it automatically before timing is locked.",
      schema: SetDurationInput,
      execute: (input) => setDuration(Math.round(input.durationSeconds * fps())),
    }),

    tool({
      name: "prism.seek",
      description:
        "Move the playhead and visible preview to a time in seconds.",
      schema: SeekInput,
      annotations: { readOnlyHint: true },
      execute: (input) => seek(Math.round(input.seconds * fps())),
    }),

    tool({
      name: "prism.preview",
      description:
        "Play or pause the composition, optionally seeking first.",
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
        "Render exact composition frames for visual review. Default: six labelled frames per storyboard sheet, read across then down. layout=single returns one image per frame. Choose every/from/to or at; max 24 frames. Check timing, overlap, legibility and easing. Read-only.",
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
        "Request MP4 export approval in the app; this does not render. Only the person can approve, then confirm_render may run.",
      schema: RequestRenderInput,
      execute: (input) => requestRender(input.reason),
    }),

    tool({
      name: "prism.confirm_render",
      description:
        "Start an approved render using the id from request_render. Requires the person’s approval in the app; the id alone is insufficient. Encodes MP4 in their browser.",
      schema: ConfirmRenderInput,
      execute: (input) => confirmRender(input.confirmationId),
    }),
  ];
}
