"use client";

import { Check, Sparkles, X } from "lucide-react";
import type {
  ComponentCandidate,
  Emphasis,
  MotionPreset,
  Scene,
} from "@/types/prism";
import { framesToSeconds } from "@/lib/studio/timing";
import { BODY_MAX, HEADLINE_MAX } from "@/lib/studio/schema";

const EMPHASIS: Emphasis[] = ["problem", "product", "feature", "outcome"];
const MOTION: MotionPreset[] = ["drift", "snap", "orbit"];

type Props = {
  scene: Scene;
  candidates: ComponentCandidate[];
  onPatch: (patch: Partial<Scene>) => void;
  onAcceptDraft: () => void;
  onKeepCurrent: () => void;
};

export function Inspector({
  scene,
  candidates,
  onPatch,
  onAcceptDraft,
  onKeepCurrent,
}: Props) {
  const isDraft = scene.approval === "draft";
  const candidate = candidates.find((c) => c.id === scene.componentId);
  const evidence = candidate?.evidence[0];

  return (
    <aside className="thin-scroll flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Scene {String(scene.order).padStart(2, "0")}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-faint">
          {scene.template} · {framesToSeconds(scene.durationFrames).toFixed(1)}s
        </p>
      </div>

      {/* The approval moment. Only a human click can clear this. */}
      {isDraft ? (
        <div className="mx-4 mb-4 rounded-card border border-draft-line bg-draft-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-draft">
            <Sparkles size={12} strokeWidth={2.4} aria-hidden />
            Agent draft
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">{scene.revisionNote}</p>

          {scene.previousHeadline ? (
            <p className="mt-2 text-[11.5px]">
              <span className="text-faint line-through">{scene.previousHeadline}</span>
              <span className="mx-1 text-faint">→</span>
              <span className="font-medium text-ink">{scene.headline}</span>
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onAcceptDraft}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-ctl bg-draft px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-draft"
            >
              <Check size={13} strokeWidth={2.6} aria-hidden />
              Accept
            </button>
            <button
              type="button"
              onClick={onKeepCurrent}
              className="flex items-center justify-center gap-1.5 rounded-ctl border border-line-strong px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <X size={13} strokeWidth={2.4} aria-hidden />
              Keep current
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 px-4 pb-6">
        <Field
          label="Headline"
          count={`${scene.headline.length} / ${HEADLINE_MAX}`}
          over={scene.headline.length > HEADLINE_MAX}
        >
          <textarea
            value={scene.headline}
            onChange={(e) => onPatch({ headline: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-ctl border border-line bg-sunken px-2.5 py-2 text-[13px] text-ink focus-visible:border-brand focus-visible:outline-none"
          />
        </Field>

        <Field
          label="Body"
          count={`${(scene.body ?? "").length} / ${BODY_MAX}`}
          over={(scene.body ?? "").length > BODY_MAX}
        >
          <input
            value={scene.body ?? ""}
            onChange={(e) => onPatch({ body: e.target.value })}
            placeholder="Optional supporting line"
            className="w-full rounded-ctl border border-line bg-sunken px-2.5 py-2 text-[13px] text-ink placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
          />
        </Field>

        {scene.template === "component-spotlight" ? (
          <Field label="Component">
            <select
              value={scene.componentId ?? ""}
              onChange={(e) => onPatch({ componentId: e.target.value })}
              className="w-full rounded-ctl border border-line bg-sunken px-2.5 py-2 text-[13px] text-ink focus-visible:border-brand focus-visible:outline-none"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Motion">
          <SegmentedControl
            options={MOTION}
            value={scene.motionPreset}
            onChange={(value) => onPatch({ motionPreset: value })}
          />
        </Field>

        <Field label="Emphasis">
          <SegmentedControl
            options={EMPHASIS}
            value={scene.emphasis}
            onChange={(value) => onPatch({ emphasis: value })}
          />
        </Field>

        {evidence ? (
          <Field label="Source evidence">
            <div className="rounded-ctl border border-line bg-sunken p-2.5">
              <p className="font-mono text-[11px] break-all text-ink">
                {evidence.path}
              </p>
              {evidence.exportName ? (
                <p className="mt-1 font-mono text-[11px] text-brand">
                  {evidence.exportName}
                </p>
              ) : null}
              <p className="mt-1.5 text-[11.5px] text-muted">{evidence.reason}</p>
              <p className="mt-2 inline-block rounded border border-line-strong px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-faint uppercase">
                untrusted
              </p>
            </div>
          </Field>
        ) : null}
      </div>
    </aside>
  );
}

function Field({
  label,
  count,
  over,
  children,
}: {
  label: string;
  count?: string;
  over?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
        {label}
        {count ? (
          <span
            className={`ml-auto font-mono text-[10.5px] tracking-normal normal-case ${
              over ? "text-draft" : "text-faint"
            }`}
          >
            {count}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-ctl border border-line bg-sunken p-0.5">
      {options.map((option) => {
        const isActive = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={isActive}
            className={`flex-1 rounded-[4px] px-1 py-1.5 text-[11.5px] capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              isActive
                ? "bg-surface font-medium text-ink shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
