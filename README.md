# PrismLaunch

**A promo video editor for you and your AI agent.** Your agent builds the timeline through WebMCP; you review the work and decide what ships.

PrismLaunch has no model of its own. Bring a WebMCP-capable agent, give it your product and message, and direct it through a brief, concepts, script, visual storyboard, style frames, animatic, polish, and build. The agent follows the operating and filmmaking guides, and the result stays editable on a shared timeline.

- **[Open the live app](https://tryprismlaunch.vercel.app/)** — no PrismLaunch account or API key required.
- **[Watch the judges' demo (2:12)](https://youtu.be/OmZCLNlXz0E)** — the product, its WebMCP workflow, and the creator's narration.
- **[Watch the promo made with PrismLaunch](https://youtu.be/ujY44vg1I9c)** — the app's own launch video.
- **[Devpost project](https://devpost.com/software/prismlaunch)** · **[MIT license](LICENSE)**

Stage and render approvals are human controls in the studio. No registered WebMCP tool grants those approvals.

## Why WebMCP

Video editing requires precise operations: placing a clip at a frame, changing its duration, arranging layers, or updating every use of a reusable element. WebMCP exposes those operations as structured tools in the same browser page that renders the film.

The agent can inspect the current composition, make an edit, preview it, and capture exact frames. The person sees the result in the same editor and can approve it or send it back with a note. That feedback stays with the project, so the agent can revise the existing film instead of starting over.

## Try it with your agent

1. Open the [live studio](https://tryprismlaunch.vercel.app/) in ChatGPT's in-app browser or desktop Chrome with native WebMCP enabled. In Chrome, enable `chrome://flags/#enable-webmcp-testing` if needed and restart the browser. Your agent/client must support discovering and calling WebMCP tools.
2. Choose **Start in the browser** for browser storage. Alternatively, click **Link project folder** in a supported browser and choose a folder yourself. Folder access requires your click and permission.
3. Give the agent this prompt:

   > Help me make a 15-second promo for PrismLaunch, a video editor my AI agent can use. Read its operating and filmmaking guides, work through the creative stages with me, and wait for my review after each stage.

4. The agent calls `prism.read_guide` separately for `SKILL.md` and `PRISM_METHOD.md`, then reads `prism.get_project_context`. Installing the skill or reading its URL outside the tool does not satisfy the page's guide-delivery requirement.
5. Review the brief. Try **Send back** with a specific note, let the agent revise it, then approve the revision. Continue through the remaining stages. The Activity panel records tool activity and review decisions.
6. After reviewing the final build, let the agent propose a render. Approve the request in the studio; the agent can then confirm it. The browser encodes the MP4 and downloads it or saves it to the linked folder.

For a quick connection check, open **Files → Folder and connection** in the editor or run the [WebMCP probe](https://tryprismlaunch.vercel.app/spike). See [Testing WebMCP](#testing-webmcp) for the difference between native support and the in-page fallback.

---

## How it works

A film can live in a linked local folder or in browser storage. Both use the same modular layout. With a repository linked, it looks like this:

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

With a linked folder, an agent can edit the film's JSON parts with file tools or use WebMCP; the studio watches for file changes. In browser-storage mode, the agent must use the page's WebMCP tools. Files in the agent's own filesystem do not reach a browser-stored composition.

The storyboard is a visual composition for each shot: screenshots, product
frames, subjects, text, arrows and cursors, with timed keyframes. Each board
shows one frame with a corner play button to preview that shot's animation.
Storyboard and style-frame reviews are read-only. Manual editing tools live in **Editor**.
New agent submissions must include visual scenes; older text-only
boards remain readable and are marked as needing a layout. The same visuals
and movement can become timing scaffolding through `prism.lay_animatic`. The agent
must replace those rough boards with styled shots before submitting the animatic;
visible storyboard placeholders are refused. Approving the animatic saves a timing
snapshot for polish and build.

**Storage and rendering:** project parts and media are kept in the linked folder or browser storage, and video encoding happens in the browser. A render proposal sends the composition JSON to `/api/render`, where a temporary snapshot and confirmation are kept in server memory. The approved snapshot is returned for browser encoding.

## Human review and render approval

PrismLaunch puts the agent and the person on one editable artifact:

- The agent adds a clip or saves the film's files; it appears on your timeline immediately.
- The approval boundary is the process: eight stages, each submitted by the agent and approved or sent back by you. There is no tool that approves a stage or a render — `approveStage` and `approveRender` exist in the code and are deliberately never registered. A test walks the live tool surface to prove it.
- Rendering follows **propose → human approval → confirm**. The proposal records a snapshot; confirmation accepts its token and returns that approved snapshot for encoding.
- The agent works with canvas, layer, clip, element and playhead tools. You provide direction and decide whether each stage is ready.

## Requirements

- **Node.js 24** for local development (tested with 24.11.1).
- **A browser and agent/client with native WebMCP support** for agent-driven editing. The tested paths are ChatGPT's in-app browser and Chrome with WebMCP enabled; see the test scope below.
- **File System Access API support** if you want a linked local folder. Browser storage is available when folder access is unavailable, including in ChatGPT's in-app browser.
- **Supported WebCodecs/MP4 encoding** for export. Availability and performance depend on the browser and device.

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

**`public/PRISM_METHOD.md`** covers the craft: concept, script, visual storyboards, style frames, an animatic timed to music, polish, and build. It gives the agent guidance for typography, motion, sound, pacing, and visual continuity, with references for further reading. `tests/method.test.ts` checks supported names and frame-based timing examples against the implementation.

The eight stages live in separate `process/<stage>.json` files and have eight `submit_*` tools; each requires the person to approve the preceding stage. Animatic approval snapshots the timing. Later agent edits may move visual clips across section boundaries, but they must fit within the approved film's end. The Process panel is where the person reviews each stage and approves it or sends it back with a note. `tests/process.test.ts` covers these rules.

## The tools

PrismLaunch exposes five compact WebMCP toolsets, switched with `use_toolset`. The operations cover the guides (`read_guide`), the process (`submit_brief` through `submit_build`, `lay_animatic`, `wait_for_decision`), the canvas (`create_project`, `open_project`, `set_background`, `set_duration`, `set_camera`), the stack (`add_track`, `update_track`, `move_track`, `remove_track`), the elements (`add_element`, `update_element`, `remove_element`, `add_from_library`, `place_element`), the clips (`add_text`, `add_shape`, `add_image`, `add_video`, `add_audio`, `add_icon`, `add_particles`, `add_device`, `add_html`, `update_clip`, `remove_clip`), the view (`seek`, `preview`, `capture_frames`, `get_project_context`) and the gate (`request_render`, `confirm_render`).

The clip tools let an agent work without local file access. When a folder is linked and accessible to the agent, it can edit the relevant JSON parts directly. Browser-stored projects require WebMCP edits.

`public/SKILL.md` documents all of them, and `tests/skill.test.ts` asserts the documented list matches the registered one exactly.

Before an agent can change a film, `prism.read_guide` delivers `SKILL.md` and `PRISM_METHOD.md` in full, in separate calls. It is available in every toolset; `get_project_context.agentGuidance` reports what is still required even when resuming a later stage. Delivery is tracked for the page's tool registration, survives toolset switches, and resets on reload. Human editing and stage approvals are unaffected. This enforces delivery before WebMCP mutations, not an agent's comprehension or direct file edits.

## Testing WebMCP

Visit **`/spike`** — a one-tool probe page that proves the full round-trip (register → discover → execute → unregister) and reports which implementation it found.

### Tested on the live app

- **ChatGPT's in-app browser with Codex:** real WebMCP edits, creative-stage revisions, timeline work, and the creation of PrismLaunch's own promo. The completed 45-second composition was exported through the app.
- **Desktop Chrome with WebMCP enabled:** the editor registered all 15 workflow tools with no reported registration failures. The native `/spike` check discovered and executed `prism.echo`; a missing required input returned the expected validation error. This verifies native registration and the probe round-trip, not a full timeline edit through every Chrome agent/client.

The probe can also run against the fallback, so check its badge. A successful in-page self-test alone does not establish compatibility with an external agent. Agent clients must expose WebMCP discovery and execution; ordinary browser automation support is not sufficient.

### Tool discovery and input validation

| Badge | Meaning |
| --- | --- |
| `native modelContext` | The browser implements WebMCP. External agents can discover these tools. |
| `fallback registry` | No native implementation. A same-page shim lets the app call its own tools so the page still works — **invisible to external agents**. |
| `no modelContext` | Neither is available. |

The tested ChatGPT in-app browser exposed native WebMCP without an origin-trial token. For desktop Chrome, enable `chrome://flags/#enable-webmcp-testing` if needed and restart.

The studio starts with the `workflow` toolset. Call `prism.use_toolset` to switch to `graphics`, `media`, `elements`, or `edit`, then refresh the available tool list. Some hosts retain old catalogues during long sessions; reconnect the agent if discovery stops. If the page reloads, deliver both guides through `prism.read_guide` again.

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
                                   ├── browser storage (alternative to linked folder)
                                   │
                                   ├── /api/render ── two-phase gate ── snapshot
                                   │
                                   └── WebCodecs ──> MP4 ──> download or linked folder
```

`lib/studio/edits.ts` holds every timeline operation — move, trim, split, duplicate, reorder — as pure functions from one composition to another. That is what makes the hard parts testable: "does dragging a clip left past its neighbour do the right thing" is a question about data, and answering it does not require a browser.

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4, CSS-first `@theme` tokens |
| Validation | Zod — one schema drives the file format, the WebMCP `inputSchema`, and the runtime guard |
| State | Zustand — a single mutation path shared by human handlers and tool executors |
| Storage | Linked local folders or browser storage; no app account required. Temporary render confirmations and composition snapshots live in server memory. |
| Film | Remotion — one component for both the preview and the export |
| Timeline | Hand-rolled. The maintained packages either fight the design tokens or model scheduling rather than video layering. |
| Render | `@remotion/web-renderer` — WebCodecs in the browser, no server-side video encoding |

Two constraints worth stating up front:

- **Linking a folder requires browser support and permission.** `showDirectoryPicker` requires a user gesture; a remembered handle may need permission again after a reload. Use browser storage when folder access is unavailable.
- **No COOP/COEP or `Origin-Agent-Cluster` headers.** WebMCP needs the default origin-keyed agent cluster; cross-origin isolation is a different mechanism it does not require.

## Deploying

Deploys to Vercel as a single project with **no environment variables**. Video encoding happens in the visitor's browser. The server handles render proposals, human approvals, and temporary composition snapshots.

## Contributors and AI assistance

- **[Khalid Sayfullah](https://github.com/sayfullahtheOG)** — product idea, direction, review, testing, and final creative decisions.
- **Claude Code (Anthropic)** — assisted with the core implementation.
- **[Codex (OpenAI)](https://openai.com/codex/)** — assisted with WebMCP testing, debugging, workflow and UI improvements, documentation, and creating the PrismLaunch promo through the app.

PrismLaunch is a solo hackathon entry by Khalid. Claude Code and Codex are credited as AI development tools.

## Licence

[MIT](LICENSE).

Built with [Remotion](https://remotion.dev), which has its own [licensing terms](https://remotion.pro/license).
