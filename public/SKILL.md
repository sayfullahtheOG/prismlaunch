---
name: prismlaunch
description: Make a short promo, launch or demo video. Use when someone asks for a launch film, product video, teaser, trailer, or any short motion piece for something they have built. PrismLaunch renders and exports it; you direct it.
---

# PrismLaunch

PrismLaunch is a video canvas with a layer timeline, driven by you. It has no
model of its own and no opinion about what makes a good video. **You** decide
what goes on screen, when, and in what order. It renders what you write in the
person's own browser, shows it to them, and holds the gate on export.

Open the studio at **https://tryprismlaunch.vercel.app**.

## The model

A composition is a canvas, a background, and a stack of layers.

```
tracks[0]      visual   ← nearest the viewer
tracks[1]      visual
background              ← always there, always behind every visual layer
tracks[2]      audio    ← music, voiceover, effects
tracks[3]      audio
```

Each track holds **clips**: text, a shape, an image, a video, an icon, a
burst of particles, a device frame, a sound. A clip has a start frame and a
length. **Clips on one track cannot overlap**: that is
what a track is, one thing at a time in this lane. Two things on screen at once
means two tracks, and the track order decides which is in front.

There is no scene structure and no required shape. It can be four beats or
eleven, a single word held for two seconds, or six things stacked on a cut. It
is a timeline, and it is yours.

**Elements** are clips without a place on the timeline: a Headline type
style, an accent rule, a device frame, the product screenshot, the music bed.
They live in `elements` in the file, and a clip placed from one carries its
`elementId` and follows it: change the element, and every clip placed from
it changes. The style stage defines them; the build places them. See
*Elements* below.

## How the two halves fit together

**The folder.** A composition lives in `.prismlaunch/<slug>/project.json` inside
whatever repository the person is working in. If you have file tools, write that
file directly. It is the source of truth, and the studio picks up changes
within a second of you saving. This is the fastest way to build anything with
more than a few clips.

The slug follows the composition's name: renaming "Untitled composition" to
"First video" in the studio moves the folder to `first-video/`. **So do not
cache a path.** If a write fails because the folder is gone, call
`prism.get_project_context`, which always reports the current `path`, and write
there instead.

**The page.** The studio registers WebMCP tools on its own tab. Use them when
you have no file access, and for the things a file cannot do: moving the
playhead, playing the composition on the person's screen, proposing a render.

**Or no folder at all.** Some browsers cannot hand the page a folder:
ChatGPT's built-in browser opens the picker and then refuses it; Safari and
Firefox have no picker. There the person clicks **Start in the browser**
instead, and the composition lives in the page. `prism.get_project_context`
reports `workspace.storage: "browser"`, and the tools are the only way in:
your file tools write to your own sandbox, which the page never sees, so do
not write `project.json` anywhere or keep drafts in files and expect the
studio to notice. Everything you need is a tool call, and the context tool
returns the whole composition whenever you want to re-read it. The studio's
own `library/` sounds, music beds and pieces work here exactly as on disk,
and the person can drop image, video or sound files onto the Elements
section to make them available as `assets/` paths.

## Before you build anything

Read **https://tryprismlaunch.vercel.app/PRISM_METHOD.md** first.

This file tells you how to operate the tool. That one tells you how to make
something worth watching: how to find the one idea, write the line, time the
cuts, choose the colour, place the sound. This file covers the timeline; that
one covers the craft. A composition built without it will be technically
valid and look like every other AI-made video, which is the thing this exists
to stop.

## Getting started

1. Ask the person to open the studio and click **Link project folder**, then
   choose the repository you are both working in, or click **Start in the
   browser** if you are in ChatGPT's built-in browser, Safari or Firefox. You
   cannot do either for them; both take a real click.
2. Before the brief, ask for the product itself: the logo (SVG, or PNG on
   transparent), three to six screenshots at 2×, the brand colour as a hex,
   and a short screen recording if the film needs one. The person drops them
   onto the Elements section and they land in `assets/`; with a folder
   linked, your own file tools can put them there too. Do not start without
   them. A product film without the product is text on a gradient, which is
   the thing this exists to stop.
3. Call `prism.get_project_context`. Read its `process` block first: it says
   which stage the film is at, what the person said about the last thing you
   submitted, and exactly what to do next.
4. There is probably already a blank composition open. Linking an empty folder
   makes one, because there is nothing to ask. If you want another, or a
   specific folder name, call `prism.create_project`; or write the file
   yourself and call `prism.open_project`.
5. Work the stages, in order, one at a time. Each has a `submit_*` tool. After
   each submit, call `prism.wait_for_decision`: it returns when the person
   approves the stage or sends it back with a note. You cannot approve a
   stage yourself; there is no tool for it.
6. The timeline opens up once the storyboard is approved. Approving the
   animatic locks the timing and opens the elements: define the look as
   elements, then build by placing them.
7. The person approves each stage; nothing moves past one without them.
   **You cannot approve your own work.** There is no tool that approves a stage or a render, by design.
8. When polish is approved, call `prism.request_render`. That renders nothing;
   it raises a confirmation the person has to approve.

## The process

The stages of PRISM_METHOD.md are eight fields in `project.json` and
eight tools. Sound is not one of them: the music arrives with the animatic,
and the polish rethinks it against the person's notes before the build
places it. The tool for a stage refuses until the person has approved every
stage before it, so you cannot skip ahead. The order is enforced by the tool
itself rather than by a document.

