# PrismLaunch

**An agent-native launch-video studio.** Your agent writes the film; this page renders it, and you decide what ships.

PrismLaunch has no model of its own. It does not read your source, guess what your product does, or write a word of copy — your agent already knows all of that, and it is sitting in your editor. What PrismLaunch provides is the half an agent cannot do alone: a real renderer, a shared canvas you can both see, and an approval gate the agent cannot open.

Agents propose. Only a human accepts.

---

## How it works

A film is a folder in your own repository:

```
your-repo/
└── .prismlaunch/
    └── vector-launch/
        ├── project.json      ← your agent writes this
        └── renders/
            └── vector-launch-launch-film.mp4
```

1. You give your agent one line: `set up https://prismlaunch-doddlesoft.vercel.app/SKILL.md`
2. You open the studio and click **Link project folder**. (Your agent cannot — browsers only open that picker for a real click.)
3. Your agent writes `project.json`, either with its own file tools or through the WebMCP tools registered on the page. The studio picks up file changes within a second.
4. Four drafts appear on your screen. You accept or reject each one; the studio writes `"approval": "accepted"` back to disk, where your agent can read it.
5. When every scene is accepted, your agent proposes a render. You approve. The MP4 is encoded in your browser with WebCodecs and saved beside the project file.

**Nothing is uploaded.** Not the video, not the project file, not your code. The film is encoded on your machine and written to your folder.

## Why this is not another AI video generator

Most "AI video" tools are a chat box that emits a finished file. PrismLaunch puts the agent and the human on one artifact:

- The agent calls `prism.write_storyboard` or saves `project.json`; the storyboard visibly changes on your screen and four amber draft badges appear.
- You click **Accept** or **Keep current**. There is no tool that clears that state — `acceptDraft` and `approveRender` exist in the code and are deliberately never registered. A test walks the live tool surface to prove it.
- Rendering is gated by a **two-phase confirmation token**, not a boolean the agent fills in itself. The first call proposes and writes nothing; the second takes only the token and replays what the first recorded.
- The film is **exactly four scenes, 16–22 seconds**. That constraint is most of what the tool contributes now that the agent writes the words — an agent cannot talk its way into a nine-minute slideshow.

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

## The file format

`public/SKILL.md` is the contract, and it is the same document an agent reads. `lib/studio/schema.ts` enforces it. `tests/skill.test.ts` parses the example out of the document and validates it against the live schema, so the docs cannot drift from the code without the suite failing.

## The tools

Nine WebMCP tools are registered on the studio page. They cover what a file cannot do — opening a film on someone's screen, putting a scene in front of them, playing it, proposing a render.

| Tool | What it does |
| --- | --- |
| `prism.get_project_context` | Whether a folder is linked, what films are in it, and what the open one says. |
| `prism.create_project` | Create `.prismlaunch/<slug>/` with four empty scenes. |
| `prism.open_project` | Show a film that already exists in the folder. |
| `prism.write_storyboard` | Write all four scenes. They land as drafts. |
| `prism.revise_scene` | Change one scene. It lands as a draft. |
| `prism.focus_scene` | Put a scene in front of the person. |
| `prism.preview_storyboard` | Play the film on their screen. |
| `prism.request_render` | Propose the export. Renders nothing. |
| `prism.confirm_render` | Start the render — only after a human approves. |

`write_storyboard` and `revise_scene` exist so that an agent *without* file access is not locked out. An agent with file tools should edit `project.json` directly; it is the same board either way.

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
Your agent ──── file tools ────> .prismlaunch/<slug>/project.json
    │                                      │
    │                                      │ File System Access API
    └──── WebMCP tools ────> Next.js studio ──> Remotion <Player>
                                   │
                                   ├── /api/render ── two-phase gate ── snapshot
                                   │
                                   └── WebCodecs ──> MP4 ──> back into the folder
```

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4, CSS-first `@theme` tokens |
| Validation | Zod — one schema drives the file format, the WebMCP `inputSchema`, and the runtime guard |
| State | Zustand — a single mutation path shared by human handlers and tool executors |
| Storage | The user's own filesystem. No database, no accounts, no sessions, no OAuth. |
| Film | Remotion — one composition for both the preview and the export |
| Render | `@remotion/web-renderer` — WebCodecs in the browser, no server CPU |

Two constraints worth stating up front:

- **The File System Access API is Chromium-only**, and `showDirectoryPicker` requires a user gesture. That is why an agent cannot link a folder for you, and why the app asks for permission again after every reload — a stored handle survives, its permission does not.
- **No COOP/COEP or `Origin-Agent-Cluster` headers.** WebMCP needs the default origin-keyed agent cluster; cross-origin isolation is a different mechanism it does not require.

## Deploying

Deploys to Vercel as a single project with **no environment variables**. Rendering happens in the visitor's browser, so there is no render budget to protect and no unauthenticated endpoint spending CPU.

## Licence

[MIT](LICENSE).

Built with [Remotion](https://remotion.dev), which is free for individuals and organisations of up to three people. Larger organisations need a [company licence](https://remotion.pro/license).
