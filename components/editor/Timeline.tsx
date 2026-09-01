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
  "component-spotlight": "Proof",
  "outcome-cta": "Resolve",
};

/**
 * The timeline is the storyboard. Four fixed clips, widths proportional to
 * duration, no reordering and no trimming (context/project-overview.md §Scope).
 * The lock icon says that plainly rather than leaving a user to discover it.
 */
export function Timeline({ scenes, activeSceneId, palette, onSelect }: Props) {
  const total = totalFrames(scenes);
  const totalSeconds = framesToSeconds(total);

  // A tick every 5s, plus one at the end so the ruler always closes.
  const ticks: number[] = [];
  for (let s = 0; s <= Math.floor(totalSeconds); s += 5) ticks.push(s);

  return (
    <section
      aria-label="Storyboard timeline"
      className="flex h-[188px] shrink-0 flex-col border-t border-line bg-surface"
    >
      <div className="flex items-center gap-2 px-4 py-2">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
          Storyboard
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[10.5px] text-faint">
          <Lock size={10} strokeWidth={2} aria-hidden />
          Fixed 4-scene structure
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint tabular-nums">
          {timecode(totalSeconds)}
        </span>
      </div>

      {/* ruler */}
      <div className="relative mx-4 h-5 border-b border-line" aria-hidden>
        {ticks.map((s) => (
          <span
            key={s}
            className="absolute top-0 flex h-full flex-col justify-end"
            style={{ left: `${(s / totalSeconds) * 100}%` }}
          >
            <span className="mb-0.5 -translate-x-1/2 font-mono text-[10px] text-faint tabular-nums">
              {timecode(s)}
            </span>
            <span className="h-1.5 w-px bg-line-strong" />
          </span>
        ))}
      </div>

      {/* track */}
      <div className="flex flex-1 items-center gap-1 px-4 pt-3 pb-4">
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          const isDraft = scene.approval === "draft";
          const seconds = framesToSeconds(scene.durationFrames);

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              aria-current={isActive ? "true" : "false"}
              style={{ flexGrow: scene.durationFrames, flexBasis: 0 }}
              className={`group relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-card border-2 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isDraft
                  ? "border-draft-line bg-draft-soft"
                  : isActive
                    ? "border-brand bg-brand-soft"
                    : "border-transparent bg-sunken hover:border-line-strong"
              }`}
            >
              {/* clip filmstrip — a hint of the frame's own palette */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: palette.accent, opacity: isActive ? 1 : 0.35 }}
              />

              <span className="flex items-center gap-1.5 pt-1">
                <span
                  className={`font-mono text-[10.5px] tabular-nums ${
                    isDraft ? "text-draft" : isActive ? "text-brand" : "text-faint"
                  }`}
                >
                  {String(scene.order).padStart(2, "0")}
                </span>
                <span className="truncate text-xs font-semibold">
                  {SCENE_LABEL[scene.template]}
                </span>
                {isDraft ? (
                  <Sparkles
                    size={11}
                    strokeWidth={2}
                    className="shrink-0 text-draft"
                    aria-label="Agent draft"
                  />
                ) : null}
              </span>

              <span className="truncate text-[11px] text-muted">
                {scene.headline}
              </span>

              <span className="flex items-center justify-between">
                <span className="truncate font-mono text-[10px] text-faint">
                  {scene.template}
                </span>
                <span className="font-mono text-[10px] text-faint tabular-nums">
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
