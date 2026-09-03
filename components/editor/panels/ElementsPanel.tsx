"use client";

import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import {
  createElement,
  deleteElement,
  importFiles,
  placeElementHere,
  removeAsset,
  select,
} from "@/lib/studio/actions";
import { elementUses } from "@/lib/studio/edits";
import { elementForFile } from "@/lib/studio/files";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { Element, ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";
import { Chips, PieceCard, Preview, useHoverCard } from "./PiecePreview";

/**
 * The film's elements.
 *
 * Everything this film is built from, as tiles like the studio's own, filtered
 * by what each is: the type styles, the shapes, the media, the sound. The
 * agent defines them at the style stage and builds by placing them; the
 * person reaches any of them here. Clicking a tile opens its properties;
 * the two things you do with an element, put it on the timeline and get
 * rid of it, sit on the tile. Deleting keeps the clips placed from it,
 * unlinked, and can be undone.
 *
 * Files in the project's `assets/` folder that no element refers to are
 * listed too, one click from becoming one: the agent may have put a
 * screenshot there with its file tools, or the person may have dropped one
 * in Finder, and either way it should not be invisible.
 */

type Group = "Type" | "Shapes" | "Media" | "Sound";
type Filter = "All" | Group;
const FILTERS: readonly Filter[] = ["All", "Type", "Shapes", "Media", "Sound"];

const GROUP_OF: Record<Element["kind"], Group> = {
  text: "Type",
  shape: "Shapes",
  icon: "Shapes",
  particles: "Shapes",
  image: "Media",
  video: "Media",
  device: "Media",
  html: "Media",
  audio: "Sound",
};

export function ElementsPanel({ file }: { file: ProjectFile }) {
  const selected = useStudioStore((state) => selectedIdOf(state.project, "element"));
  const files = useStudioStore((state) => state.assetFiles);
  const setNotice = useStudioStore((state) => state.setNotice);
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const { hover, onHover, clear } = useHoverCard<Element>();

  async function take(list: FileList | File[] | null) {
    const chosen = list ? [...list] : [];
    if (chosen.length === 0) return;
    const result = await importFiles(chosen);
    if (!result.ok) setNotice(result.message);
  }

  const shown = file.elements.filter(
    (element) => filter === "All" || GROUP_OF[element.kind] === filter,
  );
  const referenced = new Set(file.elements.flatMap((element) => ("src" in element ? [element.src] : [])));
  const loose = files.filter((path) => !referenced.has(path));

  return (
    <PanelShell
      title="Elements"
      action={
        <>
          <input
            ref={picker}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(event) => {
              void take(event.target.files);
              event.target.value = "";
            }}
          />
          <IconButton
            label="Add files: images, video or audio"
            size="sm"
            onClick={() => picker.current?.click()}
            icon={<FilePlus2 size={13} strokeWidth={2} aria-hidden />}
          />
        </>
      }
    >
      {/*
        The whole column takes a drop. Files land in the project's assets
        and become elements: the same thing the button does, without the
        picker.
      */}
      <div
        onDragOver={(event) => {
          if ([...event.dataTransfer.types].includes("Files")) {
            event.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void take(event.dataTransfer.files);
        }}
        className={`-mx-2 min-h-40 rounded-sm px-2 pb-6 transition-[box-shadow] duration-140 ${
          over ? "shadow-[inset_0_0_0_2px_var(--ds-color-accent)]" : ""
        }`}
      >
        {file.elements.length > 0 ? (
          <Chips
            label="Element kinds"
            options={FILTERS}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              clear();
            }}
          />
        ) : null}

        {file.elements.length === 0 && loose.length === 0 ? (
          <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
            Nothing yet. Your agent defines the look as elements at the style
            stage, add pieces from Text, Shapes, Motion or Audio, or drop an
            image, a video or a sound here.
          </p>
        ) : null}

        {file.elements.length > 0 && shown.length === 0 ? (
          <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
            Nothing of that kind yet.
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-2">
          {shown.map((element) => (
            <Tile
              key={element.id}
              element={element}
              file={file}
              selected={element.id === selected}
              onHover={onHover}
            />
          ))}
        </ul>

        {loose.length > 0 ? (
          <div className={file.elements.length > 0 ? "mt-4" : ""}>
            <PanelSection label="Files in assets">
              <ul className="flex flex-col gap-1">
                {loose.map((path) => (
                  <LooseFile key={path} path={path} onNotice={setNotice} />
                ))}
              </ul>
            </PanelSection>
          </div>
        ) : null}
      </div>

      {hover ? (
        <PieceCard
          draft={hover.item}
          title={hover.item.name}
          detail={describe(file, hover.item)}
          top={hover.top}
          left={hover.left}
        />
      ) : null}
    </PanelShell>
  );
}

/**
 * A file in `assets/` that nothing refers to: add it as an element, or
 * delete it. Deleting a file has no undo, so the first press asks and the
 * second does it; the question goes away on its own if left.
 */
function LooseFile({ path, onNotice }: { path: string; onNotice: (notice: string) => void }) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);

  async function remove() {
    if (!asking) {
      setAsking(true);
      return;
    }
    setAsking(false);
    const result = await removeAsset(path);
    onNotice(result.message);
  }

  return (
    <li className="flex items-center gap-1">
      <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted" title={path}>
        {path.replace(/^assets\//, "")}
      </span>
      {asking ? (
        <button
          type="button"
          onClick={() => void remove()}
          className="ds-focus flex h-6 shrink-0 items-center gap-1 rounded-xs bg-danger px-1.5 text-xs font-medium text-inverse"
        >
          Delete file?
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => createElement(elementForFile(path))}
            className="ds-focus flex h-6 shrink-0 items-center gap-1 rounded-xs px-1.5 text-xs font-medium text-accent hover:bg-sunken"
          >
            <Plus size={11} strokeWidth={2.6} aria-hidden />
            Add
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            aria-label={`Delete ${path}`}
            title="Delete the file"
            className="ds-focus grid size-6 shrink-0 place-items-center rounded-xs text-subtle hover:bg-sunken hover:text-danger"
          >
            <Trash2 size={12} strokeWidth={2} aria-hidden />
          </button>
        </>
      )}
    </li>
  );
}

