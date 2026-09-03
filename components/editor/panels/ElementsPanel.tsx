"use client";

import {
  AudioLines,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Square,
  Type,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createElement, select } from "@/lib/studio/actions";
import { elementUses } from "@/lib/studio/edits";
import { DEFAULT_ANIMATION, DEFAULT_BOX } from "@/lib/studio/schema";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { Element, ElementDraft, ElementKind, ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";
import { StageDecision, StageStatusChip } from "./StageDecision";

/**
 * The library.
 *
 * Everything the film is built from, grouped by what it is: the type
 * styles, the shapes, the media. Your agent defines these at the style stage
 * — the method's "a style frame must settle the ground, the ink, the accent,
 * the one family that owns headlines…" — and builds by placing them. This
 * column is where a person reads that look as a list, approves it, and
 * reaches any piece of it.
 *
 * Files in the project's `assets/` folder that no element refers to are
 * listed too, one click from becoming one: the agent may have put a
 * screenshot there with its file tools, or the person may have dropped one
 * in Finder, and either way it should not be invisible.
 */
export function ElementsPanel({ file }: { file: ProjectFile }) {
  const process = file.process;
  const selected = useStudioStore((state) => selectedIdOf(state.project, "element"));
  const files = useStudioStore((state) => state.assetFiles);

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
      hint="The pieces the film is made of. Your agent defines the look here at the style stage, then builds by placing them."
    >
      <PanelSection label="Style frames">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <StageStatusChip status={process.style.status} />
            {process.style.look ? (
              <span className="font-mono text-2xs text-subtle capitalize">{process.style.look}</span>
            ) : null}
          </div>
          {process.style.summary ? (
            <p className="flex items-start gap-2 text-xs leading-[var(--ds-leading-body)] text-muted">
              <Sparkles size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Agent: </span>
                {process.style.summary}
              </span>
            </p>
          ) : null}
          {process.style.clipIds.length > 0 ? (
            <p className="text-2xs text-subtle">
              {process.style.clipIds.length} frame{process.style.clipIds.length === 1 ? "" : "s"} built
              for real. Select them in the timeline to review them.
            </p>
          ) : null}
          {process.style.note ? (
            <p className="text-xs leading-[var(--ds-leading-body)] text-warning">
              <span className="font-medium">You said: </span>
              {process.style.note}
            </p>
          ) : null}
          <StageDecision stage="style" state={process.style} process={process} />
        </div>
      </PanelSection>

      {file.elements.length === 0 && loose.length === 0 ? (
        <p className="border-t border-line-soft py-4 text-xs leading-[var(--ds-leading-body)] text-subtle">
          Nothing yet. Once the animatic is approved, your agent defines the
          look as elements (the type roles, the accent, the device, the
          product shot) and places them to build the film.
        </p>
      ) : null}

      <Group label="Type" elements={type} file={file} selected={selected} />
      <Group label="Shapes" elements={shapes} file={file} selected={selected} />
      <Group label="Media" elements={media} file={file} selected={selected} />

      {loose.length > 0 ? (
        <PanelSection label="Files in assets/">
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

      <PanelSection label="Add">
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => createElement(blankElement("text", nextName(file, "Style")))}
            icon={<Type size={12} strokeWidth={2} aria-hidden />}
          >
            Type style
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => createElement(blankElement("shape", nextName(file, "Shape")))}
            icon={<Square size={12} strokeWidth={2} aria-hidden />}
          >
            Shape
          </Button>
        </div>
      </PanelSection>
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

/** "Style 2" when "Style" and "Style 1" are taken. */
function nextName(file: ProjectFile, stem: string): string {
  const taken = new Set(file.elements.map((element) => element.name));
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem} ${n}`)) n += 1;
  return `${stem} ${n}`;
}

function blankElement(kind: "text" | "shape", name: string): ElementDraft {
  const visual = { box: { ...DEFAULT_BOX }, animation: { ...DEFAULT_ANIMATION } };
  if (kind === "text") {
    return {
      kind: "text",
      name,
      fontSize: 0.09,
      fontFamily: "display",
      fontWeight: 400,
      color: "#F5F5F7",
      align: "center",
      lineHeight: 1.1,
      letterSpacing: -0.02,
      ...visual,
    };
  }
  return { kind: "shape", name, shape: "rect", fill: "#F5F5F7", radius: 0, ...visual };
}

/** A media element for a file in `assets/`, by extension. */
function elementForFile(path: string): ElementDraft {
  const name = (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
  const kind = kindForPath(path);
  const visual = { box: { ...DEFAULT_BOX, width: 0.8, height: 0.45 }, animation: { ...DEFAULT_ANIMATION } };
  if (kind === "audio") {
    return { kind, name, src: path, startFrom: 0, volume: 1, fadeInFrames: 0, fadeOutFrames: 0, playbackRate: 1 };
  }
  if (kind === "video") {
    return { kind, name, src: path, fit: "cover", radius: 0, startFrom: 0, volume: 0, playbackRate: 1, ...visual };
  }
  return { kind: "image", name, src: path, fit: "cover", radius: 0, ...visual };
}

function kindForPath(path: string): Extract<ElementKind, "image" | "video" | "audio"> {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  return "image";
}
