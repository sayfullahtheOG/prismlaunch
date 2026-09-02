"use client";

import { Lock } from "lucide-react";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { patchStoryboardPanel } from "@/lib/studio/actions";
import { timingLocked } from "@/lib/studio/process";
import { TransitionSchema } from "@/lib/studio/schema";
import type { ProjectFile, StoryboardPanel } from "@/types/prism";
import { Heading, NumberField, Row } from "./fields";

/**
 * One board's notes, editable.
 *
 * The person owns the process, so they can change a board directly rather
 * than only sending the stage back with a note — a duration that is twelve
 * frames long, a word that should be another word. Edits land in the file
 * like any other; the agent sees them on its next read.
 */

const TRANSITIONS = TransitionSchema.options.map((name) => ({
  value: name,
  label: name,
}));

export function PanelInspector({
  panel,
  index,
  file,
}: {
  panel: StoryboardPanel;
  index: number;
  file: ProjectFile;
}) {
  const set = (patch: Partial<StoryboardPanel>) => patchStoryboardPanel(panel.id, patch);
  const approved = file.process.storyboard.status === "approved";

  return (
    <>
      <Heading
        title={panel.label}
        detail={`Panel ${index + 1} · ${panel.durationInFrames}f · ${(panel.durationInFrames / file.fps).toFixed(1)}s`}
      />

      {approved ? (
        <p className="mx-4 mb-4 flex items-start gap-2 rounded-sm bg-sunken p-2.5 text-2xs leading-[var(--ds-leading-body)] text-muted">
          <Lock size={11} strokeWidth={2.2} className="mt-px shrink-0 text-subtle" aria-hidden />
          {timingLocked(file.process)
            ? "The storyboard and the timing are approved. Editing a board here does not move its beat on the timeline; reopen the animatic for that."
            : "The storyboard is approved. Editing a board here does not re-lay the timeline; your agent can run prism.lay_animatic again."}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
        <Field label="Label" htmlFor="panel-label">
          <TextInput
            id="panel-label"
            value={panel.label}
            onChange={(event) => set({ label: event.target.value })}
          />
        </Field>

        <Field label="Words on screen" htmlFor="panel-words">
          <TextArea
            id="panel-words"
            value={panel.words ?? ""}
            onChange={(event) => set({ words: event.target.value })}
            rows={2}
            placeholder="None"
          />
        </Field>

        <Field label="Frame" htmlFor="panel-frame">
          <TextArea
            id="panel-frame"
            value={panel.frame}
            onChange={(event) => set({ frame: event.target.value })}
            rows={4}
          />
        </Field>

        <Field label="Action" htmlFor="panel-action">
          <TextArea
            id="panel-action"
            value={panel.action ?? ""}
            onChange={(event) => set({ action: event.target.value })}
            rows={2}
            placeholder="What moves, in what order"
          />
        </Field>

        <Field label="Sound" htmlFor="panel-sound">
          <TextInput
            id="panel-sound"
            value={panel.sound ?? ""}
            onChange={(event) => set({ sound: event.target.value })}
            placeholder="What the music or effect does"
          />
        </Field>

        <Row>
          <NumberField
            label="Frames"
            value={panel.durationInFrames}
            step={1}
            min={6}
            onChange={(durationInFrames) => set({ durationInFrames })}
          />
          <NumberField
            label="Seconds"
            value={Number((panel.durationInFrames / file.fps).toFixed(2))}
            step={0.1}
            min={0.2}
            onChange={(seconds) =>
              set({ durationInFrames: Math.max(6, Math.round(seconds * file.fps)) })
            }
          />
        </Row>

        <Row>
          <Field label="In">
            <Select
              label="Transition in"
              options={TRANSITIONS}
              value={panel.transitionIn}
              onChange={(value) => set({ transitionIn: TransitionSchema.parse(value) })}
            />
          </Field>
          <Field label="Out">
            <Select
              label="Transition out"
              options={TRANSITIONS}
              value={panel.transitionOut}
              onChange={(value) => set({ transitionOut: TransitionSchema.parse(value) })}
            />
          </Field>
        </Row>
      </div>
    </>
  );
}
