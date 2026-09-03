"use client";

import { AudioLines, Check, MousePointer2, Music, Play, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createElement } from "@/lib/studio/actions";
import { libraryUrl } from "@/lib/studio/files";
import { isAnimated, LIBRARY, LIBRARY_GROUPS, previewFrames, type LibraryItem } from "@/lib/studio/library";
import { Words } from "@/remotion/Film";
import { clipStyle, motionState } from "@/remotion/motion";
import type { ElementDraft, ProjectFile } from "@/types/prism";
import { PanelShell } from "./PanelShell";

/**
 * Prebuilt pieces, one click from being elements of this film.
 *
 * Tiles: a preview on the film's ground and a name, filtered by a row of
 * chips. Hovering a tile shows a card with the piece at a readable size and
 * what it is for; clicking the tile adds it. The library is not the film's:
 * nothing here is placed or reviewed. Adding copies the piece into Elements
 * under its own id, and from then on it is the film's to change. The same
 * name added twice gets a number, the way a new layer does.
 */

type Filter = "All" | (typeof LIBRARY_GROUPS)[number];
const FILTERS: readonly Filter[] = ["All", ...LIBRARY_GROUPS];

type Hover = { item: LibraryItem; top: number; left: number } | null;

export function LibraryPanel({ file }: { file: ProjectFile }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [hover, setHover] = useState<Hover>(null);

  const items = LIBRARY.filter((item) => filter === "All" || item.group === filter);

  // Stable, so a tile's unmount cleanup is the function it mounted with.
  const onHover = useCallback((item: LibraryItem, rect: DOMRect | null) => {
    setHover(rect ? { item, top: rect.top, left: rect.right + 12 } : null);
  }, []);

  return (
    <PanelShell title="Library">
      <div role="tablist" aria-label="Library groups" className="thin-scroll -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((name) => {
          const selected = name === filter;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setFilter(name);
                // The tile under the pointer is about to change; its card must not stay.
                setHover(null);
              }}
              className={`ds-focus h-7 shrink-0 rounded-pill px-3 text-xs font-medium transition-[background-color,color] duration-140 ${
                selected ? "bg-ink text-inverse" : "bg-sunken text-muted hover:text-ink"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Tile key={item.id} item={item} file={file} onHover={onHover} />
        ))}
      </ul>

      {hover ? <HoverCard hover={hover} /> : null}
    </PanelShell>
  );
}

function Tile({
  item,
  file,
  onHover,
}: {
  item: LibraryItem;
  file: ProjectFile;
  onHover: (item: LibraryItem, rect: DOMRect | null) => void;
}) {
  const [added, setAdded] = useState(false);

  // A tile that leaves the screen takes its card with it, even without a
  // pointerleave: filtering unmounts tiles under a pointer that never moved.
  useEffect(() => () => onHover(item, null), [item, onHover]);

  // "Added" is a moment, not a state: it shows and then the tile is a tile again.
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(timer);
  }, [added]);

  function add() {
    const result = createElement({ ...item.draft, name: nextName(file, item.draft.name) });
    if (result.ok) setAdded(true);
  }

  return (
    <li>
      <button
        type="button"
        onClick={add}
        onPointerEnter={(event) => onHover(item, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => onHover(item, null)}
        onFocus={(event) => onHover(item, event.currentTarget.getBoundingClientRect())}
        onBlur={() => onHover(item, null)}
        aria-label={`Add ${item.name} to elements`}
        className="ds-focus group relative flex w-full flex-col gap-1.5 rounded-sm p-1.5 text-left transition-[background-color] duration-140 hover:bg-sunken"
      >
        <Preview draft={item.draft} />
        {item.draft.kind === "audio" ? <PlayButton src={item.draft.src} /> : null}
        <span className="flex w-full items-center gap-1 px-0.5">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{item.name}</span>
          <span
            className={`grid size-4 shrink-0 place-items-center rounded-pill transition-opacity duration-140 ${
              added ? "bg-success text-inverse opacity-100" : "bg-ink text-inverse opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
            aria-hidden
          >
            {added ? <Check size={9} strokeWidth={3} /> : <Plus size={9} strokeWidth={3} />}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Plays a library sound, once, from the tile. Its own control rather than
 * the tile's click, because the tile's click adds; a sound you have not
 * heard is a sound you should not have to add to hear.
 */
function PlayButton({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    const element = new Audio(libraryUrl(src));
    audio.current = element;
    element.onended = () => setPlaying(false);
    element.onerror = () => setPlaying(false);
    setPlaying(true);
    void element.play().catch(() => setPlaying(false));
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={playing ? "Stop" : "Play"}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          toggle(event as unknown as React.MouseEvent);
        }
      }}
      className="ds-focus absolute top-3 left-3 grid size-6 place-items-center rounded-pill bg-[#F5F5F7] text-[#0A0A0C] shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
    >
      {playing ? <Square size={9} strokeWidth={3} fill="currentColor" /> : <Play size={10} strokeWidth={3} fill="currentColor" />}
    </span>
  );
}

