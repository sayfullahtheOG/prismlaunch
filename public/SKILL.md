---
name: prismlaunch
description: Make a short launch video for a product. Use when someone asks for a launch film, product video, demo video, teaser, or trailer for something they have built. PrismLaunch renders and exports it; you write it.
---

# PrismLaunch

PrismLaunch turns a four-scene storyboard into an 18-second MP4, rendered in the
person's own browser. It has no model of its own — **you** write the film. It
renders what you write, shows it to the person, and holds the gate on export.

Open the studio at **https://prismlaunch-doddlesoft.vercel.app**.

## How the two halves fit together

There are two ways to reach PrismLaunch, and you will usually want both.

**The folder.** A film lives in `.prismlaunch/<slug>/project.json` inside
whatever repository the person is working in. If you have file tools, write that
file directly — it is the source of truth, and the studio picks up changes
within a second of you saving.

**The page.** The studio registers WebMCP tools on its own tab. They let you
open a film, put a scene in front of the person, play it back, and propose a
render. Use them for anything the person should *see*.

Neither can do the other's job. Editing the file will not make the browser play
the scene; calling a tool will not create a file in a folder nobody has linked.

## Getting started

1. Ask the person to open the studio and click **Link project folder**, then
   choose the repository you are both working in. You cannot do this for them —
   browsers only open a folder picker for a real click.
2. Call `prism.get_project_context`. It tells you whether a folder is linked and
   what films are already in it.
3. Create a film with `prism.create_project`, or write the file yourself and
   call `prism.open_project`.
4. Write the four scenes.
5. Ask the person to review. **You cannot accept your own work** — there is no
   tool for it, by design.
6. Once every scene is accepted, call `prism.request_render`. That renders
   nothing; it raises a confirmation the person has to approve.

## The file

```
your-repo/
└── .prismlaunch/
    └── vector-launch/
        ├── project.json
        └── renders/
            └── vector-launch-launch-film.mp4
```

`project.json` in full:

```json
{
  "version": 1,
  "name": "Vector launch video",
  "product": {
    "name": "Vector",
    "description": "A keyboard-first issue tracker for small product teams."
  },
  "brief": {
    "promise": "Every action, one keystroke away.",
    "artDirection": "minimal-dark"
  },
  "scenes": [
    {
      "id": "scene-01",
      "order": 1,
      "template": "kinetic-type",
      "durationFrames": 84,
      "headline": "Most tools make you click. A lot.",
      "body": "Six clicks to assign an issue. Every time.",
      "motionPreset": "drift",
      "emphasis": "problem",
      "approval": "draft",
      "revisionNote": "Opening on the cost, not the product."
    },
    {
      "id": "scene-02",
      "order": 2,
      "template": "product-reveal",
      "durationFrames": 108,
      "headline": "Vector",
      "body": "An issue tracker you drive from the keyboard.",
      "motionPreset": "snap",
      "emphasis": "product",
      "approval": "draft"
    },
    {
      "id": "scene-03",
      "order": 3,
      "template": "feature-spotlight",
      "durationFrames": 132,
      "headline": "Meet the command palette.",
      "feature": {
        "label": "Command palette",
        "visualTokens": ["Assign to me", "Move to cycle", "Add to project"]
      },
      "motionPreset": "drift",
      "emphasis": "feature",
      "approval": "draft"
    },
    {
      "id": "scene-04",
      "order": 4,
      "template": "outcome-cta",
      "durationFrames": 108,
      "headline": "The fast path, by default.",
      "body": "vector.app",
      "motionPreset": "snap",
      "emphasis": "outcome",
      "approval": "draft"
    }
  ]
}
```

### Rules the file must satisfy

These are enforced. A file that breaks one is refused with the field named.

- **Exactly four scenes**, with those ids, in that order, using those templates.
  No reordering, no fifth scene.
- **`durationFrames`** is 72–144 each (3–6 seconds at 24fps), and the four must
  total **16–22 seconds** (384–528 frames).
- **`headline`** is 1–56 characters. **`body`** is optional, up to 110.
- **`scene-03` requires `feature`** — a `label` (≤40 chars) and up to six
  `visualTokens` (≤24 chars each). The tokens are drawn as rows in a suggested
  interface. They are decoration, not a screenshot of anything real.
