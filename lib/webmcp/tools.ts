import type { z } from "zod";
import {
  confirmRender,
  createClip,
  createProject,
  createTrack,
  deleteClip,
  flushWrites,
  getProjectContext,
  openProject,
  patchClip,
  patchTrack,
  requestRender,
  seek,
  setBackground,
  setDuration,
  setPlaying,
  shiftTrack,
  type ActionResult,
} from "@/lib/studio/actions";
import {
  DEFAULT_ANIMATION,
  DEFAULT_BOX,
  explainZodError,
  toolInputJsonSchema,
} from "@/lib/studio/schema";
import {
  AddAudioInput,
  AddImageInput,
  AddShapeInput,
  AddTextInput,
  AddTrackInput,
  AddVideoInput,
  ConfirmRenderInput,
  CreateProjectInput,
  EmptyInput,
  MoveTrackInput,
  OpenProjectInput,
  PreviewInput,
  RemoveClipInput,
  RequestRenderInput,
  SeekInput,
  SetBackgroundInput,
  SetDurationInput,
  TrackIdInput,
  UpdateClipInput,
  UpdateTrackInput,
} from "@/lib/studio/tool-inputs";
import { useStudioStore } from "@/lib/studio/store";
import type { Animation, Box, Clip } from "@/types/prism";
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
}): { box: Box; animation: Animation } {
  return {
    box: { ...DEFAULT_BOX, ...defined(input.box ?? {}) },
    animation: { ...DEFAULT_ANIMATION, ...defined(input.animation ?? {}) },
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
        "Create an empty composition at .prismlaunch/<slug>/project.json and open it. You get a background, one visual track and one audio track, and no clips — PrismLaunch writes no content. Needs a folder to be linked first.",
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
            color: input.color ?? "#FFFFFF",
            align: input.align ?? "center",
            lineHeight: input.lineHeight ?? 1.1,
            letterSpacing: input.letterSpacing ?? -0.02,
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

    tool({
      name: "prism.update_clip",
      description:
        "Change one clip — its timing, position, animation, text or colour. Send only the fields you are changing. The clip becomes a DRAFT again for the person to accept.",
      schema: UpdateClipInput,
      execute: (input) => {
        const { clipId, note, box, animation, ...rest } = input;
        const patch = defined(rest) as Partial<Clip>;

        // Partial box and animation merge onto what is already there, so an
        // agent nudging `y` does not reset the width someone tuned by hand.
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
