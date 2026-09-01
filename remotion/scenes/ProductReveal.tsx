import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { ambientScale, enter } from "../motion";
import type { SceneProps } from "./types";

/** Scene 02 — Reveal. The product and its core promise. */
export function ProductReveal({ scene, palette }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const mark = enter({ frame, fps, preset: scene.motionPreset, delay: 3 });
  const promise = enter({ frame, fps, preset: scene.motionPreset, delay: 16 });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        justifyContent: "center",
        padding: "0 8%",
        transform: `scale(${ambientScale(frame, durationInFrames)})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 26, ...mark }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 19,
            background: palette.accent,
            color: palette.background,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 44,
            flexShrink: 0,
          }}
        >
          {scene.headline.trim().charAt(0).toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 96,
            lineHeight: 1,
            color: palette.primary,
          }}
        >
          {scene.headline}
        </div>
      </div>

      {scene.body ? (
        <p
          style={{
            margin: "28px 0 0",
            fontFamily: FONT_BODY,
            fontSize: 30,
            // Dim via the colour, not `opacity` — the enter() spread below
            // owns opacity, and setting both means one silently wins.
            color: `${palette.text}9e`,
            maxWidth: "62%",
            ...promise,
          }}
        >
          {scene.body}
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
