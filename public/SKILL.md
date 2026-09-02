---
name: prismlaunch
description: Make a short promo, launch or demo video. Use when someone asks for a launch film, product video, teaser, trailer, or any short motion piece for something they have built. PrismLaunch renders and exports it; you direct it.
---

# PrismLaunch

PrismLaunch is a video canvas with a layer timeline, driven by you. It has no
model of its own and no opinion about what makes a good video — **you** decide
what goes on screen, when, and in what order. It renders what you write in the
person's own browser, shows it to them, and holds the gate on export.

Open the studio at **https://prismlaunch-doddlesoft.vercel.app**.

## The model

A composition is a canvas, a background, and a stack of layers.

```
tracks[0]      visual   ← nearest the viewer
tracks[1]      visual
background              ← always there, always behind every visual layer
tracks[2]      audio    ← music, voiceover, effects
tracks[3]      audio
```

Each track holds **clips** — text, a shape, an image, a video, a sound. A clip
has a start frame and a length. **Clips on one track cannot overlap**: that is
what a track is, one thing at a time in this lane. Two things on screen at once
means two tracks, and the track order decides which is in front.

There is no scene structure and no required shape. Four beats or eleven, a
single word held for two seconds, six things stacked on a cut — it is a
timeline, and it is yours.

## How the two halves fit together

**The folder.** A composition lives in `.prismlaunch/<slug>/project.json` inside
whatever repository the person is working in. If you have file tools, write that
file directly — it is the source of truth, and the studio picks up changes
within a second of you saving. This is the fastest way to build anything with
more than a few clips.

**The page.** The studio registers WebMCP tools on its own tab. Use them when
you have no file access, and for the things a file cannot do: moving the
playhead, playing the composition on the person's screen, proposing a render.

## Getting started

1. Ask the person to open the studio and click **Link project folder**, then
   choose the repository you are both working in. You cannot do this for them —
   browsers only open a folder picker for a real click.
2. Call `prism.get_project_context`. It tells you whether a folder is linked and
   what is already in it.
3. Create a composition with `prism.create_project`, or write the file yourself
   and call `prism.open_project`.
4. Build it.
5. Ask the person to review. **You cannot accept your own work** — there is no
   tool for it, by design.
6. Once every clip is accepted, call `prism.request_render`. That renders
   nothing; it raises a confirmation the person has to approve.

## The file

```
your-repo/
└── .prismlaunch/
    └── vector-launch/
        ├── project.json
        ├── assets/          ← images, video and audio you refer to
        └── renders/         ← finished MP4s land here
```

```json
{
  "version": 2,
  "name": "Vector launch video",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "durationInFrames": 300,
  "background": { "kind": "gradient", "from": "#0A0A0C", "to": "#1B1B22", "angle": 160 },
  "tracks": [
    {
      "id": "track-titles",
      "kind": "visual",
      "name": "Titles",
      "hidden": false,
      "locked": false,
      "volume": 1,
      "clips": [
        {
          "kind": "text",
          "id": "clip-hook",
          "from": 0,
          "durationInFrames": 70,
          "approval": "draft",
          "revisionNote": "Opening on the cost, not the product.",
          "text": "Six clicks to assign an issue.",
          "fontSize": 0.1,
          "fontFamily": "display",
          "fontWeight": 400,
          "color": "#F5F5F7",
          "align": "center",
          "lineHeight": 1.1,
          "letterSpacing": -0.02,
          "box": { "x": 0.5, "y": 0.5, "width": 0.8, "height": 0.2, "rotation": 0, "opacity": 1 },
          "animation": { "enter": "rise", "exit": "fade", "enterFrames": 14, "exitFrames": 10 }
        },
        {
          "kind": "text",
          "id": "clip-name",
          "from": 80,
          "durationInFrames": 90,
          "approval": "draft",
          "text": "Vector",
          "fontSize": 0.22,
          "fontFamily": "display",
          "fontWeight": 400,
          "color": "#FFFFFF",
          "align": "center",
          "lineHeight": 1,
          "letterSpacing": -0.04,
          "box": { "x": 0.5, "y": 0.46, "width": 0.9, "height": 0.3, "rotation": 0, "opacity": 1 },
          "animation": { "enter": "scale", "exit": "fade", "enterFrames": 16, "exitFrames": 12 }
        }
      ]
    },
    {
      "id": "track-rule",
      "kind": "visual",
      "name": "Accent",
      "hidden": false,
      "locked": false,
      "volume": 1,
      "clips": [
        {
          "kind": "shape",
          "id": "clip-rule",
          "from": 96,
          "durationInFrames": 74,
          "approval": "draft",
          "shape": "rect",
          "fill": "#7C6CFF",
          "radius": 0.5,
          "box": { "x": 0.5, "y": 0.62, "width": 0.08, "height": 0.006, "rotation": 0, "opacity": 1 },
          "animation": { "enter": "fade", "exit": "fade", "enterFrames": 10, "exitFrames": 10 }
        }
      ]
    },
    {
      "id": "audio-music",
      "kind": "audio",
      "name": "Music",
      "hidden": false,
      "locked": false,
      "volume": 1,
      "clips": [
        {
          "kind": "audio",
          "id": "clip-music",
          "from": 0,
          "durationInFrames": 300,
          "approval": "draft",
          "src": "assets/bed.mp3",
          "startFrom": 0,
          "volume": 0.7,
          "fadeInFrames": 20,
          "fadeOutFrames": 45,
          "playbackRate": 1
        }
      ]
    }
  ]
}
```

### Rules the file must satisfy

These are enforced. A file that breaks one is refused with the field named.

