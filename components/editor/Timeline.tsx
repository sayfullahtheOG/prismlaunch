"use client";

import { Lock, Sparkles } from "lucide-react";
import type { Palette, Scene } from "@/types/prism";
import { framesToSeconds, timecode, totalFrames } from "@/lib/studio/timing";

type Props = {
  scenes: Scene[];
  activeSceneId: Scene["id"];
  palette: Palette;
  onSelect: (id: Scene["id"]) => void;
};

const SCENE_LABEL: Record<Scene["template"], string> = {
  "kinetic-type": "Hook",
  "product-reveal": "Reveal",
  "feature-spotlight": "Proof",
  "outcome-cta": "Resolve",
};

/**
 * The timeline is the storyboard. Four fixed clips, widths proportional to
 * duration, no reordering and no trimming.
 *
 * Depth carries the state and never alone: a selected clip is INSET (a
 * container you are inside), a clip awaiting your decision is inset *and*
 * warning-toned *and* carries an icon and the word "Draft". Colour is never
 * the only indicator.
 */
export function Timeline({ scenes, activeSceneId, palette, onSelect }: Props) {
  const totalSeconds = framesToSeconds(totalFrames(scenes));

  const ticks: number[] = [];
  for (let s = 0; s <= Math.floor(totalSeconds); s += 5) ticks.push(s);

  return (
    <section
      aria-label="Storyboard timeline"
      className="flex h-[200px] shrink-0 flex-col border-t border-line-soft bg-surface"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <h2 className="text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
          Storyboard
        </h2>
        <span className="ds-level flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs text-muted">
          <Lock size={11} strokeWidth={2} aria-hidden />
          Fixed 4-scene structure
        </span>
        <span className="tabular ml-auto font-mono text-xs text-subtle">
          {timecode(totalSeconds)}
        </span>
      </div>

      <div className="relative mx-4 h-5 border-b border-line-soft" aria-hidden>
        {ticks.map((s) => (
          <span
            key={s}
            className="absolute top-0 flex h-full flex-col justify-end"
            style={{ left: `${(s / totalSeconds) * 100}%` }}
          >
            <span className="tabular mb-1 -translate-x-1/2 font-mono text-2xs text-subtle">
              {timecode(s)}
            </span>
            <span className="h-1.5 w-px bg-line" />
          </span>
        ))}
      </div>

      <div className="flex flex-1 items-stretch gap-1.5 px-4 pt-3 pb-4">
        {scenes.map((scene) => {
          const selected = scene.id === activeSceneId;
          const draft = scene.approval === "draft";
          const seconds = framesToSeconds(scene.durationFrames);

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              aria-current={selected ? "true" : "false"}
              style={{ flexGrow: scene.durationFrames, flexBasis: 0 }}
              className={`ds-focus group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-sm p-2.5 text-left transition-[background-color,box-shadow,color] duration-220 ease-[var(--ease-standard)] ${
                draft
                  ? "ds-inset bg-warning-soft"
                  : selected
                    ? "ds-inset bg-sunken"
                    : "ds-raised bg-raised hover:bg-strong"
              }`}
            >
              {/* A thread of the film's own palette — the clip's only colour. */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5"
                style={{
                  background: palette.accent,
                  opacity: selected ? 1 : 0.4,
                }}
              />

              <span className="flex items-center gap-1.5">
                <span
                  className={`tabular font-mono text-2xs ${
                    draft
                      ? "text-warning"
                      : selected
                        ? "text-accent"
                        : "text-subtle"
                  }`}
                >
                  {String(scene.order).padStart(2, "0")}
                </span>
                <span className="truncate text-xs font-semibold text-ink">
                  {SCENE_LABEL[scene.template]}
                </span>
                {draft ? (
                  <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-warning">
                    <Sparkles size={11} strokeWidth={2.2} aria-hidden />
                    Draft
                  </span>
                ) : null}
              </span>

              <span className="truncate text-xs text-muted">
                {scene.headline}
              </span>

              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-2xs text-subtle">
                  {scene.template}
                </span>
                <span className="tabular font-mono text-2xs text-subtle">
                  {seconds.toFixed(1)}s
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