| Stage | Tool | What you submit | Approving it… |
| --- | --- | --- | --- |
| 1 Brief | `prism.submit_brief` | audience, message, feeling, length; the truth and the demo moment from immersion | lets you concept |
| 2 Concept | `prism.submit_concepts` | 2 to 4 directions, one recommended | picks the idea |
| 3 Script | `prism.submit_script` | beats with words and seconds; VO if any | lets you board |
| 4 Storyboard | `prism.submit_storyboard` | one panel per section: frame, the events with their frames (`action`), what carries into the next panel (`handoff`), `durationInFrames` as the sum of the events, in/out, sound, words. Sent back? Submit the full corrected set again — it replaces what was there | opens the elements |
| 5 Style frames | `prism.submit_style_frames` | the look, defined as elements — every piece the boards need — and the 2 to 3 frames built from them | fixes the look |
| 6 Animatic | `prism.lay_animatic`, then `prism.submit_animatic` | the boards on the timeline beside what you built, music underneath, cut to the grid | **locks the timing** |
| 7 Polish | `prism.submit_polish` | the rough reviewed: the sound rethought against the notes (`soundPlan`), the §12 checklist run with verdicts | clears the build |
| 8 Build | `prism.submit_build` | every section built final, objects carrying across the cuts, the sound placed | unblocks the render |

**Laying the animatic.** Once the style frames are approved, `prism.lay_animatic`
puts one placeholder clip per panel on a "Boards" track, at cumulative frames
from the panels' durations, carrying each panel's words and transitions. The
words and durations are yours; the frame arithmetic is the tool's. Then add the
music, move any board onto the beat grid, and submit.

**The timing lock.** When the animatic is approved, every visual clip on the
timeline becomes a locked section with a start frame, and together they fix
the film's length. From then on a clip you add or move may start in one
section and end in the next — that is how a cut is carried by an object, and
the method wants it — but it may not run past the end of the film.
`prism.add_text`, `prism.place_element` and `prism.update_clip` refuse a clip
past the end and say where the end is. If the film needs to be longer, say
so and ask the person to reopen the animatic in the Process panel. Audio is
exempt: a music bed spans the film.

**Sent back.** A stage the person rejects comes with their note. It appears in
`process.stages.<stage>.personSaid` and in the `instruction`. Address it and
resubmit with the same tool.

The person is never gated. They can approve, skip or reopen any stage. Only
you are held to the order.

## Elements

PRISM_METHOD.md §7 says a style frame settles the ground, the ink, the accent,
the one family that owns headlines, the size for each type role, the margins,
how the product is shown, and the motif. It also says that everything built
afterwards is an *application* of those decisions rather than a new one.
Elements are where they live.

An element is the matching clip minus its placement (no start, no length, no
approval, no label) plus a `name`. The same kinds as clips. A `text`
element is a type style and usually has no `text` of its own; the words
arrive when it is placed.

| Tool | What it does |
| --- | --- |
| `prism.add_element` | Define one. Refuses until the animatic is approved. |
| `prism.place_element` | Put one on a track as a clip. You supply the track, the frame, the length, and the words; the element supplies the look. Once the timing is locked, it lands inside a beat. |
| `prism.add_from_library` | Add one of the studio's prebuilt pieces as an element, the ones the person sees in the Text, Shapes, Motion and Audio sections: type styles, shapes, the Motion pieces, the effects, the beds. Then place it. |
| `prism.update_element` | Change one, and every clip placed from it. Send only what changes; your note rides on every clip it touched. |
| `prism.remove_element` | Delete one. Its clips stay, unlinked. |

The order the method wants: at the style stage, define the elements (the
type roles, the accent, the device, the product, the music), then build the
hook, the reveal and the endcard for real by placing them, and submit the
stage naming both the elements and the clips. In the build, place elements
rather than inventing new clips. `prism.add_text` and friends are for things
that are one-off, and if you reach for one twice, it is an element.

Writing the file by hand: `elements` is an array of these, each with a unique
`id` and a `name`, and a clip's `elementId` must name one of them.

## The file

```
your-repo/
└── .prismlaunch/
    └── vector-launch/
        ├── project.json     ← the film, the process, and the order of its parts
        ├── tracks/          ← one file per layer, with its clips
        │   ├── track-titles.json
        │   └── audio-music.json
        ├── elements/        ← one file per element
        │   └── el-headline.json
        ├── assets/          ← images, video and audio you refer to
        └── renders/         ← finished MP4s land here
```

The film is a folder of small files, so a small change is a small edit.
`project.json` holds what is about the film: the canvas, the background, the
process, and `tracks` and `elements` as lists of ids, in order. Each id names
a file: `tracks/<id>.json` is one layer with its clips, `elements/<id>.json`
is one element, each the same object it would be inline. To recolour a
headline, edit its element's file; the studio picks up a change to any part
within a second. `project.json` decides what the film contains: an id it
lists without a file is ignored, and a file it does not list is not part of
the film, so removing a layer is removing its id. The studio deletes the
file on its next save.

**The rules, for an agent with file tools:**

- **Never write the whole film into `project.json`.** It holds the canvas,
  the background, the process, the camera, and `tracks` and `elements` as
  lists of ids, in order — nothing else. A track or an element written
  inline there is wrong, even though the studio still opens it (that
  tolerance exists for films made before the split, and the studio rewrites
  them as parts on its next save). One long file is a rewrite of the whole
  film for every change and a context window of JSON every time you read
  it, and a film written that way is the one that ends up with forty clips
  nobody can find.
