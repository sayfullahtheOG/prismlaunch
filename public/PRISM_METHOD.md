---
name: prism-method
description: How to make a promo video worth watching with PrismLaunch — the rules of pace, continuity, look, motion and sound that separate a launch film from a slideshow, and the process the studio holds you to. Read this before building anything; SKILL.md says how the tool works, this says what to do with it.
---

# The Prism Method

You have a canvas, layers, twelve transitions, one move per clip, depth and
tilt, icons, particles, device frames and a camera. That is enough to make
the film a studio would make. It is also enough to make the thing everyone
has already seen: a headline fading in, held for four seconds, replaced by
the next one.

The difference is a handful of rules. They come from a frame-by-frame read of
a studio-made launch film and from what the people who make these films say
they do. Where a rule gives a number, use the number. Frames are at 30 a
second: 1s = 30f.

**The whole method in one line: find the one idea, get the product on screen,
make events not slides, let objects carry the cuts, and let a person decide.**

---

## 1. Events, not slides

Never decide how long a section lasts and then fill it. That is how a
headline ends up on screen for four seconds, and four seconds of a headline
is the definition of slow. Decide what *happens* — a line pops in, a phone
flies in, the cursor presses, the bar fills, the check draws, the line leaves
— give each event its frames, and the section is as long as its events add up
to. A section with one headline is one second. If that feels short, add an
event, never a hold.

- **An event** is something arriving, acting, or leaving. **Two events per
  second**, averaged over the film. More in a run of lines, fewer while the
  product is being used, never less than one every 1.5s except the end card.
- **A line arrives in 5–6f, holds as long as it takes to read once, leaves in
  4–5f.** The hold: `holdFrames = 12 + characters × 2`, capped at 60f. "Turn
  books into audio" (21 chars) holds 54f. A single hero word holds 20–30f.
- **Nothing sits.** Every component does something after it arrives: the
  folder is grabbed, the card lifts under the cursor, the button changes
  colour when pressed, the bar fills, the check draws itself, the sparkle
  flies off to become the caret. A thing that only appears and holds is a
  slide.
- **Text comes in runs**, not headlines. Lines of 1–4 words, three to five in
  a row, 6–9f between the words of a line and 15–30f between lines, each with
  one accent word. A five-line run is one beat of about two seconds.
- **The rhythm is fast–slow.** A run of lines (0.5–1s each), then an object
  beat of 2–3s where something is manipulated — a folder dragged, a UI zoomed,
  a button pressed. Sections are 2–4s; a 30-second film has ten to twelve.
- **The reference:** a 33-second studio launch film has 12 sections, about 60
  events, 35 words in 13 lines, text alone on screen 25% of the time, the
  product on screen 60%, and one still frame — the end card.

## 2. Objects cross the cuts

The story moves in sections; the components do not know where the sections
are. A promo is not a slideshow in which one phase ends and the next begins.
In the reference, the phone flies out of one section dragging a bar into the
next; the bar fills and becomes the check; the check becomes the card; the
card slides into the app; the button becomes the sparkle; the sparkle becomes
the star in the logo. Every cut is crossed by something already in flight.

- **Every section boundary has a handoff:** one object on screen on both
  sides of it. Name it in the storyboard panel's `handoff`. When there is
  genuinely nothing to carry, cut hard on the beat — never fade to nothing
  and fade up from nothing.
- **Clips are not kept inside sections.** The timing lock fixes the film's
  length and the grid of section starts; a clip may start in one section and
  end in the next, and the handoff object should be one clip that spans the
  cut.
- **Exits overlap entries.** The next thing starts arriving 3–6f before the
  last has gone. There is never an empty frame except the deliberate pause.
- **Prefer the camera to the cut.** Pushing 1.4–1.8× into the button as the
  cursor reaches it is a cut with the object carried for free. Four camera
  moves at most, none under 15f, into something that holds still.
- **Continuity of place.** A thing that leaves to the left is next seen
  arriving from the left; a card that lifts becomes the card in the next
  frame at the same size. Position and scale are the thread the eye follows.

## 3. The other rules the reference teaches

