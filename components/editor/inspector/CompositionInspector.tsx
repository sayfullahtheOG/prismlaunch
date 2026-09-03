"use client";

import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { setBackground, setDuration } from "@/lib/studio/actions";
import type { ProjectFile } from "@/types/prism";
import { ColorField, Heading, NumberField, Stat } from "./fields";

/**
 * The composition itself: its ground, how long it runs, what size it is.
 *
 * Reached by clicking the Background row in the timeline. The background is
 * not a clip and never will be — it has no start, no end, nothing to arrange —
 * so its row is where you find it, and this is where you change it. There
 * used to be a whole rail section for these four fields; they are properties
 * of one thing, and properties go in the properties pane.
 */
export function CompositionInspector({ file }: { file: ProjectFile }) {
  const background = file.background;

  return (
    <>
      <Heading
        title="Background"
        detail={`${file.width}×${file.height} · ${file.fps}fps · ${(file.durationInFrames / file.fps).toFixed(1)}s`}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
        <Field label="Ground">
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
        </Field>

        {background.kind === "solid" ? (
          <ColorField
            label="Colour"
            value={background.color}
            onChange={(color) => setBackground({ kind: "solid", color })}
          />
        ) : (
          <>
            <ColorField
              label="From"
              value={background.from}
              onChange={(from) => setBackground({ ...background, from })}
            />
            <ColorField
              label="To"
              value={background.to}
              onChange={(to) => setBackground({ ...background, to })}
            />
            <NumberField
              label="Angle"
              value={background.angle}
              step={1}
              min={0}
              max={360}
              onChange={(angle) => setBackground({ ...background, angle })}
            />
          </>
        )}

        <NumberField
          label="Duration (seconds)"
          value={Number((file.durationInFrames / file.fps).toFixed(1))}
          step={0.5}
          min={0.1}
          onChange={(seconds) => {
            if (seconds > 0) setDuration(Math.round(seconds * file.fps));
          }}
        />

        <dl className="flex flex-col gap-1.5">
          <Stat label="Size" value={`${file.width} × ${file.height}`} />
          <Stat label="Frame rate" value={`${file.fps} fps`} />
          <Stat label="Frames" value={String(file.durationInFrames)} />
        </dl>
      </div>
    </>
  );
}
