import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../fonts";
import { enter, typedLength } from "../motion";
import type { SceneProps } from "./types";

/**
 * Scene 03 — Proof. A suggestion of an interface, built from the words the
 * agent chose.
 *
 * This scene used to draw a hardcoded issue tracker: three fixed rows, a fixed
 * search query, invented keyboard shortcuts. That made every film about the
 * same imaginary product, which is precisely the thing PrismLaunch should not
 * do. The chrome is still ours — it has to be, since we never run anyone's
 * code — but everything inside it now comes from `scene.feature`.
 *
 * It is a *suggestion*, not a screenshot, and the film never claims otherwise.
 * The label sits under it in the accent colour so what is being shown is named.
 */

/** Enough to fill the panel; more than four rows and the type gets small. */
const MAX_ROWS = 4;

export function FeatureSpotlight({ scene, palette }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = scene.motionPreset;

  const label = scene.feature?.label ?? "";
  const tokens = (scene.feature?.visualTokens ?? []).slice(0, MAX_ROWS);

  // The query types itself out. The feature's own name is the honest thing to
  // put in a search field we invented.
  const query = label.toLowerCase();
  const typed = query.slice(0, typedLength(frame, query.length, 16, 2));
  const caretOn = Math.floor(frame / 8) % 2 === 0;

  const shell = enter({ frame, fps, preset, delay: 2 });

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
            borderBottom: tokens.length > 0 ? `1px solid ${edge}` : "none",
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

        {/*
         * One row per visual token. The first is highlighted, so the panel
         * reads as a result being chosen rather than a static list. An agent
         * that supplied no tokens gets the search field alone, which is still
         * a coherent frame — better than filling it with words nobody wrote.
         */}
        {tokens.map((token, index) => (
          <div
            key={`${token}-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 22px",
              fontFamily: FONT_BODY,
              fontSize: 23,
              color: palette.text,
              background: index === 0 ? `${palette.accent}1f` : "transparent",
              ...enter({ frame, fps, preset, delay: 44 + index * 4 }),
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: index === 0 ? palette.accent : chip,
                flexShrink: 0,
              }}
            />
            {token}
          </div>
        ))}
      </div>

      {label ? (
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
          {label}
        </span>
      ) : null}
    </AbsoluteFill>
  );
}