- **Open on words within 6 frames.** No fade from black, no logo, no
  "introducing". The first line is already popping in at frame 0.
- **The product is the actor.** Real screenshots in `device` frames, on screen
  at least half the time, tilted 8–25° with `shadow` 0.4–0.6, flying in with
  `travel` 0.25–0.35 and `spring` 0.3–0.4, then drifting 0.02–0.04 of the
  canvas over the whole beat. A product film without the product is text on a
  gradient. Get the assets at the brief (§5).
- **The cursor is the narrator.** Interactions are shown, not described: a
  hand glides in over 12–20f, presses, and the thing pressed answers on the
  next frame — the card lifts to 1.04, the button turns the accent colour,
  the row opens. Every press has a reaction.
- **Two planes.** The background plane — a wall of out-of-focus text, a
  scatter of cards — drifts slowly and stays blurred while the foreground
  pops. The drift is texture; the pop is the event.
- **Ration the fireworks.** One confetti burst, on the one "Done". One trail,
  on the one swoop. One gradient, on the progress bar. Glow on one thing or
  none. The rest of the film is restraint, which is what makes those land.
- **The ending is the only stillness.** The tagline, then the wordmark held
  60–90f with the URL typing under it. Nothing else in the film holds still.
- **Two-tone type.** Every line has one word in the accent and the rest in
  ink: `"Turn *books* into audio"`. The accent goes on the word that matters
  and never on two.

---

## 4. The process

Eight stages, each a `submit_*` tool. The tool for a stage refuses until the
person has approved the one before; you cannot approve anything yourself.
After each submit, end your turn and ask the person to ping you when they
have decided.

| Stage | Produces | Locked here |
|---|---|---|
| **Brief** | Who, the one message, the one feeling, the length; the assets | Length, message |
| **Concept** | Three directions, one recommended | The idea |
| **Script** | The words as lines and runs, with seconds derived from their events | Word count, order |
| **Storyboard** | One panel per section: the events, their frames, the handoff | Section count |
| **Style frames** | The elements, and 2–3 sections built for real | Ground, ink, accent, type, depth, register |
| **Animatic** | The boards on the timeline, cut to the music | **Length and section grid** |
| **Polish** | The rough reviewed against §12, the sound rethought | The fix list |
| **Build** | Every section built, objects carrying the cuts, sound placed | Nothing new |

**The lock.** When the animatic is approved, the film's length and the section
starts are fixed. Clips may cross sections; they may not run past the end.
Lengthening the film is the person's decision, made by reopening the
animatic. Timing changes after forty clips exist are how films go wrong, and
it is a sequencing error, not a taste error.

## 5. Brief, assets, concept

**Brief.** One kind of person, specifically. One message with no "and". One
feeling, one word. 15s is one idea; 30s is one idea with a turn (the sweet
spot); 45s is an escalation.

**Get the product.** At the brief, not later, ask for: the logo (SVG or PNG on
transparent), three to six screenshots at 2×, the brand colour, and a short
screen recording if the film needs one. The person drops them onto the
Elements section and they land in `assets/`. Without them you are making
text on a gradient, and no rule below will save it.

