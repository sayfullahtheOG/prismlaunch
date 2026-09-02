"use client";

import { Layers, Music, Type } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClip, createTrack, select } from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";
import { splitTracks } from "@/components/timeline/geometry";
import type { Clip, ProjectFile } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

/**
 * The stack, as a list.
 *
 * The timeline already shows layers, so this is not a second copy of it: the
 * timeline is about *when*, this is about *what is on top of what*. It reads
 * strictly front to back with the background in the middle, which is the one
 * question the timeline answers only implicitly through row order.
 *
 * Adding a clip from here drops it at the playhead, because that is where the
 * person is looking.
 */
export function LayersPanel({ file }: { file: ProjectFile }) {
  const playhead = useStudioStore((state) => state.playhead);
  const selectedId = useStudioStore((state) => state.project?.selectedId ?? null);
  const { visual, audio } = splitTracks(file);

  function addText() {
    const track = visual[0];
    if (!track) return;
    createClip(track.id, {
      kind: "text",
      from: playhead,
      durationInFrames: file.fps * 2,
      approval: "accepted",
      text: "Double-click to edit",
      fontSize: 0.09,
      fontFamily: "display",
      fontWeight: 600,
      color: "#F7F8F8",
      align: "center",
      lineHeight: 1.1,
      letterSpacing: -0.02,
      box: { x: 0.5, y: 0.5, width: 0.8, height: 0.2, rotation: 0, opacity: 1 },
      animation: { enter: "fade", exit: "fade", enterFrames: 10, exitFrames: 10 },
    } as Omit<Clip, "id">);
  }

  return (
    <PanelShell
      title="Layers"
      hint="Front to back. Everything above the background is in the picture; everything below it is sound."
    >
      <PanelSection label="Add">
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={addText}
            disabled={visual.length === 0}
            icon={<Type size={14} strokeWidth={1.9} aria-hidden />}
          >
            Add text at playhead
          </Button>
          <Button
            variant="quiet"
            onClick={() => createTrack("visual")}
            icon={<Layers size={14} strokeWidth={1.9} aria-hidden />}
          >
            New visual layer
          </Button>
          <Button
            variant="quiet"
            onClick={() => createTrack("audio")}
            icon={<Music size={14} strokeWidth={1.9} aria-hidden />}
          >
            New audio layer
          </Button>
        </div>
      </PanelSection>

      <PanelSection label={`Visual (${visual.length})`}>
        <Stack tracks={visual} selectedId={selectedId} />
      </PanelSection>

      <PanelSection label="Ground">
        <div className="ds-inset flex items-center gap-2.5 rounded-sm bg-sunken p-2.5">
          <span
            className="size-6 shrink-0 rounded-xs"
            style={{
              background:
                file.background.kind === "solid"
                  ? file.background.color
                  : `linear-gradient(${file.background.angle}deg, ${file.background.from}, ${file.background.to})`,
            }}
            aria-hidden
          />
          <span className="text-xs font-semibold text-ink">Background</span>
          <span className="ml-auto font-mono text-2xs text-subtle">
            {file.background.kind}
          </span>
        </div>
      </PanelSection>

      <PanelSection label={`Audio (${audio.length})`}>
        <Stack tracks={audio} selectedId={selectedId} />
      </PanelSection>
    </PanelShell>
  );
}

function Stack({
  tracks,
  selectedId,
}: {
  tracks: ProjectFile["tracks"];
  selectedId: string | null;
}) {
  if (tracks.length === 0) {
    return (
      <p className="ds-inset rounded-sm bg-sunken p-2.5 text-2xs text-subtle">
        None yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tracks.map((track) => (
        <li key={track.id}>
          <button
            type="button"
            onClick={() => select(track.id)}
            aria-current={selectedId === track.id ? "true" : undefined}
            className={`ds-focus flex w-full items-center gap-2 rounded-sm p-2.5 text-left ${
              selectedId === track.id
                ? "ds-inset bg-sunken"
                : "ds-raised bg-raised hover:bg-strong"
            }`}
          >
            <span
              className={`truncate text-xs font-semibold ${
                track.hidden ? "text-subtle line-through" : "text-ink"
              }`}
            >
              {track.name}
            </span>
            <span className="ml-auto shrink-0 font-mono text-2xs text-subtle">
              {track.clips.length}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
