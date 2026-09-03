"use client";

import { Check, Play, Plus, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createElement } from "@/lib/studio/actions";
import { libraryUrl } from "@/lib/studio/files";
import { LIBRARY, LIBRARY_GROUPS, type LibraryItem } from "@/lib/studio/library";
import type { ProjectFile } from "@/types/prism";
import { PanelShell } from "./PanelShell";
import { Chips, PieceCard, Preview, useHoverCard } from "./PiecePreview";

/**
 * The studio's own pieces, one click from being elements of this film.
 *
 * One panel serves four sections of the rail: Text, Shapes, Motion and
 * Audio are each a slice of the same library, because a person looking
 * for a sound is not looking for a headline, and a filter row is a worse
 * answer to that than a place. Tiles: a preview on the film's ground and a
 * name. Hovering a tile shows a card with the piece at a readable size and
 * what it is for; clicking the tile adds it. The library is not the film's:
 * nothing here is placed or reviewed. Adding copies the piece into Elements
 * under its own id, and from then on it is the film's to change. The same
 * name added twice gets a number, the way a new layer does.
 */

export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

/** What a group is called where it is the only kind of thing on screen. */
const GROUP_LABELS: Record<LibraryGroup, string> = {
  Type: "Type",
  Shapes: "Shapes",
  Motion: "Motion",
  Sound: "Effects",
  Music: "Music",
};

export function LibraryPanel({
  file,
  title,
  hint,
  groups,
}: {
  file: ProjectFile;
  title: string;
  hint?: string;
  /** Which slices of the library this section shows; more than one gets a switch. */
  groups: readonly LibraryGroup[];
}) {
  const [group, setGroup] = useState<LibraryGroup>(groups[0] ?? "Type");
  const { hover, onHover, clear } = useHoverCard<LibraryItem>();

  const showing = groups.includes(group) ? group : (groups[0] ?? "Type");
  const items = LIBRARY.filter((item) => item.group === showing);

  return (
    <PanelShell title={title} {...(hint ? { hint } : {})}>
      {groups.length > 1 ? (
        <Chips
          label={`${title} kinds`}
          options={groups.map((name) => GROUP_LABELS[name])}
          value={GROUP_LABELS[showing]}
          onChange={(label) => {
            const next = groups.find((name) => GROUP_LABELS[name] === label);
            if (next) setGroup(next);
            // The tile under the pointer is about to change; its card must not stay.
            clear();
          }}
        />
      ) : null}

      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Tile key={item.id} item={item} file={file} onHover={onHover} />
        ))}
      </ul>

      {hover ? (
        <PieceCard
          draft={hover.item.draft}
          title={hover.item.name}
          detail={hover.item.blurb}
          top={hover.top}
          left={hover.left}
        />
      ) : null}
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

/** "Headline 2" when "Headline" is taken. */
function nextName(file: ProjectFile, stem: string): string {
  const taken = new Set(file.elements.map((element) => element.name));
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem} ${n}`)) n += 1;
  return `${stem} ${n}`;
}