/**
 * The card a hovered tile shows: the piece at a readable size, its name and
 * what it is for. Fixed to the viewport, because the panel scrolls and would
 * clip anything positioned inside it; kept on screen if the tile is near the
 * bottom.
 */
function HoverCard({ hover }: { hover: NonNullable<Hover> }) {
  const height = 214;
  const top = Math.max(8, Math.min(hover.top, window.innerHeight - height - 8));
  return (
    <div
      role="tooltip"
      style={{ top, left: hover.left, width: 260 }}
      className="ds-floating pointer-events-none fixed z-[var(--ds-z-tooltip)] flex flex-col gap-2 rounded-sm bg-raised p-3"
    >
      <Preview draft={hover.item.draft} large />
      <p className="text-sm font-medium text-ink">{hover.item.name}</p>
      <p className="text-xs leading-[var(--ds-leading-body)] text-muted">{hover.item.blurb}</p>
    </div>
  );
}

const FAMILY: Record<"display" | "body" | "mono", string> = {
  display: "var(--film-display), Georgia, serif",
  body: "var(--ds-font-sans)",
  mono: "var(--ds-font-mono)",
};

const PREVIEW_FPS = 30;
/** Frames the last state holds before the loop starts again. */
const HOLD = 20;

type VisualDraft = Extract<ElementDraft, { kind: "text" | "shape" | "image" | "video" }>;

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
function Preview({ draft, large = false }: { draft: ElementDraft; large?: boolean }) {
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
      ) : draft.kind === "image" ? (
        <span className="absolute inset-0 flex items-center justify-center text-[#F5F5F7]">
          <MousePointer2 size={large ? 40 : 22} strokeWidth={1.6} />
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
            background: draft.fill,
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
  ]
    .filter(Boolean)
    .join(" ");
  const placed: React.CSSProperties = {
    position: "absolute",
    left: `${(draft.box.x + move.dx) * 100}%`,
    top: `${(draft.box.y + move.dy) * 100}%`,
    transform,
    opacity: style.opacity,
    ...(style.filter ? { filter: style.filter } : {}),
  };

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
              caret: draft.caret,
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
          background: draft.fill,
          borderRadius: draft.shape === "ellipse" ? "999px" : `${draft.radius * Math.min(w, h)}px`,
        }}
      />
    );
  }

  // An image or a video: the cursor, as its icon, and the spot it is
  // heading for, so the glide and the click have somewhere to land.
  const heading = draft.motion.x !== 0 || draft.motion.y !== 0;
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
        <MousePointer2 size={Math.max(Math.round(width * 0.11), draft.box.width * width * 1.4)} strokeWidth={1.6} />
      </span>
    </>
  );
}

/** "Headline 2" when "Headline" is taken. */
function nextName(file: ProjectFile, stem: string): string {
  const taken = new Set(file.elements.map((element) => element.name));
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem} ${n}`)) n += 1;
  return `${stem} ${n}`;
}
