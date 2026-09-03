---
name: prism-method
description: How to make a promo video worth watching. The craft — concept, script, storyboard, timing, look, motion, sound, review — for an agent directing PrismLaunch. Read this before building anything; SKILL.md tells you how the tool works, this tells you what to do with it.
---

# The Prism Method

You have a timeline, a stack of layers, twelve transitions, three typefaces
and a camera. That is enough to make something people stop for. It is also enough to make
the thing everyone has already seen: a purple gradient, six centred headlines
that all bounce in, a whoosh on every cut, and a music bed that ends because
the video did.

The difference is not the tool. It is a sequence of decisions, made in an
order, most of them before a single clip exists. This document is that
sequence. It was assembled from what the people who make the best of these
films — Sandwich, Giant Ant, Buck, Ordinary Folk, Apple's and Linear's and
Raycast's own teams — say they actually do, and from the perceptual research
underneath it. Where it gives a number, the number is theirs.

The whole method in one line: **find the one idea, lock the timing to the
music before you design anything, spend the frame on almost nothing, and let a
person decide.**

---

## 0. What you are making

A **composition**: 1920×1080 at 30fps, a background, visual layers above it,
audio layers below it. Clips on layers: text, shapes, images, video, icons,
particles, device frames, sound. Each clip has a start frame, a length, a
normalised box (centre x/y, width, height, rotation, opacity, a perspective
tilt), and an enter and exit from `none | fade | rise | fall | slide-left |
slide-right | scale | blur | pop | zoom | flip | wipe`, each with a frame
count, a `travel` distance and a `spring`. Text has a size as a fraction of
canvas height, a family (`display` = Instrument Serif, `body` = Inter
400–900, `mono` = JetBrains Mono), colour, alignment, tracking, leading, and
an `accent` for the starred words of a two-tone line. Every visual clip can
make one `motion` over its life — travel, scale, rotate, opacity, blur, an
arc, a spring, a trail — and carries a `shadow`, a `glow` and a `blur`.
Shapes take a gradient fill. Icons draw themselves on. Particles burst.
Device frames hold screenshots. A camera makes up to four moves in a film.
Still no keyframe lists: one move per clip, one list of camera moves, and
everything else is a name. Anything in this document that sounds like it
needs more has a recipe in §8.

The unit you think in is the **beat**: one idea, on screen for 2–6 seconds,
made of one to three clips. A 30-second film has five to seven beats. You
design beats, then place them; you never start by placing clips.

Frames, throughout: **30 per second.** One second = 30f. Half a second = 15f.

---

## 1. The pipeline, and what is locked where

Every credible account of this work describes the same spine. The names vary;
the order and the lock points do not.

| Stage | Produces | The question it answers | Locked here | Effort |
|---|---|---|---|---|
| **Brief** | One paragraph: who, one message, one feeling, length | Who is this for and what must they feel? | Length, the single message | 5% |
| **Immersion** | Notes: what the product does, the demo moment, users' own words | What is true here that nobody else can say? | — | 10% |
| **Concept** | 3 one-line directions, 1 recommended | What is the one idea? | The idea. Everything downstream serves it | 15% |
| **Script** | The words, timed | What is said, in what order? | Word count, beat order, the button | 10% |
| **Storyboard** | One panel per beat: frame, action, duration, transition, sound | What is on screen at each beat? | Beat count, shot list | 10% |
| **Animatic** | Boards on the real timeline, cut to the real music | Does it *feel* right at speed? | **Timing. Permanently.** | 10% |
| **Style frames** | 2–3 finished hero frames | What does it look like? | Ground, ink, accent, type, margins, motif, the motion register | 10% |
| **Build** | Real clips replacing the boards, in place | — | Nothing new. Execution only | 20% |
| **Sound** | Music and accents under locked picture | Does it land? | The mix | 5% |
| **Polish** | The fix list, burned down | Is it shippable? | Everything | 5% |

Two rules carry the whole table.

**Timing is locked before the build.** The pieces come first — the approved
boards say what elements the film needs, and the style stage defines them —
then you cut the animatic to the music, get it approved, and after that no
in-point or out-point moves without it being surfaced as a decision. Change
the timing after forty clips exist and every
synced moment has to be re-found. This is the single most common way a film
goes wrong, and it is a sequencing error, not a taste error.

**Half the work happens before a finished frame exists.** Brief through style
frames is 60% of the effort. Adam Lisagor, who has made these films for Slack,
Square and Airbnb: "most of the value is upfront, at the conceptualisation
phase." A film he describes as executed perfectly was shelved anyway because the
brief was wrong. Perfect execution of the wrong idea is a dead film.

**In this tool, the stages map directly:**

- Brief, immersion, concept, script — text you write, before touching the
  timeline.
- Storyboard and animatic — one text or shape clip per beat, *labelled*, placed
  on the real timeline with the real music underneath, transitions already
  chosen. Ugly on purpose. This is what the person reviews first.
- Style frames — two or three beats built for real, to approval, before any
  other beat is built.
- Build — replace each board clip with real clips **without moving its in or
  out point**.

---

## 2. Brief and immersion

Before anything else, write down:

- **Who is watching.** One kind of person, specifically. "Engineers who ship
  on Friday and get paged on Saturday," not "developers."
- **The one message.** One sentence. No commas, no "and". If it needs an "and"
  it is two films — cut one.
- **The one feeling.** One word. Jay Grandin of Giant Ant opens every project
  not with "what should this look like" but with "what do we want people to
  know, and — more importantly — how do we want them to *feel* as they're
  knowing that?" Relief. Envy. Recognition. Calm. If you cannot name it, there
  isn't one yet.
- **The length.** 15 seconds is one idea with no turn. 30 seconds is one idea
  with a turn — the sweet spot, and 84% of viewers finish it. 45 seconds is one
  idea with an escalation. Never 45 seconds for a 15-second idea.

**Get the product.** At the brief, not later, ask for: the logo (SVG, or PNG
on transparent); three to six screenshots at 2×, of the screens the demo
moment lives on; the brand colour as a hex; and a short screen recording if
the film needs one. They go in `assets/` — the person drops them on the
Elements section, or your file tools put them there. A product film without
the product is text on a gradient, and no amount of motion will hide it.

Then immerse. Read the product. Find the *demo moment* — the single
interaction that, seen once, explains the whole thing. Find the words its users
use when they talk about the problem, because those words are the script's raw
material and yours are not. Find what is true of this product and false of
every competitor: that sentence is the film.

---

## 3. Concept — finding the one idea

**Generate before you evaluate.** Grandin's warning is the most useful sentence
in this field: "a pitch doesn't favour the best idea. It favours the *first*
idea." An agent that generates one concept and builds it will ship the first
idea every time, and the first idea is the one everybody else had too.

So: **8–12 raw angles → 3 directions → 1 recommended.** Twelve is enough to get
past the obvious; three is what a person can hold in their head.

### Angles worth running

Each is a different lever. Run several; most will be weak; that is the point.

- **The single strongest truth.** The one thing true here and false elsewhere,
  as one sentence. Apple, 2001: "1,000 songs in your pocket."
- **Before / after.** The viewer's life at 0:00 versus 0:30. Mirror the
  frustration first so the relief has something to land on.
- **The enemy.** Not a competitor — a *condition*. Tab sprawl. The blank page.
  Waiting. Six clicks.
- **Demo as story.** Lisagor's method: what are the parts of this product that
  need explaining so someone understands it naturally, and in what order? The
  product doing its job *is* the plot.
- **The contrast.** One visual axis carries the whole film: many→one,
  noise→quiet, slow→fast. Linear's Releases film is forty lines converging into
  one word, and that is the entire argument.
- **The refusal.** Open on scepticism. Sandwich's Slack film starts with the
  narrator not believing the pitch, and the title doesn't land until 25% in.
- **The change in the world.** Andy Raskin's structure, the most-copied in
  software: name an undeniable shift → there will be winners and losers → show
  the promised land → present the product as the way there → prove it.
- **Constraint as fuel.** Pick one transition and make it the film's grammar.
  Pick one shape and make it the motif. The limit is the idea.

### The scoring rubric

Score each direction 0–2 on six tests. **Kill anything under 8 of 12.**

1. **One-line test.** Can you say it in one sentence with no "and"?
2. **Only-us test.** Swap in a competitor's name. If it still works, it is a
   category ad, not a launch film.
