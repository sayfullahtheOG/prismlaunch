"use client";

import { setBackground, setDuration } from "@/lib/studio/actions";
import { Field, TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import type { ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

/**
 * The composition itself: its ground, its size, how long it runs.
 *
 * The background lives here rather than in the timeline because it is not a
 * clip and never will be — it has no start, no end, and nothing to arrange. Its
 * row in the timeline shows it exists; this is where it is edited.
 */
export function CanvasPanel({ file }: { file: ProjectFile }) {
  const background = file.background;

  return (
    <PanelShell title="Canvas" hint="The ground everything sits on.">
      <PanelSection label="Background">
        <Segmented
          label="Background kind"
          options={[
            { value: "solid", label: "Solid" },
            { value: "gradient", label: "Gradient" },
          ]}
          value={background.kind}
          onChange={(kind) =>
            setBackground(
              kind === "solid"
                ? { kind: "solid", color: "#0A0A0C" }
                : { kind: "gradient", from: "#0A0A0C", to: "#1B1B22", angle: 160 },
            )
          }
        />

        <div className="mt-3 flex flex-col gap-3">
          {background.kind === "solid" ? (
            <Swatch
              label="Colour"
              value={background.color}
              onChange={(color) => setBackground({ kind: "solid", color })}
            />
          ) : (
            <>
              <Swatch
                label="From"
                value={background.from}
                onChange={(from) => setBackground({ ...background, from })}
              />
              <Swatch
                label="To"
                value={background.to}
                onChange={(to) => setBackground({ ...background, to })}
              />
              <Field label="Angle">
                <TextInput
                  type="number"
                  value={background.angle}
                  min={0}
                  max={360}
                  onChange={(event) =>
                    setBackground({
                      ...background,
                      angle: Number(event.target.value) || 0,
                    })
                  }
                  className="tabular font-mono text-xs"
                />
              </Field>
            </>
          )}
        </div>
      </PanelSection>

      <PanelSection label="Composition">
        <Field label="Duration (seconds)">
          <TextInput
            type="number"
            step={0.5}
            min={0.5}
            value={(file.durationInFrames / file.fps).toFixed(1)}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              if (!Number.isNaN(seconds) && seconds > 0) {
                setDuration(Math.round(seconds * file.fps));
              }
            }}
            className="tabular font-mono text-xs"
          />
        </Field>

        <dl className="mt-3 flex flex-col gap-1.5">
          <Stat label="Size" value={`${file.width} × ${file.height}`} />
          <Stat label="Frame rate" value={`${file.fps} fps`} />
          <Stat label="Frames" value={String(file.durationInFrames)} />
        </dl>
      </PanelSection>
    </PanelShell>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value.slice(0, 7)}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label} swatch`}
          className="ds-focus ds-inset size-9 shrink-0 cursor-pointer rounded-sm bg-sunken p-1"
        />
        <TextInput
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="tabular font-mono text-xs"
          spellCheck={false}
          aria-label={label}
        />
      </div>
    </Field>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}
