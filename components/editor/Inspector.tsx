"use client";

import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import type { ScenePatch } from "@/lib/studio/actions";
import { BODY_MAX, HEADLINE_MAX } from "@/lib/studio/schema";
import { framesToSeconds } from "@/lib/studio/timing";
import type { Emphasis, MotionPreset, Scene } from "@/types/prism";

const EMPHASIS: Emphasis[] = ["problem", "product", "feature", "outcome"];
const MOTION: MotionPreset[] = ["drift", "snap", "orbit"];

type Props = {
  scene: Scene;
  onPatch: (patch: ScenePatch) => void;
  onAcceptDraft: () => void;
  onKeepCurrent: () => void;
};

export function Inspector({
  scene,
  onPatch,
  onAcceptDraft,
  onKeepCurrent,
}: Props) {
  const isDraft = scene.approval === "draft";
  const feature = scene.feature;

  return (
    <aside
      aria-label="Scene properties"
      className="thin-scroll flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line-soft bg-surface"
    >
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold tracking-[var(--ds-tracking-tight)]">
          Scene {String(scene.order).padStart(2, "0")}
        </h2>
        <p className="tabular mt-0.5 font-mono text-xs text-subtle">
          {scene.template} · {framesToSeconds(scene.durationFrames).toFixed(1)}s
        </p>
      </div>

      {/*
        The approval moment.

        Orange is the system's "time-sensitive attention" signal, which is
        exactly what an unreviewed draft is — not decoration. The block is
        inset because it is a container you must resolve before moving on.
      */}
      {isDraft ? (
        <div className="ds-inset mx-4 mb-4 rounded-md bg-warning-soft p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
            <Sparkles size={13} strokeWidth={2.4} aria-hidden />
            Agent draft
          </p>
          <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">
            {scene.revisionNote}
          </p>

          {scene.previousHeadline ? (
            <p className="mt-2.5 text-xs">
              <span className="text-subtle line-through">
                {scene.previousHeadline}
              </span>
              <span className="mx-1.5 text-subtle" aria-label="becomes">
                →
              </span>
              <span className="font-semibold text-ink">{scene.headline}</span>
            </p>
          ) : null}

          <div className="mt-3.5 flex gap-2">
            <Button
              variant="attention"
              onClick={onAcceptDraft}
              className="flex-1"
              icon={<Check size={15} strokeWidth={2.6} aria-hidden />}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              onClick={onKeepCurrent}
              icon={<X size={15} strokeWidth={2.4} aria-hidden />}
            >
              Keep current
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 px-4 pb-6">
        <Field
          label="Headline"
          htmlFor="scene-headline"
          counter={`${scene.headline.length} / ${HEADLINE_MAX}`}
          over={scene.headline.length > HEADLINE_MAX}
        >
          <TextArea
            id="scene-headline"
            value={scene.headline}
            onChange={(e) => onPatch({ headline: e.target.value })}
            rows={2}
          />
        </Field>

        <Field
          label="Body"
          htmlFor="scene-body"
          counter={`${(scene.body ?? "").length} / ${BODY_MAX}`}
          over={(scene.body ?? "").length > BODY_MAX}
        >
          <TextInput
            id="scene-body"
            value={scene.body ?? ""}
            onChange={(e) => onPatch({ body: e.target.value })}
            placeholder="Optional supporting line"
          />
        </Field>

        {/*
          * The spotlight scene is the only one that shows more than words, so
          * it is the only one with more than words to edit. Tokens are free
          * text rather than a picker: nothing here scans a repository, so
          * there is no list to choose from — whatever the agent named is what
          * gets drawn.
          */}
        {scene.template === "feature-spotlight" ? (
          <>
            <Field label="Feature" htmlFor="scene-feature">
              <TextInput
                id="scene-feature"
                value={feature?.label ?? ""}
                onChange={(e) =>
                  onPatch({
                    feature: {
                      label: e.target.value,
                      visualTokens: feature?.visualTokens ?? [],
                    },
                  })
                }
                placeholder="What the shot is about"
                maxLength={40}
              />
            </Field>

            <Field label="Shown in the panel" htmlFor="scene-tokens">
              <TextArea
                id="scene-tokens"
                value={(feature?.visualTokens ?? []).join("\n")}
                onChange={(e) =>
                  onPatch({
                    feature: {
                      label: feature?.label ?? "",
                      visualTokens: e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .slice(0, 6),
                    },
                  })
                }
                placeholder={"One line per row\nUp to six"}
              />
            </Field>
          </>
        ) : null}

        <Field label="Motion">
          <Segmented
            label="Motion preset"
            options={MOTION}
            value={scene.motionPreset}
            onChange={(motionPreset) => onPatch({ motionPreset })}
          />
        </Field>

        <Field label="Emphasis">
          <Segmented
            label="Emphasis"
            options={EMPHASIS}
            value={scene.emphasis}
            onChange={(emphasis) => onPatch({ emphasis })}
          />
        </Field>

      </div>
    </aside>
  );
}
