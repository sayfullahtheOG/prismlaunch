import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../fonts";
import { enter } from "../motion";
import type { SceneProps } from "./types";

/** Scene 04 — Resolve. The outcome, then the name to remember. */
export function OutcomeCta({ scene, palette }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = scene.motionPreset;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        justifyContent: "center",
        padding: "0 8%",
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 19,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: palette.accent,
          ...enter({ frame, fps, preset, delay: 2 }),
        }}
      >
        {scene.emphasis === "outcome" ? "The outcome" : scene.emphasis}
      </span>

      <h1
        style={{
          margin: "22px 0 0",
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 74,
          lineHeight: 1.06,
          letterSpacing: "-0.015em",
          color: palette.primary,
          ...enter({ frame, fps, preset, delay: 10 }),
        }}
      >
        {scene.headline}
      </h1>

      {scene.body ? (
        <span
          style={{
            marginTop: 30,
            fontFamily: FONT_BODY,
            fontSize: 27,
            fontWeight: 600,
            color: palette.accent,
            ...enter({ frame, fps, preset, delay: 22 }),
          }}
        >
          {scene.body}
        </span>
      ) : null}
    </AbsoluteFill>
  );
}
