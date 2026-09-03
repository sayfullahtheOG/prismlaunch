"use client";

import { AudioLines, Hand, LayoutTemplate, MousePointer2, Music, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HAND_SRC, isAnimated, previewFrames } from "@/lib/studio/library";
import { Words } from "@/remotion/Film";
import { drawProgress, ICON_PATHS } from "@/remotion/icons";
import { clipStyle, motionState } from "@/remotion/motion";
import { particlesAt } from "@/remotion/particles";
import type { ElementDraft } from "@/types/prism";

/**
 * How a piece is shown before it is on the timeline.
 *
 * The Text, Shapes, Motion and Audio sections and the Elements section draw the same thing: a piece on the
 * film's dark ground in the film's proportions, moving if it moves, and a
 * card with it at a readable size when a tile is hovered. One module, so a
 * piece looks the same before and after it becomes an element.
 */

export const FAMILY: Record<"display" | "body" | "mono", string> = {
  display: "var(--film-display), Georgia, serif",
  body: "var(--ds-font-sans)",
  mono: "var(--ds-font-mono)",
};

const PREVIEW_FPS = 30;
/** Frames the last state holds before the loop starts again. */
const HOLD = 20;

type VisualDraft = Extract<
  ElementDraft,
  { kind: "text" | "shape" | "image" | "video" | "icon" | "particles" | "device" | "html" }
>;

/** A shape's fill, a gradient if it has one. */
function fillOf(draft: Extract<ElementDraft, { kind: "shape" }>): string {
  return draft.fillTo
    ? `linear-gradient(${draft.fillAngle}deg, ${draft.fill}, ${draft.fillTo})`
    : draft.fill;
}

/** An icon at one frame of its draw-on, as the film draws it. */
function IconGlyph({
  draft,
  size,
  frame,
}: {
  draft: Extract<ElementDraft, { kind: "icon" }>;
  size: number;
  frame: number;
}) {
  const shape = ICON_PATHS[draft.icon];
  const frames = draft.animation.enter === "none" ? 12 : Math.max(1, draft.animation.enterFrames);
  const drawn = draft.draw ? drawProgress(frame, frames) : 1;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ overflow: "visible" }} aria-hidden>
      <path
        d={shape.d}
        pathLength={1}
        fill={shape.filled ? draft.color : "none"}
        fillOpacity={shape.filled ? drawn : undefined}
        stroke={shape.filled ? "none" : draft.color}
        strokeWidth={shape.filled ? undefined : draft.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={draft.draw && !shape.filled ? 1 : undefined}
        strokeDashoffset={draft.draw && !shape.filled ? 1 - drawn : undefined}
      />
    </svg>
  );
}

/** A device frame in miniature: the bezel or the bar, and a blank screen. */
function DeviceGlyph({
  draft,
  width,
  height,
}: {
  draft: Extract<ElementDraft, { kind: "device" }>;
  width: number;
  height: number;
}) {
  const w = Math.max(10, draft.box.width * width);
  const h = Math.max(10, draft.box.height * height);
  const phone = draft.device === "phone";
  const bar = draft.device === "browser" ? Math.max(3, h * 0.1) : 0;
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        background: draft.device === "window" || draft.device === "card" ? draft.screen : draft.frame,
        borderRadius: phone ? w * 0.18 : Math.max(2, draft.radius * Math.min(w, h)),
        boxShadow: draft.device === "window" ? `inset 0 0 0 1px ${draft.frame}66` : undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {phone || bar ? (
        <span
          style={{
            position: "absolute",
            left: phone ? w * 0.06 : 0,
            right: phone ? w * 0.06 : 0,
            top: phone ? w * 0.06 : bar,
            bottom: phone ? w * 0.06 : 0,
            background: draft.screen,
            borderRadius: phone ? w * 0.12 : 0,
          }}
        />
      ) : null}
    </span>
  );
}

/**
 * A clock for a piece that moves: the frame to draw, looping over the
 * piece's own length with a beat of rest at the end. One animation-frame
 * request per moving tile and none for a still one; someone who asked
 * their system for less motion gets the piece where it ends up.
 */
function useLoop(active: boolean, frames: number): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    let request = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      request = requestAnimationFrame(() => setFrame(frames - 1));
      return () => cancelAnimationFrame(request);
    }
    const start = performance.now();
    let last = -1;
    const tick = (now: number) => {
      const elapsed = Math.floor(((now - start) / 1000) * PREVIEW_FPS) % (frames + HOLD);
      const next = Math.min(elapsed, frames - 1);
      if (next !== last) {
        last = next;
        setFrame(next);
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [active, frames]);

  return frame;
}

/**
 * The piece on the film's dark ground, in the film's proportions. Type
 * shows its face, weight and colour at a size scaled from the element's;
 * a shape shows its form at the size its box gives it, with a floor so a
 * hairline rule is still visible. A piece that moves is played, not
 * pictured: the same frame functions the film uses, on a loop.
 */