- **One file per layer: `tracks/<id>.json`.** The track object, with its
  clips. **One file per element: `elements/<id>.json`.** A new layer is a
  new file plus its id in `project.json`, in the position it should stack.
- **Edit the part, never the whole.** To recolour every headline, edit
  `elements/el-headline.json`. To add a clip, edit its layer's file. To
  change the length or the background, edit `project.json`. Read a part
  before you rewrite it; do not regenerate files you did not change.
- **Keep parts small.** A layer with more than about forty clips is two
  layers by role (`Titles`, `Product`, `Cursor`, `Accent`, `Music`, `SFX`).
- The tools (`prism.add_text`, `prism.place_element`, …) already write the
  parts this way; `prism.get_project_context` reports the folder and this
  layout beside it.

The example below is one film, written as the studio writes it: first
`project.json`, then each part it names.

`project.json`:

```json
{
  "version": 3,
  "name": "Vector launch video",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "durationInFrames": 300,
  "background": { "kind": "gradient", "from": "#0A0A0C", "to": "#1B1B22", "angle": 160 },
  "camera": [],
  "elements": ["el-headline"],
  "tracks": ["track-titles", "track-rule", "audio-music"]
}
```

`elements/el-headline.json`:

```json
{
  "kind": "text",
  "id": "el-headline",
  "name": "Headline",
  "role": "type",
  "fontSize": 0.1,
  "fontFamily": "display",
  "fontWeight": 400,
  "color": "#F5F5F7",
  "align": "center",
  "lineHeight": 1.1,
  "letterSpacing": -0.02,
  "box": { "x": 0.5, "y": 0.5, "width": 0.8, "height": 0.2, "rotation": 0, "opacity": 1, "tiltX": 0, "tiltY": 0 },
  "animation": { "enter": "rise", "exit": "fade", "enterFrames": 14, "exitFrames": 10, "travel": 0.03, "spring": 0 }
}
```

`tracks/track-titles.json`:

```json
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
      "approval": "accepted",
      "elementId": "el-headline",
      "revisionNote": "Opening on the cost, not the product.",
      "text": "Six clicks to assign an issue.",
      "fontSize": 0.1,
      "fontFamily": "display",
      "fontWeight": 400,
      "color": "#F5F5F7",
      "align": "center",
      "lineHeight": 1.1,
      "letterSpacing": -0.02,
      "box": { "x": 0.5, "y": 0.5, "width": 0.8, "height": 0.2, "rotation": 0, "opacity": 1, "tiltX": 0, "tiltY": 0 },
      "animation": { "enter": "rise", "exit": "fade", "enterFrames": 14, "exitFrames": 10, "travel": 0.03, "spring": 0 }
    },
    {
      "kind": "text",
      "id": "clip-name",
      "from": 80,
      "durationInFrames": 90,
      "approval": "accepted",
      "text": "Vector",
      "fontSize": 0.22,
      "fontFamily": "display",
      "fontWeight": 400,
      "color": "#FFFFFF",
      "align": "center",
      "lineHeight": 1,
      "letterSpacing": -0.04,
      "box": { "x": 0.5, "y": 0.46, "width": 0.9, "height": 0.3, "rotation": 0, "opacity": 1, "tiltX": 0, "tiltY": 0 },
      "animation": { "enter": "scale", "exit": "fade", "enterFrames": 16, "exitFrames": 12, "travel": 0.03, "spring": 0 }
    }
  ]
}
```

`tracks/track-rule.json`:

```json
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
      "approval": "accepted",
      "shape": "rect",
      "fill": "#7C6CFF",
      "radius": 0.5,
      "box": { "x": 0.5, "y": 0.62, "width": 0.08, "height": 0.006, "rotation": 0, "opacity": 1, "tiltX": 0, "tiltY": 0 },
      "animation": { "enter": "fade", "exit": "fade", "enterFrames": 10, "exitFrames": 10, "travel": 0.03, "spring": 0 }
    }
  ]
}
```

`tracks/audio-music.json`:

```json
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
      "approval": "accepted",
      "src": "library/audio/bed-bright.mp3",
      "startFrom": 0,
      "volume": 0.7,
      "fadeInFrames": 4,
      "fadeOutFrames": 45,
      "playbackRate": 1
    }
  ]
}
```

### Rules the file must satisfy

These are enforced. A file that breaks one is refused with the field named.

- **`version` is 3.** A file that says 2 still opens; it is written back as 3.
- **Visual tracks come before audio tracks** in the array. That order is the
  stacking order: `tracks[0]` is nearest the viewer.
- **Clips on one track may not overlap.** Put simultaneous things on separate
  tracks.
- **Every clip must end inside `durationInFrames`.** Placing one past the end
  through a tool grows the composition automatically. A new composition starts
  at one frame and lengthens as you build, so you never have to pick a duration
  up front. Writing the file by hand, set `durationInFrames` yourself.
- **Ids are unique** across every track and clip in the file.
- **Audio clips only on audio tracks**, and vice versa.
- **`approval` is per stage, not per clip.** The person approves the animatic,
  the build, the polish; a clip's own `approval` field remains for older films
  and may simply be written `accepted` (it is also the default when omitted).
