# Title

PrismLaunch

## One-line Summary

Your AI agent builds your product's promo video. You direct it on a shared timeline, review each stage, and decide what ships.

## Devpost Project Story

## Inspiration

I build products, but I don't know how to make a good promo video. Learning motion graphics is a whole other job, and it becomes another thing standing between finishing a product and showing it to people.

I wanted my AI agent to help with that. It already understood the product I was building. The missing piece was an editor it could actually use. Asking an agent to control a video timeline through screenshots, dragging, and clicking was a fragile way to work. WebMCP gave me a practical way to expose the editing operations directly.

That became PrismLaunch: a promo video editor built for a person and their agent to use together.

## What it does

You give your agent the product, the audience, and the message. It develops the film in PrismLaunch while you review the work in the studio.

The process moves through a brief, concepts, script, storyboard, style frames, an animatic, polish, and the final build. You can approve a stage or send it back with a note. The agent revises the same project, and you can see the timeline, layers, text, visuals, and sound as they take shape.

Reusable elements let the agent define a headline, product frame, or motion treatment once and use it across the film. The finished composition can be exported as an MP4 in the browser.

I used PrismLaunch to make the promo video for PrismLaunch itself.

## Why WebMCP fits

Video editing involves precise operations: placing a clip at a frame, changing its duration, moving it to another layer, adjusting typography, or updating a reusable element. Those operations are much easier to express as structured tools than as a sequence of mouse movements.

PrismLaunch exposes tools for project context, creative stages, layers, elements, clips, preview, frame capture, and render requests. The agent can inspect the current project and make a specific edit. The person sees the result in the same editor and gives feedback there.

This makes it possible to work with an agent on an editable film throughout the process. Human review is part of that workflow: stage approval and render approval are controls in the studio, not tools registered for the agent to call.

PrismLaunch does not contain its own model. You bring the agent you already use.

## How I built it

I came up with the idea and used Claude Code to build the core functionality. I then used Codex to test the WebMCP workflow in the browser and fix issues that my Claude Code setup could not directly exercise.

The studio uses Next.js, React, and TypeScript. WebMCP tools register through `document.modelContext.registerTool`, with a compatibility path for browsers exposing the older API location. Zod validates tool inputs, and human edits and agent edits go through the same state and timeline operations.

Remotion renders the composition for preview and export, with WebCodecs encoding the MP4 in the browser. Projects can live in a linked local folder or in browser storage. The app is hosted on Vercel, and its source is available under the MIT license.

## Challenges and what I learned

The hardest part was teaching an AI how to make a good promo when I am still learning video editing myself. I analysed successful promo videos, turned what I learned into a filmmaking guide, and built reusable elements that an agent could combine in its own films. Pacing, hierarchy, and knowing what to leave out mattered as much as having editing tools.

Testing in real WebMCP browsers also exposed issues that the local fallback did not. Multiple components were registering the same tools, causing partial registration failures. Some clip properties could not be edited without recreating the clip. A long storyboard description could fail validation and prevent the animatic from appearing. Those issues were fixed, along with storyboard contrast and clearer review controls.

The final blocker was the tool catalog itself. PrismLaunch had grown to 41 WebMCP operations, and ChatGPT's built-in browser disabled discovery because the combined configuration exceeded its supported limits. Shrinking descriptions alone was not enough. I reorganized the same operations into five compact toolsets—workflow, graphics, media, elements, and edit—and added a `prism.use_toolset` operation that lets the agent switch sets as it works. This kept every editing capability available while making each advertised catalog small enough for the browser to accept. I verified every switch in the built-in browser and used WebMCP to make a real timeline edit.

I learned that making an app usable by an agent requires both a precise tool interface and a workflow that helps the person understand and direct the result.

## What I am proud of

PrismLaunch made its own promo video. That took the idea beyond a tool-registration demo and into the task I originally needed help with.

I also tested the WebMCP experience in Chrome and ChatGPT's built-in browser. Working through those differences helped turn the editor into something I could actually use with an agent.