3. **Feel test.** Name the emotion in one word. If you can't, there isn't one.
4. **Visual test.** Does it produce a *picture*, not a description? "Trust" is
   not a picture. "Forty tabs collapsing into one line" is.
5. **Second-3 test.** Does the strongest image land before 0:03?
6. **Constraint test.** Is it buildable from text, shapes, images, video,
   icons, device frames and sound, with twelve transitions and four camera
   moves, at 1920×1080?

Present the three survivors to the person with one marked as your
recommendation and a one-sentence reason. Three, not ten: two feels binary,
more than three overwhelms, three lets you show a strong direction, a safe
alternative and one genuine swing.

### What the idea is *for*

Walter Murch, who cut *Apocalypse Now*, weights what a cut must serve:
**emotion 51%, story 23%, rhythm 10%**, and everything else — eye-trace,
planarity, spatial continuity — the remaining 16%. Sacrifice from the bottom
up. A viewer cannot retain eight facts from thirty seconds. They retain one
feeling and one sentence. Your concept is that feeling and that sentence.

---

## 4. Structure, the hook and the pace

### The first three seconds

Nielsen's analysis of 173 brand studies found viewers who watched **under
three seconds** delivered up to **47%** of a campaign's value; under ten
seconds, **74%**. Attention is front-loaded and it does not come back. Every
frame spent on a logo sting, a slow fade-up or "In a world where…" is spent
from the only budget that matters.

- **Frame 1 has content.** A fade from black is at most **6 frames**.
- **No logo before the hook.** The wordmark earns its place at the end.
- **Two shots in the first five seconds.** Google's analysis of 5,000 ads found
  this alone worth a measurable lift. One image, then another.
