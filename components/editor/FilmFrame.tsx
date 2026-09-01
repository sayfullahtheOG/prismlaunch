"use client";

import type { CSSProperties } from "react";
import type { Palette, Scene } from "@/types/prism";
import styles from "./FilmFrame.module.css";

type Props = {
  scene: Scene;
  palette: Palette;
  /** Bumped to replay the animation from the top. */
  playToken: number;
};

/**
 * Renders one scene of the film.
 *
 * The film is styled from the scene's `palette` via inline styles, never from
 * Tailwind tokens — the palette is data in the scene graph, and the eventual
 * Remotion renderer has no Tailwind at all. Keeping that line clean here means
 * these components port to `remotion/scenes/` almost unchanged.
 */
export function FilmFrame({ scene, palette, playToken }: Props) {
  const shell: CSSProperties = {
    color: palette.text,
    // `key` on the wrapper restarts CSS animations; container queries let the
    // film scale with the frame rather than the viewport.
    containerType: "inline-size",
  };

  return (
    <div key={playToken} className="absolute inset-0" style={shell}>
      {scene.template === "kinetic-type" ? (
        <KineticType scene={scene} palette={palette} />
      ) : null}
      {scene.template === "product-reveal" ? (
        <ProductReveal scene={scene} palette={palette} />
      ) : null}
      {scene.template === "component-spotlight" ? (
        <ComponentSpotlight palette={palette} />
      ) : null}
      {scene.template === "outcome-cta" ? (
        <OutcomeCta scene={scene} palette={palette} />
      ) : null}
    </div>
  );
}

type PartProps = { scene: Scene; palette: Palette };

function KineticType({ scene, palette }: PartProps) {
  // Break the headline into three beats so the type lands in rhythm.
  const words = scene.headline.split(" ");
  const size = Math.ceil(words.length / 3);
  const lines = [
    words.slice(0, size).join(" "),
    words.slice(size, size * 2).join(" "),
    words.slice(size * 2).join(" "),
  ].filter(Boolean);

  return (
    <div className={`${styles.frame} ${styles.kinetic}`}>
      <h2 className={styles.head} style={{ color: palette.primary }}>
        {lines.map((line, i) => (
          <span
            key={line}
            className={styles.line}
            style={i === lines.length - 1 ? { color: palette.accent, fontStyle: "italic" } : undefined}
          >
            {line}
          </span>
        ))}
      </h2>
    </div>
  );
}

function ProductReveal({ scene, palette }: PartProps) {
  return (
    <div className={`${styles.frame} ${styles.reveal}`}>
      <span className={styles.logoRow}>
        <span
          className={styles.logoMark}
          style={{ background: palette.accent, color: palette.background }}
        >
          {scene.headline.charAt(0)}
        </span>
        <span className={styles.wordmark} style={{ color: palette.primary }}>
          {scene.headline}
        </span>
      </span>
      {scene.body ? <p className={styles.sub}>{scene.body}</p> : null}
    </div>
  );
}

function ComponentSpotlight({ palette }: Pick<PartProps, "palette">) {
  const rows = [
    { label: "Assign issue to me", key: "↵", hit: true },
    { label: "Assign to teammate", key: "⌥A", hit: false },
    { label: "Move to current cycle", key: "⌥C", hit: false },
  ];

  // Surfaces are tinted from palette.text, never from a hardcoded white.
  // `warm-playful` is a light art direction, and white-on-cream renders the
  // whole component invisible (context/ui-context.md §Film palettes).
  const wash = `${palette.text}0d`;
  const edge = `${palette.text}1f`;
  const chip = `${palette.text}24`;

  return (
    <div className={`${styles.frame} ${styles.spotlight}`}>
      <div
        className={styles.palette}
        style={{ background: wash, border: `1px solid ${edge}` }}
      >
        <div
          className={styles.pSearch}
          style={{ borderBottom: `1px solid ${edge}` }}
        >
          <span className={styles.pDot} style={{ background: palette.accent }} />
          <span className={styles.pTyped} style={{ color: palette.accent }}>
            <span style={{ color: palette.primary }}>assign to me</span>
          </span>
        </div>

        {rows.map((row) => (
          <div
            key={row.label}
            className={styles.pRow}
            style={row.hit ? { background: `${palette.accent}1c` } : undefined}
          >
            <span
              className={styles.pIco}
              style={{ background: row.hit ? palette.accent : chip }}
            />
            {row.label}
            <span className={styles.pKey}>{row.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutcomeCta({ scene, palette }: PartProps) {
  return (
    <div className={`${styles.frame} ${styles.outcome}`}>
      <span className={styles.eyebrow} style={{ color: palette.accent }}>
        Ship faster
      </span>
      <h2 className={styles.head} style={{ color: palette.primary }}>
        {scene.headline}
      </h2>
      {scene.body ? (
        <span className={styles.url} style={{ color: palette.accent }}>
          {scene.body}
        </span>
      ) : null}
    </div>
  );
}
