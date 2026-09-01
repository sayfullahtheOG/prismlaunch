# PrismLaunch

**An agent-native launch-video studio for software.** You direct; your agent turns the product you built into the film that launches it.

PrismLaunch reads a bounded set of source files from a product, derives the surfaces worth showing, and generates a fixed four-scene, 16–22 second, 16:9 motion-graphics launch film. The human and their AI agent share one artifact — a structured storyboard — which the agent reads and edits through **WebMCP tools registered on the live page**.

Agents propose. Only a human accepts.

---

## Why this is not another AI video generator

Most "AI video" tools are a chat box that emits a finished file. PrismLaunch puts the agent and the human on the same canvas:

- The agent calls `prism.revise_scene_draft`; the storyboard clip visibly changes and an amber draft badge appears.
- The human clicks **Accept** or **Keep current**. No agent can clear that state.
- Rendering is gated by a **two-phase confirmation token**, not a boolean the agent fills in itself. The first call proposes and writes nothing; the second takes only the token and replays what the first recorded.

Source is used for *product understanding only*. PrismLaunch never executes, clones, installs, or builds your code, and it has no accounts, sessions, or OAuth of any kind.

## Status

Early. The editor shell, design system, and validated scene graph are in place; the film preview currently runs on placeholder CSS animations while the Remotion composition is built. See the roadmap for what is and is not done.

## Requirements

- **Node 24+** (`engines` targets `24.x`)
- A Chromium-based browser for WebMCP testing, or ChatGPT's browser

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
| `npm run test` | Vitest (`lib/` only) |
| `npm run typecheck` | `tsc --noEmit` |

## Testing WebMCP

Visit **`/spike`** — a one-tool probe page that proves the full round-trip (register → discover → execute → unregister) and reports which implementation it found.

The badge tells you where you are:

| Badge | Meaning |
| --- | --- |
| `native modelContext` | The browser implements WebMCP. External agents can discover these tools. |
| `fallback registry` | No native implementation. A same-page shim lets the app call its own tools so the page still works — **invisible to external agents**. |
| `no modelContext` | Neither is available. |

**ChatGPT's browser implements WebMCP natively — no origin-trial token is required.** For desktop Chrome, enable `chrome://flags/#enable-webmcp-testing` and restart.

Two behaviours worth knowing if you are building on this:

- **Chrome does not validate a tool's `inputSchema`.** Missing required fields and unexpected properties reach your handler untouched, so every `execute` must validate its own input. `/spike` demonstrates this directly.
- **`executeTool` needs a JSON *string* and both arguments**, diverging from the published WebIDL. Use the `callTool()` helper in `lib/webmcp/types.ts`.
- **Never register a tool inside an iframe.** ChatGPT does not discover framed tools, and it fails silently.

## Environment

Both variables are **optional** and **server-only**. Never prefix either with `NEXT_PUBLIC_`. Neither is user authentication.

```bash
cp .env.example .env.local
```

| Variable | Why |
| --- | --- |
| `GITHUB_TOKEN` | Raises GitHub's anonymous limit from 60 req/hour to 5,000. One inspection costs 10–30 requests. A token with **no scopes** is enough. |
| `BLOB_READ_WRITE_TOKEN` | Required for MP4 render output — `@remotion/vercel` uploads the finished file to Vercel Blob. |

## Architecture

```
Human + browser agent
        │
        ▼
Next.js studio  ── WebMCP tools registered on the page
        │
        ├── /api/inspect ──> public GitHub API ──> bounded ProductManifest
        │
        └── /api/render  ──> accepted scene graph ──> Vercel Sandbox ──> MP4
```

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind v4, CSS-first `@theme` tokens |
| Validation | Zod — one schema drives both the WebMCP `inputSchema` and the runtime guard |
| State | Zustand — a single mutation path shared by human handlers and tool executors |
| Film | Remotion — one composition for both the in-browser preview and the server render |
| Render | `@remotion/vercel` → Vercel Sandbox → Vercel Blob |

Two constraints worth stating up front, both verified against documentation:

- **Remotion cannot render on edge runtimes** — not Vercel Edge, not Cloudflare Workers. Node runtime plus Vercel Sandbox only.
- **No COOP/COEP or `Origin-Agent-Cluster` headers.** WebMCP needs the default origin-keyed agent cluster; cross-origin isolation is a different mechanism it does not require.

## Deploying

Deploys to Vercel as a single project — the studio and the renderer share one origin.

1. Import the repository into Vercel.
2. Add `BLOB_READ_WRITE_TOKEN` (and optionally `GITHUB_TOKEN`) as server-side environment variables.
3. Deploy. Rendering runs in Vercel Sandbox; the Hobby plan includes free Sandbox CPU hours.

Set up **Vercel Spend Management** before making a deployment public — the render endpoint is unauthenticated and spends real CPU minutes.

## Licence

[MIT](LICENSE).

Built with [Remotion](https://remotion.dev), which is free for individuals and organisations of up to three people. Larger organisations need a [company licence](https://remotion.pro/license).