- **The hook is specific.** A concrete number ("Six clicks to assign an
  issue"). A visible contradiction. A question the viewer cannot answer. A
  state they recognise. Curiosity is a *gap*, and a gap has to be small and
  precise — the viewer must feel they nearly know. "Introducing the future of
  workflow" opens no gap; it is too vague to be missing anything. "Why read a
  web page when we can read ten in the same time?" opens one.
- **Illegal hooks:** a category noun ("Meet the AI-powered platform"), an
  adjective stack, a logo, a fade.

### Shapes that work

- **Problem → turn → proof → button.** The default. The problem is *shown*,
  never asserted — Sandwich dramatises Slack's problem through embarrassing
  specifics (a meeting held in a utility closet), not through the word
  "chaotic." The turn sits at **20–40%** of runtime.
- **One thing, four proofs.** No problem setup. Name it at 0:01, then show it
  four times, each shorter than the last. Notion's AI film. Best when the demo
  moment is strong enough to carry.
- **The ring.** State an intention at the start, name the thing, prove it,
  then say the name again at the end. Apple's iPhone X film opens "our
  intention has been to create an iPhone that is all display" and closes "This
  is iPhone X" — the same words, re-heard against three minutes of proof, mean
  more. The closing line should rhyme with the first.
- **The metaphor that resolves.** One visual idea that becomes the product's
  name. Linear: lines converge into `LAUNCH`. Nine seconds, zero copy.

### Pace

- **One idea per 4–6 seconds.** Five to seven beats in thirty seconds; nine is
  the ceiling.
- **Visual events every 2–4 seconds.** Sub-second cutting sustained for more
  than three seconds reads as a template, not energy.
- **Beats shorten.** Proofs at 5s, 4s, 3s. Even spacing — every card 2.0
  seconds — is a slideshow, and is the most legible signature of generated
  video.
- **Exactly one pause.** 0.8–1.5 seconds, at **70–80%** of runtime, on a
  near-empty canvas, immediately before the final line. On a 30-second film:
  a hold at 0:22–0:24. This is what makes the ending land. Linear dresses its
  pause as a blinking cursor on black; it is still a pause.
- **Silence is the loudest thing you have.** In a film full of motion, 1.5
  seconds of near-black with one line reads as a shout. Contrast creates
  emphasis; amplitude does not. Uniform intensity is perceptually flat.

### The ending

Prefer a **button** — a short line that closes the idea — over a call to
action. Then the wordmark, on a still frame, held **45–75 frames**. Apple ends
iPhone X with no price, no URL, no "buy." Linear's entire CTA is two words.

If there must be a URL, it gets its own frame after the button. Never crowd the
last image with logo + tagline + URL + badges: it ends the film on an ask
instead of a feeling, and reads as an ad.

**The last frame holds ≥ 24f** after the final transition, and **15–30f after
the last audio transient**, so the tail can ring out and the frame can be
screenshotted.

---

## 5. Script — the words

### Budgets

- **Voiceover:** ~75 words in 30 seconds at a conversational 150 wpm; motion
  work sits at 100–150. 15s ≈ 33 words, 60s ≈ 130. Write *short* — a 30-second
  script should read in 25–29 seconds. **Never speed the read to fit the
  words; cut words to fit the read.**
- **On-screen text, no VO:** 3–7 words per card, ≤ 2 lines, and **under 30
  words of message copy in the whole 30 seconds.** Linear's film uses about
  ten. On-screen text is read at a glance; it is proof, not narration.
- **VO and text never say the same thing.** The eye and the ear finish the
  same sentence and the moment stalls. VO carries the *argument*; text carries
  the *proof* — numbers, names, the product noun, the button.

Read it aloud with a stopwatch before building anything. Silent reading runs
about 40% fast, which is exactly how a 45-second script gets "fitted" into 30
seconds and ends up frantic. Your equivalent: words ÷ 2.5 = seconds. Compare to
the timeline. Cut before proposing.

### How long a line stays

Two rates exist and conflating them is a real error. *Caption rate* — text
alongside other action — tolerates up to 20 characters per second. *Display
rate* — the line **is** the shot — is roughly half that, because the line has
to land, not merely be decoded.

For a line that is the shot, the hold at full opacity, **excluding** enter and
exit:

```
holdFrames = 21 + (characters × 2.7)      clamped to [36, 105]
```

So a 23-character line holds ~84 frames (2.8s). Floors: a single hero word
**≥ 45f**, a full line **≥ 60f**, two stacked lines **≥ 75f**. Anything under
36f is decoration, not communication; anything over 105f is dead air unless it
is the deliberate pause. Add the enter (8–16f) and exit (6–10f) on top.

The exception is the **kinetic run**: three or more short lines, 1–4 words
each, that together are one beat — "Turn *books*" / "into *audio*" /
"*Just* drop and go". Each line holds **15–30f** and the run is timed as one
beat: the formula applies to the run's characters together, not to each
line, and the run sits in one board panel. A lone 20f line outside a run is
still decoration.

### How to write it

- **Second person.** "You ship on Friday and sleep on Saturday," not "Our
  platform enables organisations to…"
- **Nouns and verbs and numbers. Delete the adjectives.** "Effortless,"
  "seamless," "powerful" are requests to be believed. A demonstration is
  proof. Run the purge: strike every adjective; if a line becomes empty, it
  was empty.
- **The three tests** (Harry Dry) for the hero line: can I *picture* it? can it
  be *proven false*? could *nobody else* say it word for word? "1,000 songs in
  your pocket" passes all three. "A revolutionary digital music experience"
  fails all three.
- **No fake specificity.** "Trusted by thousands" — give the number or drop the
  claim.
- **Comparative and falsifiable beats absolute and vague.** "Ten pages in the
  time it takes to read one," not "faster."

---

## 6. Storyboard and animatic — timing before the build

### The board

One panel per beat. A panel is not a drawing; it is five fields:

```
BEAT 3   0:09–0:12  (frames 270–360)
frame:       black; one mono line centred, uppercase, wide-tracked
action:      line fades in over 10f, holds, cuts out
transition:  in fade 10 / out none (hard cut to beat 4 on the downbeat)
sound:       music drops to pad; UI tick on the cut
words:       PLAN AND TRACK RELEASES
```

Thumbnails first, no detail. A trick from School of Motion: board the first
beat, then the last, then fill in the transitions between — the ending decides
what the middle has to earn.

In this tool the board is `prism.submit_storyboard`: one panel per beat with
exactly those fields, in frames. The person reads them as boards in the
Process panel — a frame with the words roughed in and the notes beneath. That
is the film before it exists, and it is the cheapest moment there will ever be
to change it.

### The animatic

This is where the film is actually made, and in this tool it costs almost
nothing, so there is no excuse for skipping it.

1. **Choose the music first** (§9). Tempo sets the shot lengths. A track laid
   under a finished edit never fits.
2. **`prism.lay_animatic`.** Once the style frames are approved, this puts one
   placeholder clip per panel on the timeline, at cumulative frames from the
   panels' durations, carrying each panel's words and transitions. The words
   and durations are yours; the frame arithmetic — the thing an agent gets
   wrong by hand across nine panels — is the tool's.
3. Put the music on an audio track with `startFrom` set so a real downbeat
   sits at the clip's first frame. Move any board whose edge is off the grid
   onto it with `prism.update_clip`.
4. Play it. Watch it three times (§11). Fix the structure.
5. **Show it to the person, whole** — `prism.submit_animatic`. Structural
   notes now cost seconds to apply. The same note after forty finished clips
   costs the film.

Deliberately crude — School of Motion's animatics are black-and-white sketches
*because* roughness keeps the conversation on structure. If the person starts
talking about colour at this stage, the animatic is too finished.

When it is approved, **timing is locked.** Every in and out point is now a
board panel's slot. Building means filling slots.

---

## 7. Look — colour, type, layout

Do this *after* the storyboard is approved and *before* the animatic is laid:
the boards say what pieces the film needs, so define every one of them as an
element, build two or three hero frames to approval, then apply that look
to everything. Design decided clip by clip during the build produces drift —
five type sizes, four blues, no system.

### Colour

**One ground, one ink, one accent. The accent is rationed.** The premium
software brands are 95%+ achromatic. Raycast's site is 98% achromatic, with
one coral confined to the logo, one stripe and one badge. Vercel has no
marketing accent at all; its near-black *is* the brand. An accent only reads
as *meaning* if it is scarce: five colours point at nothing, and the eye has
no instruction.

- **Ground:** near-black, never `#000000` — Linear `#08090A`, Raycast
  `#040506`, Apple `#1D1D1F`. Or near-white, never `#FFFFFF` — Apple
  `#F5F5F7`, Arc's cream `#FFFCEC`. Pure black has no colour temperature and
  cannot belong to a palette; pure white on it halates at display size.
- **Ink:** off-white on dark (`#F7F8F8`), near-black on light (`#16161A`).
- **Muted ink:** the ink colour with alpha, `#F7F8F899` to `#F7F8F8B3`
  (0.60–0.70), never a mid-grey. Grey on a coloured ground goes muddy.
- **Accent:** the product's own brand colour. One. On **≤ 10% of lit pixels**,
  and always on the one thing the frame is about. Absent from most frames.
- **Contrast:** ≥ 7:1 for anything under 0.05 height, ≥ 4.5:1 for display.
  Never trust the 3:1 large-text allowance in motion.

**Gradients** are two stops in sRGB, and sRGB interpolation between distant
hues passes through mud — blue→yellow goes grey, red→green goes brown, and
purple→blue is the single most recognisable signature of generated work.
Therefore: **hue delta ≤ 20°** (or the same hue), **lightness delta 6–14%**,
angle **165–195°** or **135°**, never 90°. The premium ones read as a lit
ground you cannot quite name, not as "a gradient." Check the export for
banding; if you see it, put the product over the ramp's midpoint.

### Type

Four roles. **Use two per frame.**

| Role | fontSize | Family / weight | Tracking | lineHeight | Max chars |
|---|---|---|---|---|---|
| **Hero word** (1–3 words) | 0.16–0.26 | Inter 600–700, or Instrument Serif | −0.03 to −0.045 (Inter); −0.005 to −0.02 (serif) | 0.92–1.0 | ≤ 14 |
| **Statement** (one thought) | 0.075–0.11 | Inter 500–600 | −0.02 to −0.03 | 1.02–1.12 | ≤ 28 per line, 2 lines |
| **Supporting** | 0.034–0.045 | Inter 400 | −0.005 to 0 | 1.30–1.45 | ≤ 50 |
| **Label / eyebrow** | 0.018–0.024 | JetBrains Mono, UPPERCASE | +0.08 to +0.12 | 1.2 | ≤ 24, one line |

- **Hard floor:** nothing that carries information below **0.034**. A 1–3 word
  label may sit at 0.018–0.030 if it holds ≥ 45f. Below 0.018, don't.
- **Bigger type wants tighter tracking.** Inter's own metrics converge on about
  −0.022em at display size; Linear runs −0.033, Vercel −0.06. Zero or positive
  tracking on a hero word is the loudest amateur tell there is. Only uppercase
  mono eyebrows get positive tracking, and those never exceed one line.
- **Display leading is tight.** 0.95–1.05. A headline at 1.5 leading is the
  most common typographic tell of a non-designer.
- **Instrument Serif has one weight.** 400, plus italic. Never ask it for bold;
  there is none, and synthesised bold looks cheap. Weight contrast comes from
  Inter; *size* contrast comes from the serif. It also reads 10–15% smaller
  than Inter at the same fontSize — size it up.
- **Does it fit?** For N characters on the longest line at a 0.08 margin: Inter
  maximum fontSize ≈ **2.4 / N**, comfortable ≈ 1.5 / N; Instrument Serif
  maximum ≈ **3.1 / N**, comfortable ≈ 1.9 / N. "LAUNCH" (6) sits happily at
  0.25; "Everything, instantly" (21) caps at 0.11. If the hero line has more
  than 14 characters, it is not a hero word — drop to statement size or cut.
- **Hierarchy ratio:** display-to-caption **4:1 to 8:1**. Under 3:1 the frame
  is flat. Exaggerate it.
- **Serif display + sans body** is the pairing. Structural contrast gives
  instant hierarchy; shared proportion gives harmony. Reversed — sans hero,
  serif caption — reads as a blog, not a film. Mono is for the machine: IDs,
  shortcuts, paths, numbers, eyebrows.
- **Two typefaces in any frame, maximum.**

### Layout

- **Margins 0.08–0.10** on every side. The broadcast-safe minimum is 5%; 8–10%
  is the aesthetic one.
- **1–2 elements per frame.** Three only if the third is a rule or a dot. Four
  is a slide.
- **The hero block occupies 30–55% of the frame.** The rest is ground. Negative
  space is the cheapest luxury signal available, and it is the one a template
  never spends, because empty pixels look unfinished to someone who doesn't
  design. Confidence is legible.
- **One alignment for the whole film.** Centred *or* left. Centring is a choice
  for the opener and the endcard; most frames want an edge. For left-aligned
  text with centre-anchored boxes: `x = margin + width/2`, `align: "left"`,
  and `width` is the intended *measure*, not the text's width. Every
  left-aligned element shares the same margin. One edge, held.
- **Optical centre:** a single centred line at `y: 0.50` reads low. Use
  **0.46–0.48**.
- **Social crop protection:** if the film will be cut to 4:5, compose the hero
  inside `x ∈ [0.275, 0.725]`; for 9:16, `[0.34, 0.66]`. Only atmosphere lives
  outside.
- **Shapes do a job or they go.** A rect behind text is a *ground*. A thin rect
  is a *rule*. A dot is a *marker*. If you can delete the shape and nothing
  changes meaning, delete it. No floating circles, no blobs, no dot grids, no
  corner plus-signs. Rotation is for a card being dealt, never for a headline.

### Product imagery

- **Device-less by default** in every look but KINETIC. A browser or phone
  chrome frame dates the film and adds three greys you did not choose. Sit
  the raw UI on a ground 4–8% lighter or darker than itself; let its own
  corner radius and a hairline rect frame it. **In KINETIC the device frame
  is the point:** the `device` clip's frame is the studio's own, one colour,
  tilted 8–25° with a shadow, and it is the thing that flies. A frame with no
  real screenshot in it is a placeholder, not a product shot.
- **Width 0.55–0.78 of the frame.** Never full-bleed unless it is video and the
  type is out of the way.
- **Corner radius matches the source**, scaled with it. A hand-set radius that
  disagrees with the window's own corners is instantly wrong.
- **Crop tight for a claim, show whole for context.** One of each per film,
  not five wholes. A single row at 2–3× scale says more than the whole screen.
- **Type never over the busy centre of a UI shot.** Type on ground, product
  beside it; or the product moves and the type holds still.

### Four looks, and a fifth

Pick one. Every value below is ready to write into a clip.

**VOID** — *Linear, Raycast. The default for developer tools, AI, anything
with a dark UI.*
- Background `{ "kind": "solid", "color": "#08090A" }`
- Ink `#F7F8F8`; muted `#F7F8F899`; accent: the brand hex, one element per
  frame, in at most two frames of the film
- Hero: Inter, weight 600, fontSize 0.18, letterSpacing −0.035, lineHeight 0.96
- Support: Inter 400, 0.036, lineHeight 1.4
- Label: mono, uppercase, 0.020, letterSpacing +0.10
- **Left-aligned, margin 0.09, held on every frame**
- Device: a 2px accent rule — rect, width 0.06, height 0.003 — sitting 0.03
  above the hero

**PAPER** — *Apple light, Vercel. Consumer products, calm positioning, light
UI, quiet luxury.*
- Background `#F6F5F2`, or gradient `#F8F7F4 → #EFEEEA` at 180°
- Ink `#16161A`; muted `#6E6E73`; accent none, or one at ≤ 5%
- Hero: display (Instrument Serif), 0.22, letterSpacing −0.01, lineHeight 1.0
- Support: Inter 400, 0.034
- **Centred, y 0.47, one element per frame, margins ≥ 0.12**
- The hardest look to get wrong and the hardest to make memorable. Earn it
  with pacing.

**EDITORIAL** — *Arc, Family. Brand-led launches, consumer apps, anything
where the product is a feeling. Highest ceiling, highest risk.*
- Background cream `#FBF7ED` or warm dark `#14120F`; ink the opposite
- Accent: one saturated hue — `#0C50FF`, `#E4572E`, or the brand's
- Hero: display, 0.26, letterSpacing −0.005, **left at margin 0.08, y 0.38**
- Caption: mono uppercase 0.019, +0.10, **bottom-right at (0.86, 0.86), align
  right**
- Deliberate asymmetry: hero top-left, marker bottom-right, nothing between.

**SPEC** — *Vercel with mono. Benchmarks, changelogs, technical launches,
before/after numbers.*
- Background `#0A0A0A`; ink `#EDEDED`; muted `#8F8F8F`; no accent — white is
  the accent
- Hero: Inter weight 450, 0.20, letterSpacing −0.055, lineHeight 0.95 — huge
  and thin. **Numbers take the hero slot.**
- Label: mono 0.018 uppercase +0.12, directly above the number
- Left, margin 0.10. Device: a hairline rect (height 0.001) at full measure
  under each metric.

**KINETIC** — *The launch-film register of consumer SaaS, AI products,
anything with a bright UI; a launch that has to feel alive.*
- Background `#F6F7FC`; ink `#111114`; accent `#2F7CF6`; a lighter
  `#7FB6FF` for the second word when a line needs two; shadows tinted blue,
  `shadow` 0.4–0.6 under every floating object
- Hero: Inter 500–600, 0.085–0.10, letterSpacing −0.025, lineHeight 1.0,
  **centred at y 0.47**; every line two-tone, the accent on the one word
  that matters and never on two; lines of 1–4 words
- Support: Inter 400, 0.034. Label: mono uppercase 0.020, +0.10
- The one gradient, `#4F5BFF` → `#7CC7FF`, on at most one object — the
  progress bar — and never on the ground
- Product: real screenshots in `device` frames, `tiltX`/`tiltY` 8–25°,
  `shadow` 0.4–0.6, and everything floats: a slow `motion` drift under every
  held object, nothing still but the end card
- The register with the most moving parts, so the one where restraint shows
  most: one confetti burst, one trail, four camera moves at most (§8)

**Endcard, any look:** flood the frame with the accent as a solid ground, ink
in white or near-black, the wordmark centred at y 0.47 at 0.11, one mono line
beneath. **One frame, at the end, never in the middle.**

### Style frames

Build **two or three beats for real** — the hook, the reveal, the endcard —
before building anything else. A style frame must settle: ground, ink, accent,
the one family that owns headlines, the type sizes for each role, the margins,
how the product is shown, the recurring motif, and the motion register (§8),
chosen once for the whole film. If a frame does not answer all of those, it
is not a style frame. Get them approved. Everything built
afterwards is an *application* of these frames, not a new decision.

In PrismLaunch the decisions a frame settles are **elements**: one
`prism.add_element` per type role (Headline, Support, Label), one for the
accent, one for the device frame, one for each product shot, one for the
music bed. Build the two or three frames by placing them with
`prism.place_element`, and `prism.submit_style_frames` names both the
elements and the clips. From here on a change to the look is a change to an
element — `prism.update_element` — and every clip placed from it follows.

---

## 8. Motion

### The two things that matter

Of the twelve principles of animation, only two create motion: **timing** and
**spacing**. Everything else — anticipation, follow-through, overshoot — is a
shape applied to those two. With no keyframes, you still control both:
`enterFrames` is timing, and the offset between sibling clips is spacing. That
is most of the craft.

**Enter decelerates; exit accelerates.** The renderer already does this — a
critically-damped spring in, an ease-in cubic out — so you only choose frame
counts. But know why: something arriving should slow into place so the eye can
land on it; something leaving should get out of the way. Exits are about **60%
of the entrance**. Symmetric in/out makes every beat feel reluctantly
withdrawn.

**One thing moves at a time.** Motion hierarchy is visual hierarchy. One
element leads; the rest follow on a stagger, or hold still. When everything
enters at frame 0 the eye has no entry point, and that — everything moving at
once — is the single most legible signature of generated motion.

**Restraint is a distance argument.** `travel` defaults to 0.03 of the
canvas, deliberately: a small travel with a firm ease-out reads as an object
settling into a place designed for it; a large one (0.25–0.35) reads as
arriving from off-stage — attention bought with volume rather than
precision. That is right for a phone flying into frame and wrong for a
headline. Text travels 0.03; an object may travel further; nothing travels
further than it needs to.

**Delight is rationed.** Exactly **one** move in the film is allowed to be
showy. If every beat has a signature move, none of them is. Name yours.

### Frame counts

| Element | enterFrames | exitFrames |
|---|---|---|
| Hero word / line | 14–18 | 8–10 |
| Statement / support line | 10–14 | 6–8 |
| Eyebrow / mono label | 8–10 | 5–6 |
| Shape (rule, card, chip) | 8–12 | 5–8 |
| Image / video card | 16–24 | 10–12 |
| Full-frame background element | 24–40 (fade only) | 20–30 |
| Logo lockup, final beat | 18–24 | 0 — hold to the end |
| Kinetic line, in a run | 5–6 (`pop`, per word) | 4–5 (`pop`) |

**Hard limits:** nothing enters in **under 6f** (it reads as a pop, and a
pop is right only in a kinetic run, where every line is one) or **over 24f**
(past 0.8s the viewer has finished reading and is watching the animation
finish, which is the definition of slow). Backgrounds are exempt, and so is
a `wipe` that *is* the content: a bar filling over 45f is the beat, not a
transition.

### Stagger

Separate clips, offset `from`:

- Sibling lines in one block: **4–6f** apart
- Distinct groups (headline → subhead → button): **8–12f**
- A decorative shape trailing its content: **3–5f** behind
- A grid of cards: **3f**, capped at six — stagger rows beyond that
- **Total stagger span in any block ≤ 20f.** Six items at 4f plus a 12f enter
  means the last settles at frame 32; longer, and the viewer starts reading
  before the block finishes assembling.
- **≤ 2 elements moving in any frame.** Three only if the third is a device
  trailing its content.

### Stillness

Every beat needs **10–15 frames where nothing is moving.** If something is
animating in every frame, nothing is emphasised. And: if the background moves,
the foreground holds. Pick one plane. The kinetic register below is the one
exception, and it is narrow: the background plane *drifts* — slowly, at a
speed the eye does not track — while the foreground pops, and a drift under
a held line counts as the line's stillness. A background that pops while the
foreground drifts is noise.

### The kinetic register

The other register this tool can hold, and the one the best consumer launch
films are cut in now. Choose it at the style stage, once, for the whole
film: a film that is calm for six beats and kinetic for one has a glitch,
not an accent. Its numbers, from a frame-by-frame read of a studio-made
33-second launch film:

- **Words pop.** Each word arrives out of focus and ~15% too large and
  settles in **5–6f** (`revealStyle: "pop"`, `revealFrames: 6`); the words
  of a line are **6–9f** apart (`revealStagger`); a line leaves by shrinking
  and blurring out in **4–5f** (`exit: "pop"`, `exitFrames: 5`). A line in a
  run holds **15–30f**, and the run — three to five lines — is the beat: a
  five-line run covers the first 2.2 seconds. Words appended to a standing
  line pop in ~15f apart while the earlier ones hold.
- **Objects spring.** An icon or a card enters with `spring` 0.3–0.4 over
  **8–12f**, and the text beside it slides aside to make room. A phone flies
  in with `travel` 0.25–0.35 over **18–24f**, tilted 20–30°, overshoots a
  little, then **drifts 0.02–0.04 of the canvas over the whole beat** by a
  `motion` with `easing: "linear"`. Nothing floating is ever still.
- **The cursor is a character.** A hand glides in over **12–20f**
  (`easing: "in-out"`) and presses (`press: true`); the thing it presses
  answers on the next frame — a card lifts to 1.04, a button changes colour.
- **The camera moves four times at most**, **1.4–1.8×** over **15–24f**,
  into a thing that holds still while it does.
- **Confetti once**: ~90 pieces, **40f**, on the one "Done". A trail on the
  one swoop. Glow on nothing, or on one thing.
- **Every cut is carried by an object.** The phone flies out and drags the
  bar behind it; the bar fills and becomes the check; the check becomes the
  card; the button becomes the sparkle; the sparkle becomes the star in the
  logo. Twelve beats in 33 seconds, and something is in flight across every
  join. If nothing carries across, cut on the beat instead: a straight cut
  beats a transition with nothing in it.
- **Two planes.** The background plane — the text wall, the scatter of
  cards — drifts slowly, out of focus, for the whole beat, while the
  foreground pops. The drift is texture the eye does not track; the pop is
  the event. "One thing moves at a time" still holds for the foreground.

### The twelve transitions

*(formerly "### The eight transitions": the first eight are the classic grammar, the last four the kinetic one)*

| Transition | Use for | enter | exit | Notes |
|---|---|---|---|---|
| **none** | The hard beat: a hero word landing on a downbeat; anything decisive | 0 | 0 | Precede with 8–12f of empty frame. The silence is the anticipation. |
| **fade** | Backgrounds, images, atmosphere; the default *exit* for nearly everything | 10–14 (24–40 full-frame) | 6–10 | Pair with a `rise` sibling 4f later: the fade is the ground, the rise the figure. |
| **rise** | The workhorse for text | 12–16 | 8, or exit with `fade` | Stagger siblings 4–6f. Never more than three rises in one block. |
| **fall** | Descending from an established anchor — a subhead under a logo already on screen | 10–14 | 6–8 | A fifth as often as `rise`. `rise` + `fall` on two siblings = a lockup forming. |
| **slide-left / slide-right** | Lateral narrative: time, before/after, sequence. Forward in time = `slide-left` | 12–16 | 8–10 | **Direction must match across the cut** — outgoing exits the way incoming enters. Mismatched direction is the classic tell. |
| **scale** | Emphasis and emergence: images, cards, the logo | 14–18 (16–24 image) | 8–10 | On text, only for the single hero moment of the film. |
| **blur** | Focus pulls, reveals, and rescuing a transition that won't sit right | 12–18 | 8–12 | Best with `scale` (rack focus), or on the outgoing clip while the incoming fades. |
| **pop** | The kinetic word: every line in a run of short lines; a chip, a badge, a count landing | 5–6 | 4–5 | Out of focus and ~15% large, settling; the exit shrinks and blurs out. Right only in a kinetic run, and then on every line of it — one `pop` in a `rise` film is a glitch. |
| **zoom** | Through the camera: a shot replaced from inside itself; a screenshot giving way to the next | 14–20 | 10–14 | In from 0.6, out to 1.4 with blur. Pairs with a camera move; never with `scale` on the same beat. |
| **flip** | A card turning up: a proof, a result, a price | 12–16 | 8–10 | rotateX from 70°. Cards and devices only, never text. |
| **wipe** | A true mask reveal, left to right: a bar filling, a line uncovered, an underline drawing on | 10–45 | 8–12 | The exit uncovers from the left. The bar a counter runs against is a `wipe` over 45f; no rect in the background colour is needed any more. |

**Grammar: pick two.** Usually `fade` plus one directional; in the kinetic
register, `pop` plus one directional, and `wipe` where a bar fills. Use them
for the whole film, and let the one accent move (`scale`, `blur`, `zoom` or
`flip`, once) be the exception that means something. Using all twelve because
they exist is transition salad.

**At least one true cut** — `none` out, `none` in — on a music downbeat. A cut
is the most powerful transition available and it costs nothing. A film where
every beat cross-fades is a monotone.

### Recipes

The tool has the moves now; these are the settings. SKILL.md carries each
as a full clip list.

- **Two-tone kinetic line** — `"Turn *books* into audio"`, `accent` the brand
  hex, `reveal: "words"`, `revealStyle: "pop"`, `revealStagger: 6`,
  `revealFrames: 6`, `exit: "pop"` 5f; the clip 20–30f. Three to five in a
  row are a beat.
- **Words appended to a standing line** — one clip, `reveal: "words"`,
  `revealStagger: 15`, `revealStyle: "pop"`: each word lands where it already
  sits, so the line never reflows.
- **Typewriter** — `reveal: "type"`, `caret: true`, ~2f per character. The
  URL under the wordmark, and nothing else.
- **Wipe / mask reveal** — `enter: "wipe"`, a true mask, left to right; the
  exit uncovers from the left. An underline draws on as a rect, height 0.006,
  `wipe` over 10f, 4f after its word.
- **Progress bar** — a rect with `fill` → `fillTo` (the film's one gradient),
  `radius: 0.5`, `wipe` over 45f; a mono `count` line above,
  `revealFrames: 45`, so the number runs up as the bar fills.
- **Overshoot** — `animation.spring` 0.3–0.4 on an icon, a card, a device;
  `motion.spring` at the end of a move. Never on text: letters are not
  rubber.
- **Flying object** — a `device` with `travel` 0.25–0.35 over 18–24f, `tiltY`
  20–30, `shadow` 0.6, `spring` 0.35; then a `motion` drift of 0.02–0.04
  with `easing: "linear"` for the rest of the beat.
- **Card lift under the cursor** — the library's `hand-cursor` gliding
  12–20f with `press: true`; the card's `motion`
  `{ scale: 1.04, frames: 8, delay: <arrival> }`, `shadow` 0.3.
- **Camera push-in** — one camera move, 1.4–1.8× over 15–24f, onto a thing
  that holds still; the cursor arrives as the camera does. Four moves in a
  film, at most. A 60–90f `scale` on a single full-frame still is still the
  right way to push on a still.
- **Done** — an `icon` check with `draw: true` over 12f; `"Done"` popping in
  6f beside it; `confetti`, ~90 pieces, 40f, from the check's centre. Once.
- **Sparkle swoop** — an `icon` sparkle, `motion` with `arc` 0.6, `spring`
  0.3, `trail: true`, over ~24f, landing where the next line's caret would
  sit. The film's one trail.
- **Text wall** — body copy at `blur` 0.5 and box opacity 0.35 behind the
  subject, drifting. Texture, not reading matter.
- **Match-cut portal** — the outgoing clip exits `zoom` while the incoming
  enters `zoom` over the same 10–14f, both centred: pushing through the
  frame. (Gunner's Duolingo device.)
- **Flash cut** — a white or accent rect, 3f total, fade in 1 / out 2, placed
  exactly on a cut.
- **Cross-dissolve** — overlap outgoing `fade` exit and incoming `fade` enter
  by identical frame counts, 8–12f. Longer is a dream sequence.
- **Hold on black** — 12–20f of empty background between acts. Not a bug; a
  beat. Use it before the endcard.

---

## 9. Sound

Sound is not the coat of paint at the end. Ordinary Folk consider it "from the
start, and at every step"; Apple's Billy Sorrentino: "Sound really is at the
beginning of the design process." In this method, the music is chosen *before
the animatic*, because it decides the shot lengths.

### Tempo is the edit's skeleton

Viewers predict pulse. A cut on the beat is felt as intentional; a cut 100ms
off is felt as wrong by people who cannot say why. So: choose the track, derive
the frame grid, cut into it.

**Prefer a frame-locked tempo at 30fps** — one where a beat is a whole number
of frames — so nothing needs rounding:

| BPM | frames / beat | frames / bar | 4 bars | 8 bars |
|---|---|---|---|---|
| 60 | 30 | 120 | 480 | 960 (32.0s) |
| 72 | 25 | 100 | 400 | 800 (26.7s) |
| 75 | 24 | 96 | 384 | 768 (25.6s) |
| 90 | 20 | 80 | 320 | 640 (21.3s) |
| 100 | 18 | 72 | 288 | 576 (19.2s) |
| 120 | 15 | 60 | 240 | 480 (16.0s) |
| 150 | 12 | 48 | 192 | 384 (12.8s) |

128 BPM — the default of stock music — is *not* frame-locked at 30fps. For any
tempo: `beatFrame(n) = downbeatFrame + round(n × 1800 / BPM)`. Compute each
beat by absolute multiplication from the anchor, **never** by adding a rounded
per-beat value cumulatively; accumulated rounding drifts.

**Cut 2–4 frames *before* the beat.** Vision resolves faster than the auditory
transient, so a picture change a hair early reads as locked; exactly on reads
as fractionally late. Set the clip's `from` to `beatFrame − 3`.

**Anchor the file.** The first downbeat is almost never at frame 0 of the
track. Measure its offset and put it in the music clip's `startFrom`; place
the clip where you want that downbeat to land. Everything derives from there.

**Structure beats sync.** Beat-locking *every* cut is a metronome. Cut on
downbeats for structure, on half-bars and off-beats for texture, and leave one
long unbroken hold. Linear's release films cut on *phrase* boundaries, not
kicks — the quiet-confidence register for a developer tool is a low-BPM or
beatless bed where the phrase, not the drum, sets the shot length.

### The arc

Music has three acts — setup on a single texture, build with risers and
escalating percussion, then the drop — with a **stopdown** (a hit, then a
pause) right before the payoff. **The product reveal goes on the drop.** The
12–20 frames before it go near-silent: a riser that *stops dead* at the peak,
leaving a hole where the cut lands, hits harder than one that covers it.

### Levels

The tool's `volume` is linear gain. Useful points: 1.0 = 0dB, 0.7 = −3dB,
0.5 = −6dB, 0.35 = −9dB, 0.25 = −12dB, 0.1 = −20dB.

| Source | volume |
|---|---|
| Music bed, no voiceover | 0.70–0.85 |
| Music bed under voiceover | 0.25–0.35 |
| Voiceover | 0.90–1.00 |
| SFX accents | 0.35–0.60 — never louder than VO |
| Impact / sub-drop on the reveal | 0.70–0.90, once or twice per film |
| Room tone / ambience | 0.05–0.10, continuous |
| A video clip's own captured audio | 0.15–0.30 as texture |

**Never digital silence.** A hole where the ambience stops is audible to
untrained ears and jars the viewer out. Keep one continuous room-tone clip
under the whole film at 0.07.

**Mobile.** Phone speakers pass roughly 500Hz–10kHz. A sub-drop under 80Hz is
*inaudible* on the device most people will watch on — **pair every sub with a
mid-band transient** so the moment still exists. And assume muted autoplay in a
feed: **the first three seconds must work with no sound at all.**

**Loudness.** Brief the music for −14 to −16 LUFS integrated, −1 dBTP true
peak. YouTube turns loud audio down and never turns quiet audio up, so
mastering hotter only costs dynamic range. The tool has no meter; this is a
brief for the file, not a thing you can assert.

### Fades, in frames

| Purpose | frames |
|---|---|
| De-click on any hard audio in or out | 2–3 |
| Music in, on a downbeat | 3–6 — it should arrive, not swell |
| Music in, atmospheric open | 24–45 |
| Duck down under VO | 4–8 |
| Duck back up after VO | 9–15 — faster pumps |
| Music out, "walk away" ending | 30–60, from a phrase boundary |
| Music with a real final hit | **no fade** — end picture 15–30f after |
| SFX tail | 3–8 |

A music bed hard-stopped mid-phrase, or faded over 6 frames because the video
ended, is the loudest amateur tell in audio. End on the composer's button, or
fade 30–60f from a phrase boundary.

**Ducking, without automation:** split the music clip. The bed ends at
`vo_in − 6` with `fadeOutFrames: 6`; a second clip runs `vo_in − 6` to
`vo_out + 12` at volume 0.30 with `fadeInFrames: 6`; the bed resumes at
`vo_out + 12` with `fadeInFrames: 12`, its `startFrom` advanced by however
much time passed so the music does not restart.

### Sound effects

Sound designs the picture; it does not decorate it. The same white disc reads
as a basketball or a tennis ball depending only on the sound it makes. A UI
element that pings like glass is a different product from one that clicks like
plastic. **Choose the material, not "a whoosh."**

| SFX | length | pairs with | placement |
|---|---|---|---|
| Whoosh | 5–15f | wipe, traversal, push | peak **on** the cut — start 4–10f before |
| Riser | 15–90f | the build into a reveal | ends **exactly at** the cut, then stops |
| Reverse swell | 10–30f | pre-roll before a hard cut | ends on the cut |
| Impact / hit | transient + 10–20f tail | text snap, mask reveal, logo | transient **on** the frame |
| Sub-drop | 15–60f | scale or scene change | on the frame, plus a mid transient |
| UI tick / click | 1–3f | cursor, toggle, a row appearing | the frame of state change |
| Typewriter tick | 1f each | per-word text, counters | one per word |
| Paper / fabric | 6–12f | cards, sheets | on the movement, not the cut |
| Glass ping | 8–20f | one premium accent | **once** per film |
| Latch / snap | 3–8f | docking into a grid | on the *settle* frame |

**The timing rule.** An effect's transient sits on the *transition*, not the
clip's start. A WAV usually has silence before its peak; set the SFX clip's
`startFrom` so the transient is at the clip's frame 0, or every effect lands
2–5 frames late. Anticipatory sounds *end* on the event; impacts land *on* it;
tails run past.

**Density.** A 60-second film: **12–25 effects total**, no more than one per
15f sustained, and at least one **20–40f window with none** immediately before
the reveal. Admission test: it marks an on-screen action, emphasises a point,
or builds atmosphere. Otherwise cut it. A sound on every cut is chaos, not
polish.

**Register.** Developer tools: small and dry — ticks, clicks, keystrokes, a
restrained electronic bed. Consumer: warmer, organic, familiar timbres over
sci-fi. Hardware and creative tools: diegetic — the product's own sounds, music
made on the thing being sold. The interface's sounds are the sound design when
the interface is the story.

### Voiceover

Needed only if the picture cannot say it. If a film's interface is the story,
a voice is just something to duck under; silent, music-and-SFX films are
legitimate and often better. When there is one: 150 wpm, ~70 words for 30s,
written to read in 90% of its window, and **never speaking the words on
screen**.

### The music brief

What to ask for, or select against:

- **Tempo** from the frame-locked table; **register** named
- **Arc:** intro → build → drop at the reveal frame → resolve
- **Allow:** e.g. modular arp, granular pad, dry rim and hat, sub with a mid
  partner
- **Ban:** ukulele, handclaps, whistling, glockenspiel, four-on-the-floor at
  128, big cinematic drums, vocals. "Corporate upbeat" communicates nothing
  because it is under three competitors' films this week.
- **Ending:** a real button, or a phrase boundary to fade from
- Three references, each with one line on what you want from it

### The sound plan

Write this before the animatic and fill it as you go:

```
LENGTH 900f   REGISTER dev-tool
MUSIC   bpm 90 (20f/beat, 80f/bar)   downbeat at source 0:00.4 → startFrom 12
        clip from 0, volume 0.75, fadeIn 4, fadeOut 45 from bar 11
        DROP at bar 8 = frame 640 → reveal clip from 637
        cuts at: 77, 157, 237, 317, 397, 477, 557, 637, 717, 797
SFX     637 impact + mid tick (0.85) · 640 UI tick (0.4) · 700 row tick (0.4)
        riser 560–637 (0.5), stops at 637   ·   NO SFX 600–637
TONE    one clip, 0–900, volume 0.07, fadeIn 6, fadeOut 24
VO      none — the interface says it
```

---

## 10. Build — in the tool

Every stage above is a field in `project.json` and a `submit_*` tool — the
storyboard is `prism.submit_storyboard`, and `prism.lay_animatic` transcribes
it onto the timeline — and the tool for a stage refuses until the person has
approved the one before. Submit
the brief; stop. Submit the concepts; stop. The person reads each in the
Process panel and approves it or sends it back with a note, which reaches you
through `prism.get_project_context`. You do not decide when a stage is done.

Timing is locked, style frames are approved. Now, and only now, replace each
board clip with real clips.

- **Never move an in or out point.** A board's slot is a contract, and the
  tool enforces it: after the animatic is approved, a visual clip you add or
  move must sit inside one locked beat, or `prism.add_text` and
  `prism.update_clip` refuse and list the beats. If a beat genuinely needs 12
  more frames, that is a decision for the person, not a thing you do: "this
  needs 12 more frames, which pushes the endcard — reopen the animatic, or
  re-cut inside it?"
- **Place, don't invent.** Every clip in the build comes from an approved
  element: `prism.place_element` with the track, the window, and the words.
  A clip made with `prism.add_text` is a new decision about the look, and the
  look was decided at the style frames. Reach for it only for something
  genuinely one-off — and if you find yourself doing it twice, it is an
  element.
- **One layer per role.** Name them: `Titles`, `Support`, `Accent`, `Product`,
  `Music`, `Voice`, `SFX`, `Tone`. A person reading the timeline should see
  the film's structure in the layer list.
- **Label every clip.** The chip should say what the clip *is* — the beat's
  words, or `wipe`, `rule`, `riser`. A clip called `shape` is a clip nobody can
  find.
- **Write a `revisionNote` on every clip you add.** One sentence: what it does
  and why. It is what the person reads next to the accept button.
- **Ids are minted for you** when you use the tools; if you write the file
  directly, make them say what they are — `clip-hook`, `clip-rule-2`, not
  `clip-7f2a`.
- **Assets go in `assets/`** inside the project folder before you reference
  them. A missing path renders as a hole and is reported, not a crash — but
  it is still a hole.
- **Build in stage-sized batches**, not clip by clip. All the hook's clips,
  then all the reveal's. A person accepting clips one at a time cannot see
  structure, and structure is what you need them for.

---

## 11. Review — four rounds, three viewings

**Round 1 — the animatic. Structure only.** Does the hook land before 0:03? Is
there a beat that could be deleted with nothing lost? Does any card sit long
enough to read twice, or too short to read once? Do the music's accents and the
cuts agree? Is the endcard on screen ≥ 45f? **Do not discuss colour.** If
colour comes up, the animatic is too finished.

**Round 2 — style frames. The look.** Ground, ink, accent, type roles, margins,
product presentation, motif. All settled or it is not a style frame.

**Round 3 — the build. Execution against the lock.** Every clip checked against
its board panel and its slot. Drift in either is a defect, not an improvement.

**Round 4 — polish.** The last 10% is where cheap and expensive separate.

**Watch it three times, differently each time:**

1. **Full size, sound on, straight through.** React. Note only the moments
   your attention *left*.
2. **Muted.** If the story does not read without sound, the picture is leaning
   on the music. Text-only clarity, pacing and legibility are all exposed here.
   This is also what a feed will show most people.
3. **At half size.** Small type, thin strokes and low-contrast text on busy
   ground all die here. If a card is unreadable at 50%, it is unreadable on a
   phone.

Then **fresh eyes** — and the fresh eyes are the person, not you. After enough
viewings anyone becomes normalised to their own glitches; the brain stops
seeing what it has accepted. Whatever reviews its own output last will miss the
last 10%. Do not be the final reviewer.

**The polish list:**

- First and last frame both hold; nothing starts or ends mid-motion
- Every exit shorter than its entrance
- One transition grammar plus one accent; nothing else
- Uniform margins; no line breaking differently between cards
- The same fontSize for the same role, everywhere
- No 1–3 frame slivers left over from trimming
- Audio: no clipped tail; the music fades or buttons, never stops; accents on
  the cuts; a hold before the reveal
- Contrast checked at half size
- The endcard is legible, still, last, and held
- **One deliberate expensive moment.** Films with nothing to look at twice read
  as templates. Competent everywhere and remarkable nowhere is the exact
  signature of generated work.

---

## 12. Working with the person

You propose. They decide, clip by clip, and only they can approve the render.
That is the product's contract, and the process above is shaped to fit it.

- **Batch by stage, never by clip.** All three concepts in one
  `prism.submit_concepts`. The whole animatic, then one `prism.submit_animatic`.
  All the style frames, then one `prism.submit_style_frames`.
- **Recommend; don't enumerate.** Three directions, one marked, one sentence
  on why.
- **Show, don't describe.** After you build, `prism.preview` so they watch it.
  When discussing one moment, `prism.seek` to it first — it is easier to agree
  about a frame you are both looking at.
- **State what a rejection means.** At the animatic it is a structural note:
  rebuild the beat. At the build it is an execution note: rebuild the clip in
  its slot. If you are not sure which, ask.
- **Never silently re-time.** Surface it as a choice with the consequence
  attached.
- **Narrate why each clip exists**, tied to its beat. Sandwich replaced the
  "disappear for six weeks" model with a shared channel where every decision is
  visible as it happens; your `revisionNote` is the same thing.
- **Defend timing, the single message, and the concept. Concede colour,
  wording, and asset choice.** Those are theirs; the structure is what you
  were asked to protect.
- **Diagnose; don't transcribe.** "Make it pop" is a symptom. Translate it into
  a hypothesis — "contrast is low at half size; I'll raise the hero weight and
  darken the ground — accept?" — and let them confirm.

---

## 13. The tells

What makes a film read as generated. If you recognise any of these in yours,
that is the note.

**Story.** Throat-clearing — logo, fade, "in today's fast-paced world." Claiming
instead of showing: "effortless," "seamless," "10x." Every line a headline: six
consecutive centred statements, all the same size, nothing emphasised because
everything is. Two films in one — any concept with "and." No turn. No pause.
A CTA pile-up on the last frame. Second person absent. Fake specificity.

**Look.** The purple-to-blue diagonal gradient, and its relatives — violet to
fuchsia, teal to indigo, anything called "aurora." Five colours. Everything at
(0.5, 0.5) in every frame. Floating shapes: circles, blobs, dot grids, corner
plus-signs. Positive or zero tracking on display type. Three typefaces. A
sentence at hero size. Grey-on-grey secondary text. Pure black under pure
white. Browser chrome around every screenshot. Mixed alignment in one frame.
Rotation as decoration. Filling the frame because it looked empty — the empty
version was finished.

**Motion.** Everything entering at frame 0. The same transition on every clip.
Bounce on text. Symmetric in and out. Travel that arrives from another room.
Never cutting. No stillness. Text leaving before it can be read. Text and
background both moving. Decorative shapes performing. Slide directions that
disagree across a cut. And the kinetic tells: tilt on everything. Confetti on
every beat. Glow on everything. A trail on everything. A camera that never
stops. Spring on text. Twelve transitions used because they exist. A device
frame with nothing real in it.

**Sound.** The corporate-upbeat bed. Music laid under a finished edit. A whoosh
on every cut. The track ending because the video ended. Every cut beat-locked.
Digital silence for the pause. VO reading the on-screen text. Constant volume
with no duck, build or drop. Sub-bass as the only weight. Effects landing late
because nobody trimmed the file's head.

**Process.** Building before timing is locked. Shipping the first idea.
Designing during the animatic. Skipping style frames — five type sizes and
four blues by the end. Sound added last. One review pass, at full size, with
sound. Being your own final reviewer. Competent everywhere, remarkable
nowhere.

---

## 14. Before you propose the render

Run all of it. Every line is a thing that has shipped wrong.

**Story**
- [ ] The film's idea in one sentence, with no "and"
- [ ] Frame 1 has content; any fade-up is ≤ 6f; no logo before the hook
- [ ] A specific, falsifiable, picturable idea has landed by 0:03
- [ ] The turn sits between 20% and 40% of runtime
- [ ] ≤ 9 beats; ≥ 4s average per beat; the last three beats shorter than the
      first three
- [ ] Exactly one pause of 24–45f at ~75% runtime, on a near-empty canvas
- [ ] The ending is a button, then a still wordmark held 45–75f
- [ ] The last line rhymes with the first

**Words**
- [ ] < 30 words of message copy per 30s; ≤ 7 words and ≤ 2 lines per clip
- [ ] Every text clip holds ≥ `21 + chars × 2.7` frames and ≤ 105f
- [ ] Adjectives purged; the hero line passes picture / falsify / only-us
- [ ] VO, if any, never speaks the on-screen words and fits 90% of its window

**Look**
- [ ] ≤ 2 elements per frame (3 with a device); ≤ 3 colours plus a muted ink
- [ ] The accent is on ≤ 10% of lit pixels and on the frame's subject
- [ ] Ground is off-black or off-white; any gradient has hue Δ ≤ 20°,
      lightness Δ 6–14%, and cannot be described as "a gradient"
- [ ] Every informational fontSize ≥ 0.034; every display size has negative
      tracking and lineHeight ≤ 1.05
- [ ] ≤ 14 characters at hero size, ≤ 28 at statement, ≤ 2 display lines
- [ ] Margins 0.08–0.10; one alignment for the film; centred lines at
      y 0.46–0.48; essentials inside the 4:5 band if it will be cropped
- [ ] Screenshots device-less, radius matched, on an off-ground, type never
      over their busy centre
- [ ] ≤ 2 typefaces per frame; the serif is never asked for bold
- [ ] Shrunk to 20% width, the display line still reads
- [ ] The most decorative element in each frame, deleted — was it better?

**Motion**
- [ ] ≤ 2 elements moving in any frame; total stagger span in any block ≤ 20f
- [ ] Every exit ≈ 60% of its entrance; nothing enters in < 6f or > 24f
- [ ] Two transition types as grammar, one accent move used once, named
- [ ] At least one true cut on a downbeat; at least one held frame ≥ 15f
- [ ] Slide directions agree across every cut and with the narrative
- [ ] Hero : caption size ratio ≥ 4:1
- [ ] The motion register named once, at the style stage, and held for the
      whole film
- [ ] ≤ 4 camera moves, none under 15f, each into a thing that holds still
- [ ] One particle burst in the film, at most
- [ ] No tilt past 30°; `spring` never on text; `trail` on one object only
- [ ] Every device frame holds a real screenshot
- [ ] The accent word in each two-tone line is the word that matters

**Sound**
- [ ] Tempo chosen before the cut list; every cut at `beatFrame − 2..4`
- [ ] Beats computed by absolute multiplication from the anchored downbeat
- [ ] The reveal is on the drop; 12–20f near-silent before it; risers stop
      dead at it
- [ ] Music ends on a button or a 30–60f fade from a phrase boundary
- [ ] Every SFX `startFrom` puts its transient at frame 0
- [ ] ≤ 25 effects per 60s; one 20–40f effect-free window before the reveal;
      the glass ping used at most once
- [ ] Continuous room tone at 0.05–0.10; no digital silence anywhere
- [ ] Every music segment beside VO is ducked: 6f down, 12f up, floor 0.30
- [ ] Every sub-drop paired with a mid-band transient
- [ ] The first 3 seconds work fully muted
- [ ] No audio fade shorter than 2f; 15–30f of picture after the last
      transient

**Delivery**
- [ ] Watched three times: sound on, muted, half size
- [ ] Every clip you added carries a `revisionNote`
- [ ] Submitted through `prism.submit_polish`, with a verdict on every line
- [ ] The person has seen it, and you are not the final reviewer

---

## Sources

The numbers and rules above come from these; where a claim is one
practitioner's, it is attributed inline.

Process — Adam Lisagor on [Changelog #601](https://changelog.com/podcast/601)
and [TechCrunch](https://techcrunch.com/2015/08/18/sandwichs-adam-lisagor-on-producing-the-killer-corporate-video/);
Jay Grandin on the [School of Motion podcast](https://www.schoolofmotion.com/blog/jay-grandin-podcast-podcast)
and [Motion Hatch 098](https://motionhatch.com/098-how-giant-ant-became-a-leading-motion-design-studio-jay-grandin);
[Ordinary Folk — Process](https://www.ordinaryfolk.co/process);
[Buck on Motion Array](https://motionarray.com/learn/motion-design/industry-spotlight-buck/);
School of Motion on [the pipeline](https://schoolofmotion.com/blog/guide-completing-motion-design-project)
and [animatics](https://schoolofmotion.com/blog/what-are-animatics-and-why-are-they-important);
[Max Make Motion](https://maxmakemotion.com/how-to-plan-a-motion-design-project-that-actually-runs-smooth/);
[Boords on motion storyboards](https://boords.com/how-to-storyboard/motion-graphics).

Narrative — Walter Murch, *In the Blink of an Eye*, via
[StudioBinder](https://www.studiobinder.com/blog/walter-murch-rule-of-six/);
Loewenstein, "The Psychology of Curiosity," *Psychological Bulletin* 116(1);
[Nielsen / Meta on early attention](https://www.marketingdive.com/news/brand-lift-happens-in-less-than-1-second-of-video-study-finds/377333/);
[Google's ABCD playbook](https://www.thinkwithgoogle.com/_qs/documents/8472/ABCD_Complete_V7b_HR_1.pdf);
[Andy Raskin on the Zuora deck](https://medium.com/the-mission/the-greatest-sales-deck-ive-ever-seen-4f4ef3391ba0);
[Netflix timed-text guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide);
[Harry Dry on copywriting](https://marketingexamples.com/copywriting);
the films: [Linear Releases](https://www.youtube.com/watch?v=6dIwFoQ0eVg),
[Notion AI](https://www.youtube.com/watch?v=FElBbgnNtVA),
[Sandwich for Slack](https://www.youtube.com/watch?v=B6zVzWU95Sw),
[Apple iPhone X](https://www.youtube.com/watch?v=Qy-s2SGb7C4),
[Arc Act II](https://www.youtube.com/watch?v=WIeJF3kL5ng).

Motion — [Emil Kowalski's animation standards](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md);
[Material motion, duration and easing](https://m1.material.io/motion/duration-easing.html);
[Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion);
[Family's design values](https://benji.org/family-values);
[Rauno Freiberg on interaction](https://rauno.me/craft/interaction-design);
[BUCK × Coinbase](https://www.stashmedia.tv/buck-cracks-the-code-for-coinbase/);
[Gunner × Duolingo](https://www.stashmedia.tv/duolingo-world-brand-film-by-gunner/).

Look — [Butterick's Practical Typography](https://practicaltypography.com/summary-of-key-rules.html);
[Inter's dynamic metrics](https://d.rsms.me/inter-website/v3/dynmetrics/);
[Vercel Geist](https://vercel.com/geist/introduction);
[Linear Brand](https://linear.app/brand);
[Raycast brand guidelines](https://www.raycast.com/templates/brand-guidelines);
[Refactoring UI on palettes](https://refactoringui.com/previews/building-your-color-palette);
[Erik Kennedy's rules](https://www.learnui.design/blog/7-rules-for-creating-gorgeous-ui-part-1.html);
[EBU R95 safe areas](https://tech.ebu.ch/publications/r095);
[Text legibility in video](https://legibility.info/rules-for-text-in-videos).

Sound — [Twenty Thousand Hertz, *The Sound of Apple*](https://www.20k.org/episodes/the-sound-of-apple);
[Nicolas Titeux on sound for motion](https://www.nicolastiteux.com/en/blog/sound-design-for-motion-design/);
[Designing Sound on silence](https://designingsound.org/2014/06/28/designing-silence/);
[Rareform Audio on trailer structure](https://www.rareformaudio.com/blog/how-production-music-reveals-trailer-structure);
[Epidemic Sound on mixing](https://www.epidemicsound.com/blog/audio-mixing-for-video/);
[EBU R128](https://tech.ebu.ch/docs/r/r128.pdf);
[LANDR on phone speakers](https://blog.landr.com/make-bass-audible-phone-speakers/);
[Artyfile on generic music](https://artyfile.com/blog/why-your-commercial-sounds-like-everyone-elses).
