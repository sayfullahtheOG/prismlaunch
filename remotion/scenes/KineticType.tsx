import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_DISPLAY } from "../fonts";
import { enter } from "../motion";
import type { SceneProps } from "./types";

/** Split a headline into three beats so the type lands in rhythm. */
function beats(headline: string): string[] {
  const words = headline.trim().split(/\s+/);
  if (words.length <= 3) return words;

  const size = Math.ceil(words.length / 3);
  return [
    words.slice(0, size).join(" "),
    words.slice(size, size * 2).join(" "),
    words.slice(size * 2).join(" "),
  ].filter((line) => line.length > 0);
}

/** Scene 01 — Hook. Establishes the pain in a few words. */
export function KineticType({ scene, palette }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = beats(scene.headline);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        justifyContent: "center",
        padding: "0 8%",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 78,
          lineHeight: 1.04,
          letterSpacing: "-0.015em",
          color: palette.primary,
        }}
      >
        {lines.map((line, index) => (
          <span
            key={line}
            style={{
              display: "block",
              ...enter({
                frame,
                fps,
                preset: scene.motionPreset,
                delay: index * 8,
              }),
              // The last beat carries the turn, so it takes the accent.
              ...(index === lines.length - 1
                ? { color: palette.accent, fontStyle: "italic" }
                : {}),
            }}
          >
            {line}
          </span>
        ))}
      </h1>
    </AbsoluteFill>
  );
}