export function Preview({ draft, large = false }: { draft: ElementDraft; large?: boolean }) {
  const width = large ? 236 : 128;
  const height = Math.round((width * 9) / 16);
  const animated = isAnimated(draft);
  const frames = previewFrames(draft);
  const frame = useLoop(animated, frames);

  return (
    <span
      className="relative block w-full overflow-hidden rounded-xs bg-[#0A0A0C] shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)]"
      style={{ aspectRatio: "16 / 9" }}
      aria-hidden
    >
      {animated && "motion" in draft ? (
        <Playing draft={draft} frame={frame} frames={frames} width={width} height={height} />
      ) : draft.kind === "text" ? (
        <span
          className="absolute inset-0 flex items-center justify-center px-2 leading-none"
          style={{
            fontFamily: FAMILY[draft.fontFamily],
            fontWeight: draft.fontWeight,
            color: draft.color,
            // Three times the film's proportion: a tile is a swatch of the
            // face, not a rendering of the frame, and at true scale a label
            // would be a speck.
            fontSize: Math.max(11, draft.fontSize * height * 3),
            letterSpacing: `${draft.letterSpacing}em`,
          }}
        >
          Aa
        </span>
      ) : draft.kind === "image" || draft.kind === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center text-[#F5F5F7]">
          {draft.src === HAND_SRC ? (
            <Hand size={large ? 40 : 22} strokeWidth={1.6} />
          ) : (
            <MousePointer2 size={large ? 40 : 22} strokeWidth={1.6} />
          )}
        </span>
      ) : draft.kind === "icon" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <IconGlyph draft={draft} size={large ? 48 : 26} frame={999} />
        </span>
      ) : draft.kind === "particles" ? (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: draft.colors[0] }}>
          <Sparkles size={large ? 40 : 22} strokeWidth={1.6} />
        </span>
      ) : draft.kind === "device" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <DeviceGlyph draft={draft} width={width} height={height} />
        </span>
      ) : draft.kind === "html" ? (
        <span className="absolute inset-0 flex items-center justify-center text-[#F5F5F7]">
          <LayoutTemplate size={large ? 40 : 22} strokeWidth={1.6} />
        </span>
      ) : draft.kind === "audio" ? (
        <span className="absolute inset-0 flex items-center justify-center text-[#5B8CFF]">
          {draft.role === "music" ? (
            <Music size={large ? 44 : 24} strokeWidth={1.6} />
          ) : (
            <AudioLines size={large ? 44 : 24} strokeWidth={1.6} />
          )}
        </span>
      ) : draft.kind === "shape" ? (
        <span
          className="absolute"
          style={{
            left: "50%",
            top: `${draft.box.y * 100}%`,
            transform: "translate(-50%, -50%)",
            width: Math.max(6, draft.box.width * width),
            height: Math.max(3, draft.box.height * height),
            background: fillOf(draft),
            borderRadius:
              draft.shape === "ellipse"
                ? "999px"
                : `${draft.radius * Math.min(draft.box.width * width, draft.box.height * height)}px`,
          }}
        />
      ) : null}
    </span>
  );
}

/**
 * A moving piece at one frame, drawn with what the film draws it with:
 * the enter and exit from `clipStyle`, the move from `motionState`, the
 * words from `Words`. Positions are the box's own, so a move reads at the
 * scale it will have; sizes have floors, because a cursor three percent
 * of a 128-pixel tile is four pixels. Type is a swatch at a legible size
 * rather than a rendering of the frame, as it is on a still tile.
 */
