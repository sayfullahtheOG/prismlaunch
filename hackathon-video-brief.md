# PrismLaunch: WebMCP submission video

Status: proposed brief, ready for review. A composition named “PrismLaunch — WebMCP submission” has been created in the open app's browser storage. This document is planning material; it has not been submitted as a stage or imported into the composition.

## The brief

- Audience: WebMCP Challenge judges evaluating a complete human-and-agent workflow.
- One message: An AI agent can help turn a product into an editable promo film while its creator directs the result.
- Feeling: capability.
- Target: 100–110 seconds, 1920 × 1080, 30 fps, English narration. Remain below the official three-minute limit.
- Creative direction: “The video made in the tool it demonstrates.” Show a finished result immediately, then reveal the editor and the collaboration that made it.
- Look: PrismLaunch's light interface, graphite text, cobalt accent from its branding. Clean close-ups of real product work, with restrained motion connecting them.

## Proposed demonstration

| Time | Picture and action | Purpose |
| --- | --- | --- |
| 0–6s | A strong moment from a real film made in PrismLaunch; cut to that same moment on its timeline. | Show the result first and establish the self-demo. |
| 6–16s | Briefly show the product-builder problem, then the editor ready for the agent. | Explain the personal reason for building it. |
| 16–42s | Record actual WebMCP calls and their visible results: project context, a creative stage, then a clip or reusable element appearing or changing. Remove waiting time. | Prove the agent is using the app's structured tools. |
| 42–60s | The person sends work back with a specific note. The agent reads the decision and revises the same project. | Make human direction tangible. |
| 60–76s | Show one reusable element changing across its placements, then play the result on the timeline. | Demonstrate a meaningful editing advantage. |
| 76–91s | Brief implementation close-up: tool registration and input validation, connected to the real editor. | Explain how WebMCP was implemented. |
| 91–105s | Show the render proposal, the person's approval, and the actual export result. End on the wordmark and URL. | Close the loop with a working outcome. |

The timings are provisional. Once narration and real captures exist, derive the edit from those events. Motion-design inserts may use actual components rebuilt from source, but must not stand in for recordings of tool execution or export.

## Narration direction

Use the creator's own account: “I build products, but making a good promo video was another skill I had to learn.” Explain that WebMCP exposes precise editing operations, so the agent can work directly on the same timeline the person reviews. Show a specific revision instead of listing every feature. End with the fact that PrismLaunch was used to make its own promo.

Narration choice is pending. No voice recording or generated voiceover has been supplied yet.

## Assets and evidence

- Existing transparent mark: public/brand/prismlaunch-logo.png.
- Real captures to collect once tool discovery works: agent tool call and result, storyboard review, requested change, reusable element edit, timeline playback, and render/export.
- Existing completed promo: the creator has reported making one, but no video file has been supplied in this task.
- Music: consider the app's minimal bed at low gain under narration; cut or repeat on phrase boundaries. Verify the final mix by listening.
- Do not show private chats, local paths, or unrelated browser tabs in recordings.

## WebMCP status

The original browser catalog was rejected because its WebMCP configuration exceeded the host's supported limits. The 41 operations now register in five compact, switchable toolsets: `workflow`, `graphics`, `media`, `elements`, and `edit`.

The local in-app browser accepted every toolset. It successfully read project context, switched toolsets, preserved the storyboard gate, and added a test track through `prism.add_track`. The browser console was clean. The full test suite, typecheck, lint, and a production build also pass.

The fix ships through the repository's GitHub-linked Vercel deployment. The installed skill now documents `prism.use_toolset`.

After deployment: reset the browser tool session, refresh the app, discover its workflow tools, read the saved composition context, gather real product assets, and submit the brief for the person's review. Do not approve stages or the export on the person's behalf.