- **`elementId`, when present, names an entry in `elements`.** Element ids are
  unique alongside track and clip ids.
- **A part file's `id` is what names it.** `tracks/<id>.json` and
  `elements/<id>.json` are matched by the `id` inside them, so the file name
  is only a convention; keep them the same.

### Positions

`box` is in fractions of the canvas, and **`x`/`y` are the box's centre**, so
`{ "x": 0.5, "y": 0.5 }` is dead centre and you never subtract half the width.
Values outside 0 to 1 are legal and are how you slide something in from
off-screen.

`fontSize` is a fraction of canvas **height**: `0.05` a caption, `0.1` a
headline, `0.22` a hero word. Nothing here is in pixels, so a composition looks
the same at 720p and 4K.

### Animations

`enter` and `exit` each take one of twelve:

- `none`: it is simply there, or simply gone. The cut.
- `fade`: opacity only. The default exit for nearly everything.
- `rise`: up into place. The workhorse for text.
- `fall`: down into place, from an anchor already on screen.
- `slide-left` / `slide-right`: lateral. The direction must agree across a cut.
- `scale`: grows into place; shrinks out.
- `blur`: comes into focus; falls out of it.
- `pop`: out of focus and about 15 % too large, settling to size; the exit
  shrinks and blurs out. The kinetic word move.
- `zoom`: through the camera. In from 0.6 scale; out growing to 1.4 with blur.
- `flip`: a card turning up, rotateX from 70°.
- `wipe`: a true mask reveal, left to right. The exit uncovers from the left.

`enterFrames` and `exitFrames` set how long each runs; both are clamped to
half the clip, so a short clip with a long fade fades faster. `travel`
(canvas fraction, default 0.03) is how far `rise`, `fall` and the slides
move: 0.03 settles into place, 0.25 arrives from off-stage. `spring` (0–1,
default 0) is overshoot on the enter: 0.3 lands a hair past and settles
back, 0.6 bounces. Keep it off text.

### Reveals

A text clip can also bring its words in, on top of its enter. `reveal` is
`none`, `type` (a character at a time), `words` (one word after another, each
fading up where it already sits, so the line never reflows) or `count` (the
first number in the text runs up from zero, keeping its commas and decimals,
so "10,000+ users" counts to itself). `revealFrames` is how long that takes
from the clip's first frame; 30 is the default. For `words`, `revealStagger`
is the number of frames between one word starting and the next; when it is
set, `revealFrames` becomes how long each word takes (the default 0 spreads
the words across `revealFrames`). `revealStyle` is how each word lands:
`rise` (default), `fade`, `pop` or `blur`. `caret: true` puts a blinking
text caret after the words, and with `type` it types along.

**Two-tone lines.** Wrap a run of words in asterisks and set `accent` to a
colour, and those words are set in it: `"text": "Turn *books* into audio",
"accent": "#2F7CF6"`. This works with `reveal: "none"` and `"words"`; `type`
and `count` print the words in one colour. `fill` puts a colour behind the
words, filling the box (a button, a chip), and `radius` rounds it, 0–0.5 of
the box's smaller side; 0.5 is a pill.

### Motion

Every visual clip can make one move over its life, on top of its enter and
exit: `motion` is `{ x, y, scale, frames, delay, easing, press, rotate,
opacity, blur, arc, spring, trail }`. `x` and `y` are how far the box
travels, in canvas fractions; `scale` what it grows to; `frames` how long
the move takes (0 means the whole clip); `delay` the frame it starts on;
`easing` one of `out`, `in-out`, `linear`. The move holds where it lands.
`press: true` dips the clip once as it arrives, which is what a click looks
like. `rotate` is degrees turned by the end; `opacity` the opacity at the
end, as a multiplier of the box's own (1 leaves it alone); `blur` the
defocus at the end, 0–1; `arc` (−1..1) curves the path, 0 straight, ±0.5 a
visible arc, ±1 a swoop; `spring` is overshoot at the end of the move;
`trail: true` leaves ghosts behind a moving thing, a streak.

A cursor gliding to a button is
`{ "x": 0.12, "y": -0.08, "frames": 24, "easing": "in-out", "press": true }`;
a screenshot pushing in slowly is `{ "scale": 1.04, "easing": "linear" }`;
a phone drifting for a whole beat is
`{ "x": 0.02, "y": -0.015, "rotate": 2, "easing": "linear" }`; a sparkle
swooping is
`{ "x": 0.28, "y": 0.14, "frames": 24, "arc": 0.6, "spring": 0.3, "trail": true }`.

### Depth

Four fields on every visual clip put it in space. All are off by default.

- `tiltX` and `tiltY` in `box` are perspective degrees (−85..85). `tiltX`
  leans it back like a card on a desk; `tiltY` turns it like a door. ±12
  reads as a floating product shot, ±30 as a phone flying past.
- `shadow` (0–1): a soft tinted shadow under the thing. 0.3 a card, 0.6 a
  phone in the air.
- `glow` (0–1): a halo in its own colour. Ration it.
- `blur` (0–1): defocus held for the whole clip, for a wall of text or a
  screenshot behind the subject.

### Icons

```
{ "kind": "icon", "icon": "check", "color": "#F7F8F8", "stroke": 2, "draw": false }
```

