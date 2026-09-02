import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../fonts";
import { enter, typedLength } from "../motion";
import type { SceneProps } from "./types";

/**
 * Scene 03 — Proof. Animates a component-inspired UI, not the customer's
 * actual component.
 *
 * PrismLaunch never runs a user's code, so this is deliberately *inspired by*
 * the source rather than a render of it: the label comes from the manifest,
 * and the surrounding chrome is ours. The UI states this plainly next to the
 * evidence; the film should not imply more than the inspection can support.
 */

const ROWS = [
  { label: "Assign issue to me", key: "↵", hit: true },
  { label: "Assign to teammate", key: "⌥A", hit: false },
  { label: "Move to current cycle", key: "⌥C", hit: false },
] as const;

const QUERY = "assign to me";

export function ComponentSpotlight({
  scene,
  palette,
  componentLabel,
}: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = scene.motionPreset;

  const shell = enter({ frame, fps, preset, delay: 2 });
  const typed = QUERY.slice(0, typedLength(frame, QUERY.length, 16, 2));
  const caretOn = Math.floor(frame / 8) % 2 === 0;

  /**
   * Surfaces are tinted from palette.text, never a hardcoded white:
   * `warm-playful` is a light art direction, and white-on-cream renders the
   * whole component invisible (context/ui-context.md §Film palettes).
   */
  const wash = `${palette.text}0d`;
  const edge = `${palette.text}1f`;
  const chip = `${palette.text}24`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        justifyContent: "center",
        padding: "0 9%",
      }}
    >
      <h2
        style={{
          margin: "0 0 26px",
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 46,
          letterSpacing: "-0.015em",
          color: palette.primary,
          ...enter({ frame, fps, preset, delay: 0 }),
        }}
      >
        {scene.headline}
      </h2>

      <div
        style={{
          background: wash,
          border: `1px solid ${edge}`,
          borderRadius: 14,
          overflow: "hidden",
          ...shell,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "20px 22px",
            borderBottom: `1px solid ${edge}`,
          }}
        >
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: palette.accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 25,
              color: palette.primary,
              whiteSpace: "pre",
            }}
          >
            {typed}
            <span style={{ opacity: caretOn ? 1 : 0, color: palette.accent }}>
              |
            </span>
          </span>
        </div>

        {ROWS.map((row, index) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 22px",
              fontFamily: FONT_BODY,
              fontSize: 23,
              color: palette.text,
              background: row.hit ? `${palette.accent}1f` : "transparent",
              ...enter({ frame, fps, preset, delay: 44 + index * 4 }),
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: row.hit ? palette.accent : chip,
                flexShrink: 0,
              }}
            />
            {row.label}
            <span
              style={{
                marginLeft: "auto",
                fontFamily: FONT_MONO,
                fontSize: 17,
                opacity: 0.45,
              }}
            >
              {row.key}
            </span>
          </div>
        ))}
      </div>

      {componentLabel ? (
        <span
          style={{
            marginTop: 22,
            fontFamily: FONT_MONO,
            fontSize: 16,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: palette.accent,
            ...enter({ frame, fps, preset, delay: 62 }),
          }}
        >
          {componentLabel}
        </span>
      ) : null}
    </AbsoluteFill>
  );
}