## Current limitations

This is an early editor with a small library of reusable motion elements. Agent access needs a browser with native WebMCP support. Local folder access depends on the browser; browser storage is the alternative when a folder cannot be linked. MP4 export also depends on browser codec support and the resources available on the user's device.

## What's next

I want to build a much richer motion graphics library that agents can draw from when making promo videos: more reusable elements, more visual treatments, and more ways to communicate a product clearly.

## Problem

Product builders can ship software but may not have the motion graphics skills or time to create a promo video.

## Solution

An editable video studio that exposes structured WebMCP tools to the user's agent, with a shared timeline and human review throughout the creative process.

## Why This Matters

The agent can use its understanding of the product to help make the launch film. The person can review and revise the work in an editor without manually performing every timeline operation.

## How We Used AI

Claude Code: built the core application from my idea and direction. Codex: tested the WebMCP workflow in the browser and helped debug and fix issues that my Claude Code setup could not directly exercise. Codex's image generation tool was used to create and refine the app logo. I analysed successful promo videos and used that learning to develop the filmmaking guide and reusable elements. Codex also helped draft these submission materials from my answers and the project source.

## How We Used Codex

The creator used Codex for real browser testing and debugging after building the core with Claude Code. This draft is based on the creator's answers and inspected source and commit history.

## Key Features

- Shared timeline with text, shapes, images, video, and audio.
- 41 WebMCP operations for project context, creative stages, clips, layers, reusable elements, preview, frame capture, and render proposals, exposed through five toolsets the agent can switch between.
- Eight creative stages with human approval and requests for changes.
- Reusable visual elements and a starter motion library.
- Local-folder and browser-storage workspaces.
- Remotion preview and browser MP4 export.

## Architecture

Next.js, React, and TypeScript; Zod input validation; Zustand state; WebMCP registration through document.modelContext; Remotion rendering and WebCodecs export; Vercel hosting. Source: MIT license.

Built-with tags: webmcp, typescript, next.js, react, remotion, webcodecs, zustand, zod, tailwind-css, vercel, claude-code, codex.

## Testing Instructions

No account or API key is required by PrismLaunch.

1. Open https://tryprismlaunch.vercel.app in ChatGPT's built-in browser, or in Chrome 149+ with WebMCP enabled using chrome://flags/#enable-webmcp-testing and the browser restarted.
2. Choose "Start in the browser" for a browser-stored workspace. In Chrome, you can instead click "Link project folder" and choose a folder for the film. Folder selection requires your own click. Use browser storage if the browser cannot grant folder access.
3. Ask your agent to read https://tryprismlaunch.vercel.app/SKILL.md and https://tryprismlaunch.vercel.app/PRISM_METHOD.md, then try: "Help me make a 15-second promo for PrismLaunch, a video editor that my AI agent can use. Work through the creative stages with me and wait for my review at each stage."
4. The agent should discover the workflow toolset and read prism.get_project_context. It can call prism.use_toolset to expose graphics, media, elements, or edit operations as needed. It can use WebMCP for the entire editing workflow; local filesystem access is not required in browser-storage mode.
5. Review the brief, concepts, script, and storyboard in the studio. Try sending a stage back with a specific note, then ask the agent to read your decision and revise it. Approve the revised stage to continue.
6. Continue through style frames and the animatic. Inspect and play the shared timeline. The agent can edit clips and reusable elements, seek, preview, and capture frames. Approving the animatic locks the timing for subsequent work.
7. After the polish and final build are reviewed, ask the agent to request a render. Approve the render in the studio, then let the agent confirm it. The browser encodes the MP4; the result is downloaded or saved to the linked folder, depending on workspace mode.

Browser notes: external agents cannot discover tools through the fallback registry in browsers without native WebMCP. A browser-stored project is not a folder that an agent can reach with ordinary file tools. Export requires supported WebCodecs/MP4 encoding and can be affected by device resources.