Names: `check`, `x`, `plus`, `minus`, `arrow-right`, `arrow-up-right`,
`chevron-right`, `chevron-down`, `sparkle`, `star`, `heart`, `bolt`, `play`,
`search`, `circle`, `cursor`, `hand`. `sparkle`, `star`, `play`, `cursor`,
`bolt` and `heart` are filled; the rest are outlines, and `stroke` (0.5–4)
is their weight. `draw: true` draws the stroke on over the enter like a pen:
a check drawing itself. An icon has `box`, `animation`, `motion`, `shadow`,
`glow` and `blur` like every visual clip, plus `from`, `durationInFrames`
and `label`.

### Particles

```
{ "kind": "particles", "style": "confetti", "count": 80, "colors": ["#5B8CFF", "#7CC7FF", "#F5A9E1"], "spread": 0.6, "gravity": 1, "size": 0.016, "seed": 1 }
```

Styles: `confetti` (an upward burst from the box centre that falls and
spins), `burst` (all directions), `sparkles` (twinkling points inside the
box), `rise` (drifting up through the box). `count` 1–400; `spread` 0–1, the
share of the canvas they fly; `gravity` 0–2; `size` a fraction of canvas
height; `seed` makes the burst deterministic, so the export matches the
preview. The box is the emitter: its centre for `confetti` and `burst`, its
area for `sparkles` and `rise`.

### Devices

```
{ "kind": "device", "device": "browser", "src": "assets/app.png", "fit": "cover", "screen": "#FFFFFF", "frame": "#111114", "radius": 0.06 }
```

`device` is one of `phone` (bezel and island), `browser` (title bar with
three dots), `window` (hairline and shadow), `card` (plain white panel).
`src` is optional; without it the screen is the `screen` colour. `frame`
colours the bezel, the title bar, the hairline. Tilt it and give it a shadow
and it is a product shot in the air.

### The camera

`project.json` has a top-level `"camera": [ ... ]`, a list of moves:

```
{ "from": 300, "frames": 20, "x": 0.5, "y": 0.5, "scale": 1, "easing": "in-out" }
```

The camera starts at the centre at scale 1. By the end of a move it looks at
(`x`, `y`) at zoom `scale`, and holds there until the next move. `scale` 1.6
pushes into a region; 0.8 pulls back with the edges showing.
`prism.set_camera` replaces the whole list. Rule of thumb: at most four
moves in a film, never faster than 15 frames, and the thing being pushed
into holds still while the camera moves.

### Components from the codebase

The best thing you can put on screen is the product itself, as itself. When
the person has linked their repository and you have file tools, do not
settle for a screenshot: find the component the film is about — the pricing
card, the command palette, the row with the button, the empty state — and
rebuild it as an `html` clip.

1. **Find it.** Search the codebase for the feature's name; read the
   component (JSX, Svelte, Vue, templates all read the same for this), the
   styles it uses, and the design tokens or Tailwind config behind them.
   Note the real copy, the real colours, radii, spacing and font sizes.
2. **Rebuild it as one snippet.** Markup plus one inline `<style>`, written
   for a fixed `width` in CSS px (its natural width, say 520). Resolve every
   token to a literal value. No scripts, no framework, no external files:
   the renderer strips them. Images by their `assets/` path; icons as inline
   SVG. Fonts through `var(--font-body)`, `var(--font-display)` and
   `var(--font-mono)`, which are the film's three faces. Keep it under 24 KB.
3. **Make it alive.** The renderer drives a few attributes frame by frame,
   so the export moves exactly as the preview does:

   | Attribute | What it does |
   | --- | --- |
   | `data-in="12"` | Arrives at clip frame 12 with a pop over 6 frames. `"12 rise"`, `"12 fade"`, `"12 blur"` for the other styles. |
   | `data-out="80"` | Leaves at frame 80 over 5 frames. |
   | `data-press="40"` | Dips once at frame 40 — a click. Put it on the button, timed to the cursor's arrival. |
   | `data-lift="30"` | Lifts with a shadow from frame 30 — a hover. |
   | `data-count="12"` | The number in its text counts up from frame 12 over 30 frames, keeping its commas. |
   | `data-type="12"` | Its text types from frame 12, two frames a character. |

   Stagger the rows 4–6 frames apart; press the button when the cursor gets
   there; count the number that matters. `var(--frame)` is the current
   frame if your own CSS wants it: `opacity: clamp(0, calc((var(--frame) - 12) / 6), 1)`.
4. **Place it like any clip.** `prism.add_html` (or `prism.add_element` with
   `kind: "html"`, then place it). Give the box the snippet's aspect — it is
   scaled to the box's width and anchored at the top-left. Then the usual:
   `pop` or `scale` in with `spring` 0.25, a little `tiltY`, `shadow` 0.3,
   a slow drift, and a hand cursor arriving to press it.

```
{
  "kind": "html", "width": 520,
  "html": "<style>.card{width:520px;padding:22px;border-radius:18px;background:#FFF;font-family:var(--font-body)} .row{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #EEE}</style><div class=\"card\"><h3 data-in=\"0\">Library</h3><div class=\"row\" data-in=\"8 rise\"><span>History lecture</span><b data-count=\"8\">1,200</b></div><div class=\"btn\" data-in=\"16\" data-press=\"40\">Distribute</div></div>",
  "box": { "x": 0.5, "y": 0.5, "width": 0.3, "height": 0.4, "tiltY": -8 },
  "animation": { "enter": "scale", "enterFrames": 10, "spring": 0.25, "exit": "fade", "exitFrames": 8 },
  "shadow": 0.3
}
```