function Playing({
  draft,
  frame,
  frames,
  width,
  height,
}: {
  draft: VisualDraft;
  frame: number;
  frames: number;
  width: number;
  height: number;
}) {
  const style = clipStyle(draft.animation, draft.box, frame, frames, PREVIEW_FPS);
  const move = motionState(draft.motion, frame, frames);
  const transform = [
    "translate(-50%, -50%)",
    style.transform,
    move.scale !== 1 ? `scale(${move.scale})` : "",
    move.rotate !== 0 ? `rotate(${move.rotate}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const placed: React.CSSProperties = {
    position: "absolute",
    left: `${(draft.box.x + move.dx) * 100}%`,
    top: `${(draft.box.y + move.dy) * 100}%`,
    transform,
    opacity: style.opacity * move.opacity,
    ...(style.filter ? { filter: style.filter } : {}),
    ...(style.clipPath ? { clipPath: style.clipPath } : {}),
  };

  if (draft.kind === "icon") {
    return (
      <span style={{ ...placed, display: "block", lineHeight: 0 }}>
        <IconGlyph draft={draft} size={Math.max(14, draft.box.width * width * 1.6)} frame={frame} />
      </span>
    );
  }

  if (draft.kind === "particles") {
    // The burst itself, at tile scale: every piece where the film would put it.
    const pieces = particlesAt(draft, frame, frames, width / height);
    return (
      <>
        {pieces.map((piece, index) => {
          const h = Math.max(2, piece.size * height * 1.6);
          return (
            <span
              key={index}
              style={{
                position: "absolute",
                left: `${piece.x * 100}%`,
                top: `${piece.y * 100}%`,
                width: h * piece.aspect,
                height: h,
                marginLeft: (-h * piece.aspect) / 2,
                marginTop: -h / 2,
                background: piece.color,
                borderRadius: piece.round ? "50%" : 1,
                opacity: piece.opacity * style.opacity,
                transform: `rotate(${piece.rotate}deg)`,
              }}
            />
          );
        })}
      </>
    );
  }

  if (draft.kind === "device") {
    return (
      <span style={{ ...placed, display: "block", lineHeight: 0 }}>
        <DeviceGlyph draft={draft} width={width} height={height} />
      </span>
    );
  }

  if (draft.kind === "html") {
    return (
      <span style={{ ...placed, display: "block", lineHeight: 0, color: "#F5F5F7" }}>
        <LayoutTemplate size={Math.max(16, Math.round(width * 0.18))} strokeWidth={1.6} />
      </span>
    );
  }

  if (draft.kind === "text") {
    return (
      <span
        style={{
          ...placed,
          left: "50%",
          top: "50%",
          width: "88%",
          display: "flex",
          alignItems: "center",
          justifyContent:
            draft.align === "left" ? "flex-start" : draft.align === "right" ? "flex-end" : "center",
          textAlign: draft.align,
          fontFamily: FAMILY[draft.fontFamily],
          fontWeight: draft.fontWeight,
          color: draft.color,
          fontSize: Math.max(11, draft.fontSize * height * 2.4),
          lineHeight: 1.15,
          letterSpacing: `${draft.letterSpacing}em`,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        <span>
          <Words
            clip={{
              text: draft.text ?? "Aa",
              reveal: draft.reveal,
              revealFrames: draft.revealFrames,
              revealStagger: draft.revealStagger,
              revealStyle: draft.revealStyle,
              caret: draft.caret,
              ...(draft.accent ? { accent: draft.accent } : {}),
            }}
            frame={frame}
            fps={PREVIEW_FPS}
          />
        </span>
      </span>
    );
  }

  if (draft.kind === "shape") {
    const w = Math.max(6, draft.box.width * width);
    const h = Math.max(6, draft.box.height * height);
    return (
      <span
        style={{
          ...placed,
          width: w,
          height: h,
          background: fillOf(draft),
          borderRadius: draft.shape === "ellipse" ? "999px" : `${draft.radius * Math.min(w, h)}px`,
        }}
      />
    );
  }

  // An image or a video: the cursor, as its icon, and the spot it is
  // heading for, so the glide and the click have somewhere to land.
  const heading = draft.motion.x !== 0 || draft.motion.y !== 0;
  const Pointer = draft.src === HAND_SRC ? Hand : MousePointer2;
  return (
    <>
      {heading ? (
        <span
          style={{
            position: "absolute",
            left: `${(draft.box.x + draft.motion.x) * 100}%`,
            top: `${(draft.box.y + draft.motion.y) * 100}%`,
            transform: "translate(-28%, -28%)",
            width: Math.round(width * 0.17),
            height: Math.round(height * 0.12),
            borderRadius: 999,
            background: "#F5F5F7",
            opacity: 0.22,
          }}
        />
      ) : null}
      <span style={{ ...placed, display: "block", lineHeight: 0, color: "#F5F5F7" }}>
        <Pointer
          size={Math.max(Math.round(width * 0.11), draft.box.width * width * 1.4)}
          strokeWidth={1.6}
        />
      </span>
    </>
  );
}

/**
 * The card a hovered tile shows: the piece at a readable size, a title and
 * one line under it. Fixed to the viewport, because the panel scrolls and
 * would clip anything positioned inside it; kept on screen if the tile is
 * near the bottom.
 */
export function PieceCard({
  draft,
  title,
  detail,
  top,
  left,
}: {
  draft: ElementDraft;
  title: string;
  detail: string;
  top: number;
  left: number;
}) {
  const height = 214;
  const y = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  return (
    <div
      role="tooltip"
      style={{ top: y, left, width: 260 }}
      className="ds-floating pointer-events-none fixed z-[var(--ds-z-tooltip)] flex flex-col gap-2 rounded-sm bg-raised p-3"
    >
      <Preview draft={draft} large />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-xs leading-[var(--ds-leading-body)] text-muted">{detail}</p>
    </div>
  );
}

export type Hover<T> = { item: T; top: number; left: number } | null;

/** Which tile is hovered and where its card goes. The handler is stable, so a tile's unmount cleanup is the function it mounted with. */
export function useHoverCard<T>() {
  const [hover, setHover] = useState<Hover<T>>(null);
  const onHover = useCallback((item: T, rect: DOMRect | null) => {
    setHover(rect ? { item, top: rect.top, left: rect.right + 12 } : null);
  }, []);
  const clear = useCallback(() => setHover(null), []);
  return { hover, onHover, clear };
}

/** A row of filter chips, one selected. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="thin-scroll -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1"
    >
      {options.map((name) => {
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(name)}
            className={`ds-focus h-7 shrink-0 rounded-pill px-3 text-xs font-medium transition-[background-color,color] duration-140 ${
              selected ? "bg-ink text-inverse" : "bg-sunken text-muted hover:text-ink"
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
