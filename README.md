# PrismLaunch

**An agent-native video editor.** Your agent builds the timeline; this page renders it, and you decide what ships.

PrismLaunch is a canvas, a layer stack and a real renderer. It has no model of its own and no opinion about what makes a good video — it does not read your source, write copy, or impose a structure. Your agent already knows the product and is sitting in your editor. What PrismLaunch provides is the half an agent cannot do alone: a renderer, a timeline you can both see, and an approval gate the agent cannot open.

Agents build. Only a human approves a stage, and only a human starts a render.

---

## How it works

A film is a folder in your own repository:

```
your-repo/
└── .prismlaunch/
    └── vector-launch/
        ├── project.json      ← canvas settings and references to parts
        ├── process/          ← one JSON file per stage, with its decision and notes
        ├── activity.json     ← saved activity, including submissions and approvals
        ├── tracks/           ← one file per layer, with its clips
        ├── elements/         ← one file per element
        ├── assets/           ← images, video, audio it refers to
        └── renders/
            └── vector-launch-video.mp4
```

The film is a folder of small files, so a small change is a small edit: an agent recolouring a headline edits one element's file, not a file with every clip in it. `project.json` lists layers and elements by id and process files by path. Both linked folders and browser storage use this structure. Legacy projects migrate when opened. Activity persists in its own file; old saved stage states are recovered with explicit labels when no history was retained.

A composition is a canvas, a background, and a stack of layers:

```
tracks[0]      visual   ← nearest the viewer
tracks[1]      visual
background              ← always there, always behind every visual layer
tracks[2]      audio    ← music, voiceover, effects
tracks[3]      audio
```

Each track holds clips — text, shapes, images, video, sound — with a start frame and a length. Clips on one track cannot overlap; that is what a track is. Two things on screen at once means two tracks, and the track order decides which is in front.

1. You give your agent one line: `set up https://tryprismlaunch.vercel.app/SKILL.md`
2. You open the studio and click **Link project folder**. (Your agent cannot — browsers only open that picker for a real click.)
3. Your agent writes the film's files, either with its own file tools or through the WebMCP tools registered on the page. The studio picks up a change to any of them within a second.
4. It works stage by stage — brief, concept, script, storyboard, style, animatic, polish, build — and each stage opens for you to read. You approve it or send it back with a note; the decision is written to disk, where your agent reads it.

The storyboard is a visual composition for each shot: screenshots, product
frames, subjects, text, arrows and cursors, with timed keyframes. Each board
shows one frame with a corner play button to preview that shot's animation.
**Edit layout** lets you scrub, add, position and reorder layers inline.
New agent submissions must include visual scenes; older text-only
boards remain readable and are marked as needing a layout. The same visuals
and movement carry into the animatic through `prism.lay_animatic`.
5. When every stage is approved, your agent proposes a render. You approve. The MP4 is encoded in your browser with WebCodecs and saved beside the project file.

**Nothing is uploaded.** Not the video, not the project file, not your code. The film is encoded on your machine and written to your folder.

## Why this is not another AI video generator

Most "AI video" tools are a chat box that emits a finished file. PrismLaunch puts the agent and the human on one artifact:

- The agent adds a clip or saves the film's files; it appears on your timeline immediately.
- The approval boundary is the process: eight stages, each submitted by the agent and approved or sent back by you. There is no tool that approves a stage or a render — `approveStage` and `approveRender` exist in the code and are deliberately never registered. A test walks the live tool surface to prove it.
- Rendering is gated by a **two-phase confirmation token**, not a boolean the agent fills in itself. The first call proposes and writes nothing; the second takes only the token and replays what the first recorded.
- **Tools, not rules.** There is no `make_the_video` that takes a brief and returns a finished film. There is a canvas, layers, clips and a playhead. What gets built is the agent's call, and yours.

## Requirements

- **Node 24+** (`engines` targets `24.x`)
- **A Chromium browser** — Chrome, Edge, Arc, or ChatGPT's browser. PrismLaunch needs the File System Access API to read and write your folder, which Safari and Firefox do not have. Since nothing is uploaded, there is no server-side fallback to offer.

## Running locally

```bash
npm install
npm run dev
```