The developer tested in Chrome and ChatGPT's built-in browser and used PrismLaunch to create its own promo video.

## Public Demo Link

https://tryprismlaunch.vercel.app

## Public Repository Link

https://github.com/sayfullahtheOG/prismlaunch

## Demo Video

TODO: The creator will add the public YouTube URL later. The required narrated demonstration must be less than three minutes.

Suggested outline:
- 0:00–0:15: Show the promo made with PrismLaunch; explain the creator's difficulty making product videos.
- 0:15–0:45: Show the agent discovering and calling WebMCP tools.
- 0:45–1:30: Review a storyboard, request a change, and show the agent revise the same project.
- 1:30–2:15: Show reusable elements, the timeline, and preview.
- 2:15–2:45: Show the render approval and resulting MP4. Briefly explain the implementation.

## Screenshot Shot List

TODO: The creator will add screenshots later.

- Shared editor with a real film on the timeline.
- Storyboard and review controls.
- Reusable elements and motion library.
- WebMCP interaction alongside the resulting edit.
- Final promo frame or export result.

## Submission Readiness Notes

- Existing PrismLaunch draft is the target; do not create another project.
- Save draft changes only. The creator explicitly prohibited final submission.
- The creator acknowledged the rules in chat.
- Public story and testing claims about the completed promo and tested browsers come from the creator.
- Video and screenshots remain pending by the creator's choice.
- The written fields were saved to the existing Devpost entry. The browser shows Draft and 3/5 steps complete; the media step awaits the creator's video, and final submission was not performed.
- Devpost's project update made the portfolio project page public. The hackathon entry remains a separate draft; its submitted_at value was null when checked.
- The WebMCP toolset fix is included in the repository. The creator authorized committing and pushing the current work; the hackathon entry must remain a draft.

## Known Limitations

- Native WebMCP is required for discovery by external agents; the fallback is an in-page registry only.
- Folder access depends on browser support and permissions; browser storage is available as an alternative.
- Browser-stored compositions cannot be reached with an agent's ordinary filesystem tools.
- Browser MP4 encoding depends on codec support and device resources.
- The motion library is currently small; expansion is the creator's next planned feature.

Recent resolved issues informing the story:
- The 41-operation WebMCP catalog exceeded the browser host's supported configuration limits. Five switchable toolsets preserve every operation and restore discovery.
- adc03ff: shared registration prevents duplicate tool-registration races.
- 7c11973: full clip-property patching, cross-layer moves, and adaptive storyboard contrast.
- fa239c6: clamp the storyboard revision note so a long description does not block the animatic.
- 2b228d1 and c895b2e: revised stage ordering and review experience.

Do not describe those resolved issues as current failures. No new end-to-end export was performed while preparing this draft.

## TODO Official Form Fields

Existing answers retained:
- Submitter Type: Individual
- Country of residence: United Kingdom
- Organization name: blank (not applicable)
- App Status: New
- Existing-app changes: blank (not applicable)
- Live URL: https://tryprismlaunch.vercel.app
- Public code repository: https://github.com/sayfullahtheOG/prismlaunch
- Learning: Significant
- Career AI value: Yes

### Tested agents / clients

Tested the WebMCP workflow in Google Chrome with WebMCP enabled and in ChatGPT's built-in browser. I used Codex for browser-based testing and debugging, including exercising the tool interface and fixing issues found in real browser use. I also used PrismLaunch to create a promo video for PrismLaunch itself.

### AI tools used

Claude Code: built the core application from my idea and direction. Codex: tested the WebMCP workflow in the browser and helped debug and fix issues that my Claude Code setup could not directly exercise. Codex's image generation tool was used to create and refine the app logo. I analysed successful promo videos and used that learning to develop the filmmaking guide and reusable elements. Codex also helped draft these submission materials from my answers and the project source.

### Private testing instructions

Use the Testing Instructions section above.

### Remaining media

The creator will add the public YouTube demo, screenshots, and project thumbnail later. Do not insert invented URLs or placeholder media into Devpost.