/** "text · headline · placed 3×": what it is, what it is for, whether it is on the timeline. */
function describe(file: ProjectFile, element: Element): string {
  const uses = elementUses(file, element.id);
  return [
    element.kind,
    element.role,
    uses === 0 ? "not placed yet" : `placed ${uses}×`,
    "src" in element ? element.src : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Tile({
  element,
  file,
  selected,
  onHover,
}: {
  element: Element;
  file: ProjectFile;
  selected: boolean;
  onHover: (element: Element, rect: DOMRect | null) => void;
}) {
  const setNotice = useStudioStore((state) => state.setNotice);
  const uses = elementUses(file, element.id);

  // A tile that leaves the screen takes its card with it, even without a
  // pointerleave: filtering or deleting unmounts tiles under a still pointer.
  useEffect(() => () => onHover(element, null), [element, onHover]);

  function place() {
    const result = placeElementHere(element.id);
    if (!result.ok) setNotice(result.message);
  }

  function remove() {
    onHover(element, null);
    const result = deleteElement(element.id);
    setNotice(result.ok ? `${result.message} Undo with ⌘Z.` : result.message);
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => select(element.id)}
        onPointerEnter={(event) => onHover(element, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => onHover(element, null)}
        onFocus={(event) => onHover(element, event.currentTarget.getBoundingClientRect())}
        onBlur={() => onHover(element, null)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${element.name}: ${element.kind}, ${uses === 0 ? "not placed" : `placed ${uses} time${uses === 1 ? "" : "s"}`}`}
        className={`ds-focus flex w-full flex-col gap-1.5 rounded-sm p-1.5 text-left transition-[background-color,box-shadow] duration-140 ${
          selected
            ? "bg-sunken shadow-[inset_0_0_0_1.5px_var(--ds-color-accent)]"
            : "hover:bg-sunken"
        }`}
      >
        <Preview draft={element} />
        <span className="flex w-full flex-col px-0.5">
          <span className="truncate text-xs font-medium text-ink">{element.name}</span>
          <span className="truncate font-mono text-2xs text-subtle">
            {uses === 0 ? "not placed" : `placed ${uses}×`}
          </span>
        </span>
      </button>

      {/*
        The two things you do with an element, over the preview's corner
        while the tile is hovered or holds focus. Siblings of the tile's
        button, not children: a button cannot hold a button.
      */}
      <span className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 transition-opacity duration-140 group-hover:opacity-100 group-focus-within:opacity-100">
        <TileAction label={`Place ${element.name} at the playhead`} onClick={place}>
          <Plus size={11} strokeWidth={3} />
        </TileAction>
        <TileAction label={`Delete ${element.name}`} onClick={remove}>
          <Trash2 size={11} strokeWidth={2.4} />
        </TileAction>
      </span>
    </li>
  );
}

function TileAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="ds-focus grid size-6 place-items-center rounded-pill bg-[#F5F5F7] text-[#0A0A0C] shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-white"
    >
      {children}
    </button>
  );
}