- **`version` is 2.**
- **Visual tracks come before audio tracks** in the array. That order is the
  stacking order: `tracks[0]` is nearest the viewer.
- **Clips on one track may not overlap.** Put simultaneous things on separate
  tracks.
- **Every clip must end inside `durationInFrames`.** Placing one past the end
  through a tool grows the composition automatically; writing the file by hand,
  set `durationInFrames` yourself.
- **Ids are unique** across every track and clip in the file.
- **Audio clips only on audio tracks**, and vice versa.
- **`approval` is `draft` or `accepted`. Always write `draft`.** Only the person
  can write `accepted`, through the studio.

### Positions

`box` is in fractions of the canvas, and **`x`/`y` are the box's centre** — so
`{ "x": 0.5, "y": 0.5 }` is dead centre, and you never subtract half the width.
Values outside 0–1 are legal and are how you slide something in from off-screen.

`fontSize` is a fraction of canvas **height**: `0.05` a caption, `0.1` a
headline, `0.22` a hero word. Nothing here is in pixels, so a composition looks
the same at 720p and 4K.

### Animations

`enter` and `exit` each take one of: `none`, `fade`, `rise`, `fall`,
`slide-left`, `slide-right`, `scale`, `blur`. `enterFrames` and `exitFrames`
set how long each runs; both are clamped to half the clip, so a short clip with
a long fade simply fades faster.

### Fonts

`display` (Instrument Serif), `body` (Inter), `mono` (JetBrains Mono).
`fontWeight` only does anything on `body` — the other two ship one weight each,
and synthesised bold looks cheap.

### Assets

`src` is a path inside the project's own folder, like `assets/logo.png`. The
file has to be there already; put it in with your file tools first. A path that
does not resolve renders as a hole in the frame and is reported in the app
rather than crashing the render — but it is still a hole, so check.

## The tools

| Tool | What it does |
| --- | --- |
| `prism.get_project_context` | Where things stand: the folder, the canvas, every track and clip with its id, the playhead, and which clips are unreviewed. **Call this first.** |
| `prism.create_project` | Create an empty composition and open it. |
| `prism.open_project` | Show one that already exists in the folder. |
| `prism.add_track` | Add a visual or audio layer. |
| `prism.update_track` | Rename, hide/mute, or set a layer's volume. |
| `prism.move_track` | Move a layer forward or back in the stack. |
| `prism.remove_track` | Delete a layer and its clips. |
| `prism.add_text` | Put words on screen. |
| `prism.add_shape` | A rectangle or ellipse. |
| `prism.add_image` | An image from the project folder. |
| `prism.add_video` | A video from the project folder. |
| `prism.add_audio` | Music, voiceover or an effect. |
| `prism.update_clip` | Change one clip. Send only what you are changing. |
| `prism.remove_clip` | Delete a clip. |
| `prism.set_background` | Solid colour or two-stop gradient. |
| `prism.set_duration` | Set the whole composition's length. |
| `prism.seek` | Move the playhead so you are both looking at the same moment. |
| `prism.preview` | Play or pause on the person's screen. |
| `prism.request_render` | Propose the export. **Renders nothing.** |
| `prism.confirm_render` | Start the render — only after a human approves. |

There is no tool to accept a draft, and no tool to approve a render. That is
not an oversight and not a policy you can talk your way around: the functions
exist in the app and are never registered. Asking the person is the only path.

## Making a good one

You are directing, so the craft is yours. What the medium rewards:

- **Say one thing.** A fifteen-second video that lands one idea beats one that
  lists five. Cut the second-best line.
- **Open on the problem, not the product.** "Six clicks to assign an issue"
  earns attention that "Introducing Vector" spends.
- **Hold long enough to read.** A line of text needs roughly 0.3 seconds per
  word plus a second — under two seconds for anything but a single word is too
  fast, and everyone gets this wrong in the same direction.
- **Move the eye deliberately.** If two things animate at once the viewer sees
  neither. Stagger by 6–12 frames.
- **Let the ground do work.** A gradient background and one accent colour will
  carry a whole film; four colours will not.
- **Silence is a choice.** If there is no audio, the fades have to carry the
  rhythm. If there is music, cut on it.

Fifteen to twenty-five seconds is the range for a launch film. Under ten reads
as a teaser; over forty and people leave.

## Working with the person

Show, don't describe. After you build something, call `prism.preview` so they
watch it rather than reading your summary of it. When you are discussing one
moment, `prism.seek` to it first — it is much easier to agree about a frame you
are both looking at.

Then stop and let them review. Every clip you added is waiting on their screen
with your `revisionNote` under it. They accept, or they reject and it is
removed.

When everything is accepted, propose the render. Say why you think it is ready.
Then wait — `prism.confirm_render` fails until they have clicked approve, and
retrying will not change that.

## When something is wrong

- **"No folder is linked yet."** Ask them to click **Link project folder**. You
  cannot open that picker.
- **"A folder is remembered but the browser dropped its permission."** Ask them
  to click **Re-open folder**. This happens on every fresh page load; it is
  normal, not a fault.
- **"clips … overlap".** Two clips on one track want the same frames. Put one on
  another track.
- **"Track … is locked."** The person locked it to protect it. Ask before
  assuming they want it unlocked.
- **A validation error naming a field.** Fix that field and send it again.
- **`prism.confirm_render` refuses.** A human has not approved it yet. Ask.

## What this never does

PrismLaunch does not read the person's source code, run it, or send it
anywhere. It reads one JSON file and the assets that file names, renders in the
browser with WebCodecs, and writes the MP4 back into the folder. Nothing is
uploaded — no video, no code, no project file. If you tell someone their
repository was analysed, that is not true.