The studio is at [http://localhost:3000](http://localhost:3000).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build — must pass before any deploy |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |

## The two documents an agent reads

**`public/SKILL.md`** is how the tool works — the file format, the tools, the folder. `lib/studio/schema.ts` enforces it, and `tests/skill.test.ts` parses the example out of the document and validates it against the live schema, so the two cannot drift without the suite failing.

**`public/PRISM_METHOD.md`** is what to make with it. This is the product. It is the end-to-end craft of a promo film — concept, script, storyboard, timing locked to music before design, colour and type, motion in frame counts, sound in beats and gain, four rounds of review — synthesised from what Sandwich, Giant Ant, Buck, Ordinary Folk and the in-house teams at Apple, Linear and Raycast say they actually do, and from the perceptual research underneath. Every number in it is theirs. `tests/method.test.ts` checks that every transition, colour, font and tool it names is one the renderer really has, and that its tempo table is actually frame-locked at 30fps.

The tool without the method produces the video everyone has seen. The method is why it doesn't — and it is not left as advice. The eight stages live in separate `process/<stage>.json` files and have eight `submit_*` tools; each refuses until the person has approved the stage before it, and approving the animatic locks every visual clip's window so the agent can fill the beats but not move them. The Process panel is where the person reads each stage's artifact and approves it or sends it back with a note. `tests/process.test.ts` pins both rules.

## The tools

PrismLaunch exposes five compact WebMCP toolsets, switched with `use_toolset`. The operations cover the guides (`read_guide`), the process (`submit_brief` through `submit_build`, `lay_animatic`, `wait_for_decision`), the canvas (`create_project`, `open_project`, `set_background`, `set_duration`, `set_camera`), the stack (`add_track`, `update_track`, `move_track`, `remove_track`), the elements (`add_element`, `update_element`, `remove_element`, `add_from_library`, `place_element`), the clips (`add_text`, `add_shape`, `add_image`, `add_video`, `add_audio`, `add_icon`, `add_particles`, `add_device`, `add_html`, `update_clip`, `remove_clip`), the view (`seek`, `preview`, `capture_frames`, `get_project_context`) and the gate (`request_render`, `confirm_render`).

The clip tools exist so an agent *without* file access is not locked out. An agent with file tools should edit the film's files directly, one element or layer at a time — it is the same composition either way, and far fewer round trips.

`public/SKILL.md` documents all of them, and `tests/skill.test.ts` asserts the documented list matches the registered one exactly.

Before an agent can change a film, `prism.read_guide` delivers `SKILL.md` and `PRISM_METHOD.md` in full, in separate calls. It is available in every toolset; `get_project_context.agentGuidance` reports what is still required even when resuming a later stage. Delivery is tracked for the page's tool registration, survives toolset switches, and resets on reload. Human editing and stage approvals are unaffected. This enforces delivery before WebMCP mutations, not an agent's comprehension or direct file edits.

## Testing WebMCP

Visit **`/spike`** — a one-tool probe page that proves the full round-trip (register → discover → execute → unregister) and reports which implementation it found.

| Badge | Meaning |
| --- | --- |
| `native modelContext` | The browser implements WebMCP. External agents can discover these tools. |
| `fallback registry` | No native implementation. A same-page shim lets the app call its own tools so the page still works — **invisible to external agents**. |
| `no modelContext` | Neither is available. |

**ChatGPT's browser implements WebMCP natively — no origin-trial token is required.** For desktop Chrome, enable `chrome://flags/#enable-webmcp-testing` and restart.

Three behaviours worth knowing if you are building on this:

- **Chrome does not validate a tool's `inputSchema`.** Missing required fields and unexpected properties reach your handler untouched, so every `execute` must validate its own input. `/spike` demonstrates this directly.
- **`executeTool` needs a JSON *string* and both arguments**, diverging from the published WebIDL. Use the `callTool()` helper in `lib/webmcp/types.ts`.
- **Never register a tool inside an iframe.** ChatGPT does not discover framed tools, and it fails silently.

## Architecture

```
Your agent ──── file tools ────> .prismlaunch/<slug>/{project.json, process/, tracks/, elements/, activity.json}
    │                                      │
    │                                      │ File System Access API
    └──── WebMCP tools ────> Next.js studio ──> Remotion <Player>
                                   │
                                   ├── /api/render ── two-phase gate ── snapshot
                                   │
                                   └── WebCodecs ──> MP4 ──> back into the folder
```

`lib/studio/edits.ts` holds every timeline operation — move, trim, split, duplicate, reorder — as pure functions from one composition to another. That is what makes the hard parts testable: "does dragging a clip left past its neighbour do the right thing" is a question about data, and answering it does not require a browser.

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4, CSS-first `@theme` tokens |
| Validation | Zod — one schema drives the file format, the WebMCP `inputSchema`, and the runtime guard |
| State | Zustand — a single mutation path shared by human handlers and tool executors |
| Storage | The user's own filesystem. No database, no accounts, no sessions, no OAuth. |
| Film | Remotion — one component for both the preview and the export |
| Timeline | Hand-rolled. The maintained packages either fight the design tokens or model scheduling rather than video layering. |
| Render | `@remotion/web-renderer` — WebCodecs in the browser, no server CPU |

Two constraints worth stating up front:

- **The File System Access API is Chromium-only**, and `showDirectoryPicker` requires a user gesture. That is why an agent cannot link a folder for you, and why the app asks for permission again after every reload — a stored handle survives, its permission does not.
- **No COOP/COEP or `Origin-Agent-Cluster` headers.** WebMCP needs the default origin-keyed agent cluster; cross-origin isolation is a different mechanism it does not require.

## Deploying

Deploys to Vercel as a single project with **no environment variables**. Rendering happens in the visitor's browser, so there is no render budget to protect and no unauthenticated endpoint spending CPU.

## Licence

[MIT](LICENSE).

Built with [Remotion](https://remotion.dev), which is free for individuals and organisations of up to three people. Larger organisations need a [company licence](https://remotion.pro/license).