The Motion section's *Live component* piece is a worked example; replace its
markup with the product's own. Never invent a component the product does not
have — the point is that it is real.

### Fonts

`display` (Instrument Serif), `body` (Inter), `mono` (JetBrains Mono).
`fontWeight` only does anything on `body`; the other two ship one weight each,
and synthesised bold looks cheap.

### Assets

`src` is a path inside the project's own folder, like `assets/logo.png`, or
one of the studio's own files under `library/`, which resolve in every
workspace with nothing to copy, so `prism.add_audio` with one of those works
even where there is no folder. The Motion section of the rail holds the pieces product films keep
rebuilding, each an element with its reveal or motion already set: a cursor
(`library/cursor/arrow.svg`, an image you can also use directly), a pointing
hand that glides and presses (`library/cursor/hand.svg`), a tap ring, a
typewriter line, a word-by-word headline, a two-tone kinetic line whose
words pop in 6 frames apart, a counter, a highlight, a progress bar that
wipes on over 45 frames, a check that draws itself on, a sparkle that swoops
along an arc with a trail, a burst of 90 pieces of confetti, and twinkling
sparkles. `prism.add_from_library` adds any of these pieces as an element,
sounds included. The ids, by section: Type `headline`, `support`, `label`,
`blank-type`. Shapes `accent-rule`, `device`, `pill`, `dot`, `panel`,
`blank-shape`, the device frames `phone`, `browser`, `window` and `card`,
`button` (a text pill with a fill) and `gradient-bar` (a rounded gradient
bar). Motion `cursor`, `hand-cursor`, `tap-ring`, `typewriter`,
`word-by-word`, `kinetic-line`, `counter`, `highlight`, `progress-bar`,
`check`, `sparkle-trail`, `confetti`, `sparkles`, `live-card`. Sound
`sfx-whoosh`, `sfx-click`, `sfx-tick`, `sfx-typing`, `sfx-impact`,
`sfx-rise`. Music `bed-calm`, `bed-upbeat`, `bed-cinematic`, `bed-bright`,
`bed-minimal`. The effects, all dry: `library/audio/whoosh.wav` (0.9s),
`click.wav` (a single mouse click, 0.12s — the frame the cursor presses),
`tick.wav` (a single keystroke, 0.14s — one per word in a run), `typing.wav`
(a burst of keystrokes, 1.9s — under a typed line), `impact.wav` (1s),
`rise.wav` (1s). The music beds, thirty seconds each and instrumental:
`library/audio/bed-calm.mp3` (warm pads, 80 BPM), `bed-upbeat.mp3` (driving,
120 BPM), `bed-cinematic.mp3` (strings that build to a peak),
`bed-bright.mp3` (clean plucks and claps on a punchy kick, 120 BPM — the
kinetic register's bed), `bed-minimal.mp3` (a warm pad and a slow arpeggio
over dry rim clicks, 90 BPM — quiet confidence for a developer tool). A bed
longer than the film is cut by the clip's duration, so give it
`fadeOutFrames` and it will not stop dead.
The person can also drop an image, a video or a sound onto the Elements
section, which puts it in `assets/` and makes it an element. Otherwise the
file has to be there already; put it in with your file tools first. A path that
does not resolve renders as a hole in the frame and is reported in the app
rather than crashing the render. It is still a hole, so check.

## The tools

| Tool | What it does |
| --- | --- |
| `prism.get_project_context` | Where things stand: the folder, the canvas, every track and clip with its id, the playhead, and which clips are unreviewed. **Call this first.** |
| `prism.create_project` | Create an empty composition and open it. It starts with no runtime and grows as you place clips. |
| `prism.open_project` | Show one that already exists in the folder. |
| `prism.submit_brief` … `prism.submit_build` | The eight stages, in order. See *The process* above. |
| `prism.wait_for_decision` | **Call after every submit.** Returns the moment the person approves or sends back, with their note and what to do next. |
| `prism.lay_animatic` | The approved boards onto the timeline, as placeholders, with the frame arithmetic done. |
| `prism.add_track` | Add a visual or audio layer. |
| `prism.update_track` | Rename, hide/mute, or set a layer's volume. |
| `prism.move_track` | Move a layer forward or back in the stack. |
| `prism.remove_track` | Delete a layer and its clips. |
| `prism.add_text` | Put words on screen: a line, a two-tone line with `accent`, a button with `fill`. |
| `prism.add_shape` | A rectangle or ellipse, flat or a gradient (`fillTo`). |
| `prism.add_image` | An image from the project folder. |
| `prism.add_video` | A video from the project folder. |
| `prism.add_icon` | One of the studio's icons: a check that draws itself on, a sparkle, a cursor. |
| `prism.add_particles` | Confetti, a burst, sparkles or dust rising. The box is the emitter. |
| `prism.add_device` | A phone, browser, window or card frame around a screenshot. |
| `prism.add_html` | A component of the product rebuilt from its source as one snippet of markup, alive frame by frame through `data-in`, `data-press`, `data-count` and friends. See *Components from the codebase*. |
| `prism.add_audio` | Music, voiceover or an effect. |
| `prism.update_clip` | Change one clip. Send only what you are changing; every field above is accepted. |
| `prism.remove_clip` | Delete a clip. |
| `prism.add_element` | Define a piece of the look: a type style, a shape, an icon, a particle burst, a device frame, a file. |
| `prism.place_element` | Put an element on a track as a clip. The build's verb. |
| `prism.update_element` | Change an element and everything placed from it. |
| `prism.remove_element` | Delete an element; its clips stay. |
| `prism.set_background` | Solid colour or two-stop gradient. |
| `prism.set_camera` | Replace the camera's whole list of moves. See *The camera*. |
| `prism.set_duration` | Set the whole composition's length. |
| `prism.capture_frames` | **See your own work.** Exact frames at a cadence or at named moments, six to a storyboard sheet. |
| `prism.seek` | Move the playhead so you are both looking at the same moment. |
| `prism.preview` | Play or pause on the person's screen. |
| `prism.request_render` | Propose the export. **Renders nothing.** |
| `prism.confirm_render` | Start the render, and only after a human approves. |