**Concept.** Generate before you evaluate: 8–12 angles, three directions, one
recommended. The angles worth running: the single strongest truth ("1,000
songs in your pocket"); before/after; the enemy (a condition, not a
competitor: tab sprawl, the blank page, six clicks); demo as story; one
visual contrast (many→one, noise→quiet); the change in the world. Score each
direction 0–2 on six tests — one line with no "and"; only-us (swap in a
competitor's name — does it still work?); a nameable feeling; a *picture*, not
a description; the strongest image by 0:03; buildable from these primitives —
and kill anything under 8 of 12.

## 6. Words

- On-screen copy: **under 40 words in 30 seconds**, in lines of 1–4 words. A
  line is the shot for at most `12 + chars × 2` frames; longer only while the
  product is doing something beside it.
- Second person. Nouns, verbs, numbers; delete the adjectives — "effortless"
  and "seamless" are requests to be believed. Comparative and falsifiable
  beats absolute and vague: "ten pages in the time it takes to read one".
- The hero line passes three tests: can I picture it, can it be proven
  false, could nobody else say it word for word.
- Voiceover only if the picture cannot say it: ~70 words per 30s at 150 wpm,
  written to read in 90% of its window, never the words on screen.

## 7. Look

**One ground, one ink, one accent.** The accent is rationed to the word that
matters and the one object the frame is about. Gradients only on one object,
between neighbouring hues (Δ ≤ 20°) — the purple-to-blue diagonal is the
signature of generated work. Off-white or off-black grounds, never `#FFFFFF`
or `#000000`.

**Type.** Two roles per frame, two typefaces per film. Display sizes get
negative tracking (−0.02 to −0.04) and tight leading (0.95–1.05); positive
tracking only on uppercase mono labels. Hero : caption ratio ≥ 4 : 1. Floors:
nothing informational below 0.034 of the height. For N characters on a line,
Inter fits at up to 2.4/N, Instrument Serif at 3.1/N.

**Layout.** Margins 0.08–0.10. One alignment for the film. A centred line at
`y: 0.47`, not 0.50. One or two elements per frame; three if the third is a
cursor or a rule. Shapes do a job or they go.

**Depth.** Everything that floats has `shadow` 0.3–0.6; product frames tilt
8–25°; the background plane sits at `blur` 0.3–0.6 and opacity 0.3–0.5.

**Four looks.** Pick one at the style stage; every value is ready to write.

- **KINETIC** — *consumer SaaS, AI products, bright UIs, a launch that has to
  feel alive; the reference's register.* Ground `#F6F7FC`, ink `#111114`,
  accent `#2F7CF6`, a lighter `#7FB6FF` where a line needs two. Inter 500–600
  at 0.085–0.10, tracking −0.025, lines two-tone and centred at 0.47. Real
  screenshots in `phone` and `browser` frames, tilted, `shadow` 0.5, drifting.
  The one gradient `#4F5BFF` → `#7CC7FF` on the progress bar. Confetti once.
- **VOID** — *developer tools, dark UIs.* Ground `#08090A`, ink `#F7F8F8`,
  muted `#F7F8F899`, the brand hex as accent in two frames of the film. Inter
  600 at 0.18, tracking −0.035, left-aligned at margin 0.09. Device: a 2px
  accent rule above the hero. The kinetic rules still apply; the palette is
  quieter, not the pace.
- **PAPER** — *calm consumer products.* Ground `#F6F5F2`, ink `#16161A`, muted
  `#6E6E73`, accent almost never. Instrument Serif at 0.22 for the hero,
  Inter 400 at 0.034 for support, centred. The hardest look to make
  memorable; earn it with pace.
- **SPEC** — *benchmarks, changelogs, numbers.* Ground `#0A0A0A`, ink
  `#EDEDED`, muted `#8F8F8F`, no accent. Inter 450 at 0.20, tracking −0.055;
  numbers take the hero slot with a mono label above; hairline rules under
  each metric.

**End card, any look:** the wordmark centred at 0.47, one mono line beneath,
held 60–90f. One frame, at the end.

**Style frames.** Define the look as elements — the type roles, the accent,
each device frame, each product shot, the music bed — with
`prism.add_element` and `prism.add_from_library`, build two or three sections
for real by placing them, and name both in `prism.submit_style_frames`. From
then on a change to the look is `prism.update_element`, and every placed
clip follows.

---

## 8. Motion

**Timing and spacing** are the whole craft: how many frames a move takes, and
the offset between one thing and the next. Enter decelerates, exit
accelerates; exits are 60–80% of entries. One thing leads in the foreground;
the rest hold or drift.

### Frame counts

| Element | in | out | notes |
|---|---|---|---|
| Line in a run | 5–6 (`pop`) | 4–5 (`pop`) | words 6–9f apart, `revealStyle: "pop"` |
| Hero word, held | 12–16 | 8 | `scale` or `rise`; never `spring` on text |
| Support line, label | 8–12 | 6 | `rise` or `fade` |
| Icon, chip, check | 8–12, `spring` 0.3 | 6–8 | `draw: true` on the check |
| Card, device flying in | 18–24, `travel` 0.3, `spring` 0.35 | 10–12 | tilt 20–30°, then drift |
| Product held on screen | — | — | `motion` drift 0.02–0.04 over the beat, `easing: "linear"` |
| Cursor glide | 12–20 (`motion`, `in-out`) | 6 (`fade`) | `press: true`; the target reacts next frame |
| Camera push | 15–24 | 15–24 | 1.4–1.8×; ≤ 4 per film |
| Confetti | 40 | — | ~90 pieces, once |
| Wordmark, end | 18–24 | none | hold 60–90f |

Hard limits: nothing enters under 4f (a pop) or over 24f (a crawl), except a
`wipe` that a counter runs against (45f) and full-frame backgrounds.

### Transitions

| Transition | Use for | Notes |
|---|---|---|
| **none** | The hard beat: a word landing on a downbeat | Precede with 6–8f of empty frame |
| **fade** | Backgrounds, atmosphere; the default exit for the quiet looks | 24–40f full-frame |
| **rise** | Held text in VOID, PAPER, SPEC | `travel` 0.03; stagger siblings 4–6f |
| **fall** | A subhead under a logo already on screen | A fifth as often as `rise` |
| **slide-left / slide-right** | Time, sequence, before/after | Direction must match across the cut |
| **scale** | Emergence: a card, a logo, the one hero word | From 0.94; `spring` 0.3 on objects |
| **blur** | Focus pulls; the outgoing clip while the incoming pops | Pair with `scale` for a rack focus |
| **pop** | Every line in a kinetic run; a chip, a badge, a count landing | Out of focus and 15% large, settling; the exit shrinks out |
| **zoom** | A shot replaced from inside itself; through the camera | In from 0.6, out to 1.4 with blur |
| **flip** | A card turning up: a result, a price, a proof | Cards and devices, never text |
| **wipe** | A bar filling; an underline drawing on; a mask reveal | The exit uncovers from the left |

**Grammar: pick two** — in KINETIC, `pop` and one directional, with `wipe`
where a bar fills — and let one accent move (`zoom`, `flip`, `scale`) happen
once. At least one true cut (`none` out, `none` in) on a downbeat.

### Recipes

- **Kinetic line** — `text: "Turn *books* into audio"`, `accent`, `reveal:
  "words"`, `revealStyle: "pop"`, `revealStagger: 6`, `revealFrames: 6`,
  `exit: "pop"` 5f; the clip = 6 + words×6 + hold + 5 frames.
- **Words appended to a standing line** — one clip, `revealStagger: 15`; each
  word lands where it already sits, the earlier ones hold.
- **Flying phone** — `device: "phone"`, `src`, `box` `tiltY: -20`, `shadow`
  0.55, `enter: "slide-right"`, `travel` 0.3, `spring` 0.35, 20f; then
  `motion` `{ x: 0.03, easing: "linear" }` for the beat.
- **Card lifts under the cursor** — hand cursor with `press: true` arriving at
  frame N; the card's `motion` `{ scale: 1.04, frames: 6, delay: N }` and
  `shadow` 0.5.
- **Push into the button** — camera move `{ from: N-6, frames: 18, x, y,
  scale: 1.6 }` as the cursor arrives; press; a second text clip in the
  accent `fill` replaces the first on the frame after.
- **Progress with a counter** — a `shape` with `fill` → `fillTo`, `radius`
  0.5, `enter: "wipe"` 45f; a `count` line above with `revealFrames: 45`.
- **Done** — text "Done" `pop`; `icon: "check"`, `draw: true`, `spring` 0.3
  over 12f; `particles` confetti, 90 pieces, 40f, from the check's box.
- **Sparkle swoop** — `icon: "sparkle"`, `glow` 0.4, `motion` `{ x, y, arc:
  0.6, spring: 0.3, trail: true, rotate: 180, frames: 24 }` landing as the
  caret of the next line.
- **Text wall** — a body-text paragraph at `blur` 0.5, opacity 0.35, drifting,
  behind the phones.
- **End card** — the wordmark `scale` 20f, `spring` 0.2; the URL under it with
  `reveal: "type"`, `caret: true`, 2f per character; hold 60–90f.

---

## 9. Sound

Choose the music before the storyboard is timed: tempo sets the section grid.
Prefer a frame-locked tempo at 30fps and compute every beat from the anchor,
never by adding a rounded value cumulatively.

| BPM | frames/beat | frames/bar | 8 bars |
|---|---|---|---|
| 72 | 25 | 100 | 800 |
| 75 | 24 | 96 | 768 |
| 90 | 20 | 80 | 640 |
| 100 | 18 | 72 | 576 |
| 120 | 15 | 60 | 480 |
| 150 | 12 | 48 | 384 |

For any tempo `beatFrame(n) = downbeat + round(n × 1800 / BPM)`. Put the
downbeat's offset in the music clip's `startFrom`. Cut 2–4 frames *before*
the beat. Cut on downbeats for structure, on off-beats for texture; the
product reveal goes on the drop, with 12–20f near-silent before it.

**Levels** (linear gain): bed 0.70–0.85, or 0.25–0.35 under VO; VO 0.9–1.0;
SFX 0.35–0.60; one impact 0.7–0.9; room tone 0.05–0.10 under the whole film —
never digital silence. Fades: 3–6f in on a downbeat, 30–60f out from a phrase
boundary, or none if the track has a real ending. Never stop a bed mid-phrase.

**Effects mark events.** A tick per word in a run (1f each), a click on a
press, a whoosh peaking *on* a fly-in, a riser that stops dead at the reveal,
one impact on the payoff. 12–25 effects per 60s, none in the 20–40f before
the reveal. Trim each file's silent head with `startFrom` so the transient
sits on the frame. The first three seconds must work muted.

The library ships `library/audio/` effects (whoosh, click, tick, impact, rise)
and three 30-second beds (calm 80 BPM, upbeat 120, cinematic); the beds' BPM
and a chosen `startFrom` go straight into the grid above.

---

## 10. Storyboard, animatic, build

**A panel is a section, written as its events.** Not a slide. `frame` says
what is on screen; `action` lists the events in order with their frames;
`handoff` names the object that carries into the next panel; `durationInFrames`
is the *sum* of the events, then nudged onto the beat grid. `words` are the
lines, starred. Board the first section, then the last, then the ones between.

```
PANEL 4  "Progress"   durationInFrames 84
frame:    the gradient bar centred, the counter above, ground empty
action:   phone exits left 12f dragging the bar → bar wipes on 45f while the
          count runs 67→100 → bar collapses to a pill 8f → the check draws 12f
handoff:  the check, becoming the card in panel 5
words:    *Done*
sound:    ticks under the count, one impact on 100
```

**The animatic.** `prism.lay_animatic` puts one placeholder per panel on the
timeline at cumulative frames; add the music with the downbeat anchored, move
any board that is off the grid, watch it, and `prism.submit_animatic`. When it
is approved the length and the section starts are locked. The animatic is
crude on purpose: if the person is talking about colour, it is too finished.

**The build.** Place elements — `prism.place_element` — rather than inventing
clips; `prism.add_text` and its siblings are for the genuinely one-off. Build
section by section, but build the handoff object as one clip across the cut.
One layer per role (Titles, Product, Cursor, Accent, Music, SFX), every clip
labelled, a `revisionNote` on each. Then `prism.capture_frames` at one frame
per second and read the sheet: does something happen every half second, does
an object cross every cut, is the product on screen most of the time, is any
line held longer than it takes to read. Fix, capture again, then show the
person with `prism.preview`.

**Working with the person.** They decide; you propose. Batch by stage, never by
clip. Recommend, don't enumerate. Show, don't describe: `prism.seek` to the
frame you are discussing. Never silently re-time — surface it as a choice.
Defend the idea, the pace and the handoffs; concede colour, wording and asset
choice. Only they can approve a stage, and only they can approve the render.

---

## 11. The tells

If you recognise one of these in your film, that is the note.

**Pace.** A headline held for four seconds. A section decided in seconds and
filled. Every card the same length. A logo before the hook. A fade from
black. Nothing moving between the words.

**Continuity.** Fade out, fade in. A new frame that shares nothing with the
last. The product appearing and disappearing whole. The cursor absent from a
film about an interface.

**Look.** Purple-to-blue gradients. Five colours. Pure black under pure
white. Everything at (0.5, 0.5). Positive tracking on display type. Three
typefaces. A sentence at hero size. Text over the busy centre of a
screenshot. Floating shapes doing nothing.

**Motion.** Everything entering at frame 0. The same transition on every clip.
Bounce on text. Tilt on everything, confetti on every beat, glow on
everything, a camera that never stops, all twelve transitions because they
exist.

**Sound.** The corporate-upbeat bed. Music laid under a finished edit. A
whoosh on every cut. The track ending because the video ended. Digital
silence.

## 12. Before you propose the render

Run all of it against the rough, and report each line with a verdict in
`prism.submit_polish`.

- [ ] The idea in one sentence with no "and"; frame 1 has words; the strongest image by 0:03
- [ ] Two events per second on average; no line held past `12 + chars × 2`; no still frame but the end card
- [ ] Every section boundary crossed by a named handoff object, or a hard cut on the beat
- [ ] The product on screen at least half the film, in device frames, with real screenshots
- [ ] Every press has a reaction on the next frame; every cursor glide is 12–20f
- [ ] < 40 words; every line ≤ 4 words with one accent word; adjectives purged
- [ ] One look, chosen once: ground, ink, accent, two type roles per frame, margins 0.08–0.10
- [ ] Depth: floating things at `shadow` 0.3–0.6; tilt ≤ 30°; background plane blurred and drifting
- [ ] `pop` on every line of a run and nowhere else; `spring` never on text; ≤ 4 camera moves, none under 15f
- [ ] One confetti burst, one trail, one gradient, glow on ≤ 1 thing
- [ ] Music anchored on a downbeat; cuts 2–4f early; effects on events; no digital silence; the first 3s work muted
- [ ] The end card: tagline, then wordmark held 60–90f with the URL typed
- [ ] Watched three times: sound on, muted, half size — then the person, not you, is the final reviewer

---

## Sources

The frame-by-frame reference is a 33-second SaaS launch film (LangEase, 2024).
Process and craft: Adam Lisagor on [Changelog #601](https://changelog.com/podcast/601);
Jay Grandin on the [School of Motion podcast](https://www.schoolofmotion.com/blog/jay-grandin-podcast-podcast);
[Ordinary Folk — Process](https://www.ordinaryfolk.co/process);
School of Motion on [animatics](https://schoolofmotion.com/blog/what-are-animatics-and-why-are-they-important).
Narrative: Walter Murch via [StudioBinder](https://www.studiobinder.com/blog/walter-murch-rule-of-six/);
[Nielsen on early attention](https://www.marketingdive.com/news/brand-lift-happens-in-less-than-1-second-of-video-study-finds/377333/);
[Google's ABCD playbook](https://www.thinkwithgoogle.com/_qs/documents/8472/ABCD_Complete_V7b_HR_1.pdf);
[Harry Dry on copywriting](https://marketingexamples.com/copywriting);
the films [Linear Releases](https://www.youtube.com/watch?v=6dIwFoQ0eVg) and [Apple iPhone X](https://www.youtube.com/watch?v=Qy-s2SGb7C4).
Motion: [Emil Kowalski's animation standards](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md);
[Material motion](https://m1.material.io/motion/duration-easing.html);
[Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion);
[Rauno Freiberg on interaction](https://rauno.me/craft/interaction-design).
Look: [Butterick's Practical Typography](https://practicaltypography.com/summary-of-key-rules.html);
[Inter's dynamic metrics](https://d.rsms.me/inter-website/v3/dynmetrics/);
[Linear Brand](https://linear.app/brand);
[Refactoring UI on palettes](https://refactoringui.com/previews/building-your-color-palette).
Sound: [Twenty Thousand Hertz, *The Sound of Apple*](https://www.20k.org/episodes/the-sound-of-apple);
[Nicolas Titeux on sound for motion](https://www.nicolastiteux.com/en/blog/sound-design-for-motion-design/);
[EBU R128](https://tech.ebu.ch/docs/r/r128.pdf);
[LANDR on phone speakers](https://blog.landr.com/make-bass-audible-phone-speakers/).