- **`motionPreset`** is `drift` (slow, premium), `snap` (decisive), or `orbit`
  (playful). **`emphasis`** is `problem`, `product`, `feature`, or `outcome`.
- **`artDirection`** is `minimal-dark`, `electric-editorial`, or `warm-playful`.
- **`approval`** is `draft` or `accepted`. **Always write `draft`.** Only the
  person can write `accepted`, through the studio.

### Fields you should write, and one you should not

When you revise a scene that was already `accepted`, put the line you are
replacing in `previousHeadline` so the person can revert with one click. Put one
sentence in `revisionNote` saying what you changed and why — it is shown to them
next to the accept button.

Never write `"approval": "accepted"`. It is the one field that is not yours. The
studio will read it, but you will have taken a decision that was the person's to
make, and they will notice — the activity rail shows who changed what.

## The tools

| Tool | What it does |
| --- | --- |
| `prism.get_project_context` | Where things stand: is a folder linked, what films are in it, what the open one says. **Call this first.** |
| `prism.create_project` | Create `.prismlaunch/<slug>/` with four empty scenes and open it. |
| `prism.open_project` | Show a film that is already in the folder. |
| `prism.write_storyboard` | Write all four scenes at once. They land as drafts. |
| `prism.revise_scene` | Change one scene. It lands as a draft. |
| `prism.focus_scene` | Put a scene in front of the person, so you are both looking at the same shot. |
| `prism.preview_storyboard` | Play the film, or one scene, on their screen. |
| `prism.request_render` | Propose the export. **Renders nothing.** Raises a confirmation. |
| `prism.confirm_render` | Start the render, using the id `request_render` gave you — and only after a human approves it. |

There is no tool to accept a draft, and no tool to approve a render. That is
not an oversight and not a policy you can talk your way around: the functions
exist in the app, and they are never registered. Asking the person is the only
path.

## Writing a good one

Eighteen seconds is about forty words. Spend them like this:

- **Scene 1 — the hook.** Name the problem, in their words, before you name the
  product. "Most tools make you click. A lot." beats "Introducing Vector."
- **Scene 2 — the reveal.** The product's name and the shortest true sentence
  about what it is.
- **Scene 3 — the proof.** *One* capability. Not three. The `visualTokens` do
  the showing; the headline names it.
- **Scene 4 — the resolve.** What is different for them now. Land the promise
  from the brief.

Write headlines that fit. Fifty-six characters is a real limit and a long one
will be refused, not truncated — count before you send.

Match `motionPreset` to the register: `drift` for developer tools and anything
premium, `snap` for something fast or decisive, `orbit` for consumer and
playful. Mixing `drift` and `snap` across a film is normal; `orbit` in a
serious film is not.

## Working with the person

Show, don't describe. After you write a storyboard, call
`prism.preview_storyboard` so they watch it rather than reading your summary of
it. When you are discussing one shot, `prism.focus_scene` first — it is much
easier to agree about a scene you are both looking at.

Then stop and let them review. Four drafts are waiting on their screen with your
`revisionNote` under each one. They accept, or they reject and you try again.

When every scene is accepted, propose the render. Say why you think it is ready.
Then wait — `prism.confirm_render` fails until they have clicked approve, and
retrying it will not change that.

## When something is wrong

- **"No folder is linked yet."** Ask them to click **Link project folder**. You
  cannot open that picker.
- **"A folder is remembered but the browser dropped its permission."** Ask them
  to click **Re-open folder**. This happens on every fresh page load; it is
  normal, not a fault.
- **A validation error naming a field.** Fix that field and send it again. The
  message says exactly what is wrong.
- **`prism.confirm_render` refuses.** A human has not approved it yet. Ask.
- **The studio shows a file error.** You wrote something the schema rejects.
  `prism.get_project_context` returns the same message under `fileError`.

## What this never does

PrismLaunch does not read the person's source code, run it, or send it anywhere.
It reads one JSON file, renders it in the browser with WebCodecs, and writes the
MP4 back into the folder. Nothing is uploaded — no video, no code, no project
file. If you tell someone their repository was analysed, that is not true.
