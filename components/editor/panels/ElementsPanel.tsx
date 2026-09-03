"use client";

import {
  AudioLines,
  FilePlus2,
  Image as ImageIcon,
  Plus,
  Video as VideoIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { createElement, importFiles, select } from "@/lib/studio/actions";
import { elementUses } from "@/lib/studio/edits";
import { elementForFile } from "@/lib/studio/files";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { Element, ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

/**
 * The film's elements.
 *
 * Everything this film is built from, grouped by what it is: the type
 * styles, the shapes, the media. The agent defines them at the style stage
 * and builds by placing them; the person reaches any of them here. New ones
 * come from the Library. The style stage's decision lives in the process,
 * not here: this column is for seeing the pieces.
 *
 * Files in the project's `assets/` folder that no element refers to are
 * listed too, one click from becoming one: the agent may have put a
 * screenshot there with its file tools, or the person may have dropped one
 * in Finder, and either way it should not be invisible.
 */
export function ElementsPanel({ file }: { file: ProjectFile }) {
  const selected = useStudioStore((state) => selectedIdOf(state.project, "element"));
  const files = useStudioStore((state) => state.assetFiles);
  const setNotice = useStudioStore((state) => state.setNotice);
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function take(list: FileList | File[] | null) {
    const chosen = list ? [...list] : [];
    if (chosen.length === 0) return;
    const result = await importFiles(chosen);
    if (!result.ok) setNotice(result.message);
  }

  const type = file.elements.filter((element) => element.kind === "text");
  const shapes = file.elements.filter((element) => element.kind === "shape");
  const media = file.elements.filter(
    (element) => element.kind === "image" || element.kind === "video" || element.kind === "audio",
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
      {file.elements.length === 0 && loose.length === 0 ? (
        <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
          Nothing yet. Your agent defines the look as elements at the style
          stage, add pieces from the Library, or drop an image, a video or a
          sound here.
        </p>
      ) : null}

      <Group label="Type" elements={type} file={file} selected={selected} />
      <Group label="Shapes" elements={shapes} file={file} selected={selected} />
      <Group label="Media" elements={media} file={file} selected={selected} />

      {loose.length > 0 ? (
        <PanelSection label="Files in assets">
          <ul className="flex flex-col gap-1">
            {loose.map((path) => (
              <li key={path} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted">
                  {path.replace(/^assets\//, "")}
                </span>
                <button
                  type="button"
                  onClick={() => createElement(elementForFile(path))}
                  className="ds-focus flex h-6 shrink-0 items-center gap-1 rounded-xs px-1.5 text-xs font-medium text-accent hover:bg-sunken"
                >
                  <Plus size={11} strokeWidth={2.6} aria-hidden />
                  Add
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}
      </div>
    </PanelShell>
  );
}

function Group({
  label,
  elements,
  file,
  selected,
}: {
  label: string;
  elements: Element[];
  file: ProjectFile;
  selected: string | null;
}) {
  if (elements.length === 0) return null;
  return (
    <PanelSection label={label}>
      <ul className="flex flex-col gap-1">
        {elements.map((element) => {
          const uses = elementUses(file, element.id);
          const isSelected = element.id === selected;
          return (
            <li key={element.id}>
              <button
                type="button"
                onClick={() => select(element.id)}
                aria-current={isSelected ? "true" : undefined}
                className={`ds-focus flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-[background-color] duration-140 ${
                  isSelected ? "bg-sunken" : "hover:bg-sunken"
                }`}
              >
                <Swatch element={element} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">
                    {element.name}
                  </span>
                  <span className="block truncate font-mono text-2xs text-subtle">
                    {element.role ? `${element.role} · ` : ""}
                    {uses === 0 ? "not placed" : `placed ${uses}×`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}

const FAMILY: Record<"display" | "body" | "mono", string> = {
  display: "var(--film-display), Georgia, serif",
  body: "var(--ds-font-sans)",
  mono: "var(--ds-font-mono)",
};

/**
 * A thumbnail of the element, on the film's own dark ground: type shows its
 * face and colour, a shape its fill and form, media its kind.
 */
function Swatch({ element }: { element: Element }) {
  return (
    <span
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-xs bg-[#0A0A0C] shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)]"
      aria-hidden
    >
      {element.kind === "text" ? (
        <span
          className="text-base leading-none"
          style={{
            fontFamily: FAMILY[element.fontFamily],
            fontWeight: element.fontWeight,
            color: element.color,
          }}
        >
          Aa
        </span>
      ) : element.kind === "shape" ? (
        <span
          className="block size-4"
          style={{
            background: element.fill,
            borderRadius: element.shape === "ellipse" ? "999px" : `${element.radius * 16}px`,
          }}
        />
      ) : element.kind === "image" ? (
        <ImageIcon size={14} strokeWidth={1.8} className="text-[#F5F5F7]/70" />
      ) : element.kind === "video" ? (
        <VideoIcon size={14} strokeWidth={1.8} className="text-[#F5F5F7]/70" />
      ) : (
        <AudioLines size={14} strokeWidth={1.8} className="text-[#F5F5F7]/70" />
      )}
    </span>
  );
}