There is no tool to approve a stage, reopen the timing lock,
or approve a render. That is deliberate, and it is enforced in code rather
than by a policy you could talk your way around: the functions exist in the
app and are never registered. Asking the person is the only path.

## Recipes

The moves a product film keeps needing, as clips. Frame counts are at 30fps.
Each is one beat; PRISM_METHOD.md says how many of them a film gets.

- **The kinetic two-tone line.** One text clip, Inter 500 at 0.09, centred at
  y 0.47, `"text": "Turn *books* into audio"`, `accent` the brand colour;
  `reveal: "words"`, `revealStyle: "pop"`, `revealStagger: 6`,
  `revealFrames: 6`; `enter: "none"`, `exit: "pop"`, `exitFrames: 5`; the
  clip 24f long. Three to five of these back to back, one slot each, are an
  opening beat: "Turn *Books*" / "into *Audio*" / "*Just* drop and go".
- **Words appended to a standing line.** One text clip,
  `"Translate. Dub. *Distribute*"`, `reveal: "words"`, `revealStyle: "pop"`,
  `revealStagger: 15`, `revealFrames: 6`. Each word pops in 15f after the
  last while the earlier ones hold, and the line is set at its final width
  from frame one, so nothing reflows. Hold 30f after the last word lands.
- **A phone flying in.** A `device` clip, `"device": "phone"`, `src` the
  screenshot, box 0.18 × 0.72 at (0.68, 0.52), `tiltY: 25`, `shadow: 0.6`;
  `enter: "rise"`, `enterFrames: 20`, `travel: 0.3`, `spring: 0.35`. Then
  the drift for the rest of the beat:
  `motion: { "x": 0.02, "y": -0.015, "rotate": 2, "easing": "linear" }`.
  Six of them from the corners, 3f apart, with a text wall behind (below).
- **A card that lifts under the cursor.** The card: a `device` `"card"`, or
  the screenshot as an image, `shadow: 0.3`,
  `motion: { "scale": 1.04, "frames": 8, "delay": 16 }`. Above it,
  `hand-cursor` from the library,
  `motion: { "x": 0.18, "y": 0.10, "frames": 16, "easing": "in-out", "press": true }`,
  so it arrives on frame 16 and presses as the card lifts. `sfx-click` on
  frame 16.
- **The push-in.** The button is a text clip, `"Translate"`, Inter 500 at
  0.04, `fill: "#111114"`, `color: "#F6F7FC"`, `radius: 0.5`, box
  0.16 × 0.08, holding still. The cursor glides to it over 18f with
  `press: true`; the camera pushes in over the same 18f:
  `{ "from": N, "frames": 18, "x": 0.62, "y": 0.58, "scale": 1.6 }`. On
  frame N+20 the button clip ends and a second text clip with the same box
  and words takes over, `enter: "none"`, `fill` the accent: the pressed
  state. One more camera move, later, pulls back out.
- **Progress with a counter.** A `shape` rect, box 0.5 × 0.02 at (0.5, 0.52),
  `fill: "#4F5BFF"`, `fillTo: "#7CC7FF"`, `fillAngle: 90`, `radius: 0.5`,
  `enter: "wipe"`, `enterFrames: 45`. Above it at y 0.44 a mono text clip,
  `"100%"`, `reveal: "count"`, `revealFrames: 45`, so the number runs up as
  the bar fills. `sfx-tick` on the last frame.
- **Done, with a check and confetti.** An `icon` clip, `"check"`,
  `draw: true`, the accent colour, box 0.06 × 0.11 at (0.5, 0.42),
  `enter: "scale"`, `enterFrames: 12`; a text clip `"Done"` at y 0.56,
  `enter: "pop"`, `enterFrames: 6`, starting 4f later; a `particles` clip,
  `confetti`, 90 pieces, blue, cyan and pink, box centred at (0.5, 0.5), 40f
  long, starting when the check finishes drawing. `sfx-impact` on that
  frame. Once per film.
- **The sparkle swoop.** An `icon` clip, `"sparkle"`, the accent colour, box
  0.12 × 0.2, `motion: { "scale": 0.33, "frames": 10 }`, 10f long: it
  arrives at three times its size and shrinks to it. A second sparkle clip
  on the same track from frame 10, at icon size,
  `motion: { "x": 0.28, "y": 0.14, "frames": 24, "easing": "in-out", "arc": 0.6, "spring": 0.3, "trail": true }`,
  landing exactly at the end of the next line, where its caret would sit.
  The only trail in the film.
