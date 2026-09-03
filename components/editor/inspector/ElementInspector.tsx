"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { deleteElement, patchElement, placeElementHere } from "@/lib/studio/actions";
import { elementUses } from "@/lib/studio/edits";
import { useStudioStore } from "@/lib/studio/store";
import { timecode } from "@/lib/studio/timing";
import type { Element, ProjectFile } from "@/types/prism";
import {
  AnimationFields,
  MotionFields,
  RevealFields,
  AudioFields,
  BoxFields,
  PictureFields,
  ShapeFields,
  TextFields,
  VideoFields,
} from "./clip-fields";
import { Heading } from "./fields";

/**
 * One element's properties.
 *
 * The same fields as the clip it becomes, minus the place — plus a name, and
 * the two things you do with an element: put it on the timeline, and get
 * rid of it. Every edit here reaches every clip placed from this element,
 * which is the whole reason it exists.
 */
export function ElementInspector({
  element,
  file,
}: {
  element: Element;
  file: ProjectFile;
}) {
  const playhead = useStudioStore((state) => state.playhead);
  // See ClipInspector: the field groups speak in slices; the action validates.
  const set = (patch: object) => patchElement(element.id, patch as Partial<Element>);
  const uses = elementUses(file, element.id);
  const audio = element.kind === "audio";
  const target = file.tracks.find((track) => (track.kind === "audio") === audio);

  return (
    <>
      <Heading
        title={element.name}
        detail={`${element.kind} element · ${uses === 0 ? "not placed yet" : `placed ${uses}×`}`}
      />

      <div className="mx-4 mb-4 flex shrink-0 flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => placeElementHere(element.id)}
          disabled={!target}
          icon={<Plus size={14} strokeWidth={2.4} aria-hidden />}
        >
          Place at {timecode(playhead / file.fps)}
          {target ? ` on ${target.name}` : ""}
        </Button>
        {uses > 0 ? (
          <p className="text-2xs leading-[var(--ds-leading-body)] text-subtle">
            Changes below reach all {uses} clip{uses === 1 ? "" : "s"} placed from it.
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
        <Field label="Name" htmlFor="element-name">
          <TextInput
            id="element-name"
            value={element.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </Field>
        <Field label="Role" htmlFor="element-role">
          <TextInput
            id="element-role"
            value={element.role ?? ""}
            onChange={(event) => set({ role: event.target.value })}
            placeholder="type, device, motif, product, sound"
          />
        </Field>

        {element.kind === "text" ? <TextFields value={element} set={set} words="optional" /> : null}
        {element.kind === "text" ? <RevealFields value={element} set={set} /> : null}
        {element.kind === "shape" ? <ShapeFields value={element} set={set} /> : null}
        {element.kind === "image" || element.kind === "video" ? (
          <PictureFields value={element} set={set} />
        ) : null}
        {element.kind === "video" ? <VideoFields value={element} set={set} /> : null}
        {element.kind === "audio" ? <AudioFields value={element} set={set} /> : null}

        {"box" in element ? <BoxFields box={element.box} set={(box) => set({ box })} /> : null}
        {"animation" in element ? (
          <AnimationFields animation={element.animation} set={(animation) => set({ animation })} />
        ) : null}
        {"motion" in element ? (
          <MotionFields motion={element.motion} set={(motion) => set({ motion })} />
        ) : null}

        <Button
          variant="quiet"
          className="mt-2 self-start"
          onClick={() => deleteElement(element.id)}
          icon={<Trash2 size={13} strokeWidth={2} aria-hidden />}
        >
          {uses > 0 ? `Delete element, keep its ${uses} clip${uses === 1 ? "" : "s"}` : "Delete element"}
        </Button>
      </div>
    </>
  );
}