- **The out-of-focus text wall.** A text clip, Inter 400 at 0.03,
  `align: "left"`, four lines of real product copy in a 0.9-wide box,
  `blur: 0.5`, box `opacity: 0.35`, `enter: "fade"` over 24f, on the track
  behind the subject. Texture, not reading matter; the subject in front is
  sharp.
- **The logo end card.** Background the accent as a solid, or the ground.
  The wordmark as an `image` from `assets/`, width 0.3, centred at y 0.44,
  `enter: "scale"`, `enterFrames: 18`, `exit: "none"`. Beneath it at y 0.56
  a mono text clip with the URL, `reveal: "type"`, `revealFrames: 30`,
  `caret: true`, starting 12f after the mark. Hold 90f. Nothing else moves.

## Making a good one

You are directing, so the craft is yours. What the medium rewards:

- **Say one thing.** A fifteen-second video that lands one idea beats one that
  lists five. Cut the second-best line.
- **Open on the problem, not the product.** "Six clicks to assign an issue"
  earns attention that "Introducing Vector" spends.
- **Hold long enough to read.** A line of text needs roughly 0.3 seconds per
  word plus a second. Under two seconds for anything but a single word is too
  fast, and everyone gets this wrong in the same direction.
- **Move the eye deliberately.** If two things animate at once the viewer sees
  neither. Stagger by 6 to 12 frames.
- **Let the ground do work.** A gradient background and one accent colour will
  carry a whole film; four colours will not.
- **Put the product on screen.** A real screenshot in a `device` frame,
  tilted and shadowed, beats any headline about it. If you have none, ask
  before you build.
- **Silence is a choice.** If there is no audio, the fades have to carry the
  rhythm. If there is music, cut on it.

Fifteen to twenty-five seconds is the range for a launch film. Under ten reads
as a teaser; over forty and people leave.

### Boards are roughs

A storyboard panel has words, a frame description, timing and transitions —
no colour, no face, on purpose: the board is where the cut is argued, and
the style stage is where colour is decided. The boards and the animatic's
placeholder clips draw their ink automatically against the film's
background, dark on a light ground and light on a dark one, so do not try
to style them and do not worry about their contrast. When the person asks
for colours at the storyboard stage, note it for the style stage and say
so in your summary.

## Look before you show

You can see the film. `prism.capture_frames` renders exact frames (the same
pixels export produces) and returns them as storyboard sheets: six to a
sheet, three across, each cell captioned with its board number, time and
frame. It is not a screenshot of a playing video, so there is nothing to
catch: "one per second from six to nine" is frames 180, 210, 240 and 270,
every time. Six frames is one sheet and the cheapest look; ask for more and
you get more sheets at the same frame size. If a grid is hard to read, or you
want one moment large, pass `layout: "single"` and each frame comes back as
its own full-width image.

Use it the way an editor scrubs. After you build a section, capture it at one
frame per second and read the sheet as a sequence: does the headline arrive
when the script says, does anything overlap, is the text legible at that size,
does the eye have one thing to follow. When a moment looks wrong, capture it
closely (`at: [6.0, 6.1, 6.2, 6.3]`) to see the easing, then fix the clip
and capture again. Do this before you ask the person to look; they should be
reviewing your judgement rather than finding your bugs. They see every sheet
you capture in the Activity panel.

## After you submit

Every stage you submit opens for the person at reading size in PrismLaunch,
with Approve and Send back at the end of it. Then hand the turn back:
tell them the stage is waiting for their review, END YOUR TURN, and ask
them to message you once they have approved it or sent it back. Do not
poll and do not hold long waits — that burns your context for nothing.
When they ping you, read the decision with `prism.get_project_context`
(their note is in `process.stages.<stage>.personSaid`), or call
`prism.wait_for_decision` once — it returns the decision, their note and
the next instruction, and waits briefly if they are mid-click. Never
build past an undecided stage, and never resubmit while one is waiting.

## Working with the person

Show it rather than describing it. After you build something, call
`prism.preview` so they watch it rather than reading your summary of it. When
you are discussing one moment, `prism.seek` to it first; it is much easier to
agree about a frame you are both looking at.

Then stop and let them review the stage. Your `revisionNote` on each clip
tells them what changed and why. They approve the stage, or send it back with
a note you address.

When every stage is approved, propose the render. Say why you think it is
ready. Then wait. `prism.confirm_render` fails until they have clicked
approve, and retrying will not change that.

## When something is wrong

- **"Nothing is linked yet."** Ask them to click **Link project folder**, or
  **Start in the browser** where a folder cannot be linked. You cannot do
  either.
- **"A folder is remembered but the browser dropped its permission."** Ask them
  to click **Re-open folder**. This happens on every fresh page load; it is
  normal behaviour rather than a fault.
- **"clips … overlap".** Two clips on one track want the same frames. Put one on
  another track.
- **"Track … is locked."** The person locked it to protect it. Ask before
  assuming they want it unlocked.
- **A validation error naming a field.** Fix that field and send it again.
- **`prism.confirm_render` refuses.** A human has not approved it yet. Ask.

## What this never does

PrismLaunch does not read the person's source code, run it, or send it
anywhere. It reads one JSON file and the assets that file names, renders in the
browser with WebCodecs, and writes the MP4 back into the folder. No video,
code or project file is uploaded. If you tell someone their repository was
analysed, that is not true.
