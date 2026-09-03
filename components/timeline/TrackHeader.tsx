"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { deleteTrack, patchTrack, select, shiftTrack } from "@/lib/studio/actions";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import type { Track } from "@/types/prism";

/**
 * The left column of one timeline row.
 *
 * Every control here is the layer's own state, not the app's: rename, hide,
 * lock, reorder, delete. That is the whole point of a layer panel — it is where
 * you manage the stack rather than its contents.
 *
 * Hide and mute are the same flag, shown with the icon that matches the track's
 * kind. They are the same intent — "this layer does not contribute right now" —
 * and giving them separate fields would let a visual track be muted, which
 * means nothing.
 */

type Props = {
  track: Track;
  /** False at the front of its group, so the arrow can be disabled honestly. */
  canMoveForward: boolean;
  canMoveBack: boolean;
};

export function TrackHeader({ track, canMoveForward, canMoveBack }: Props) {
  const selectedId = useStudioStore((state) => selectedIdOf(state.project, "track"));
  /** Null when nobody is editing. See the note on `Title` in TopBar.tsx. */
  const [draft, setDraft] = useState<string | null>(null);

  const selected = selectedId === track.id;
  const audio = track.kind === "audio";

  function commitRename() {
    const name = (draft ?? "").trim();
    setDraft(null);
    if (name && name !== track.name) patchTrack(track.id, { name });
  }

  return (
    <div
      onClick={() => select(track.id)}
      className={`flex h-full w-full flex-col justify-center gap-1 border-b border-line-soft px-2.5 py-1.5 transition-[background-color] duration-140 ${
        selected ? "bg-sunken" : "bg-surface hover:bg-sunken"
      }`}
    >
      <div className="flex items-center gap-1">
        {draft !== null ? (
          <input
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") setDraft(null);
            }}
            maxLength={40}
            aria-label="Layer name"
            className="ds-focus min-w-0 flex-1 rounded-xs bg-sunken px-1.5 py-0.5 text-xs text-ink shadow-[inset_0_0_0_1px_var(--ds-color-line)]"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setDraft(track.name)}
            onClick={() => select(track.id)}
            title="Double-click to rename"
            className={`ds-focus min-w-0 flex-1 truncate rounded-xs px-0.5 text-left text-xs font-medium ${
              track.hidden ? "text-subtle line-through" : "text-ink"
            }`}
          >
            {track.name}
          </button>
        )}

        <IconButton
          label={
            track.hidden
              ? audio
                ? "Unmute layer"
                : "Show layer"
              : audio
                ? "Mute layer"
                : "Hide layer"
          }
          onClick={() => patchTrack(track.id, { hidden: !track.hidden })}
          size="sm"
          icon={
            track.hidden ? (
              audio ? (
                <VolumeX size={13} strokeWidth={1.9} />
              ) : (
                <EyeOff size={13} strokeWidth={1.9} />
              )
            ) : audio ? (
              <Volume2 size={13} strokeWidth={1.9} />
            ) : (
              <Eye size={13} strokeWidth={1.9} />
            )
          }
        />

        <IconButton
          label={track.locked ? "Unlock layer" : "Lock layer"}
          onClick={() => patchTrack(track.id, { locked: !track.locked })}
          size="sm"
          icon={
            track.locked ? (
              <Lock size={13} strokeWidth={2} />
            ) : (
              <LockOpen size={13} strokeWidth={1.9} />
            )
          }
        />
      </div>

      <div className="flex items-center gap-0.5">
        <span className="mr-auto font-mono text-2xs text-subtle">
          {track.clips.length} clip{track.clips.length === 1 ? "" : "s"}
        </span>

        <IconButton
          label="Move layer forward"
          onClick={() => shiftTrack(track.id, -1)}
          disabled={!canMoveForward}
          size="sm"
          icon={<ChevronUp size={13} strokeWidth={2} />}
        />
        <IconButton
          label="Move layer back"
          onClick={() => shiftTrack(track.id, 1)}
          disabled={!canMoveBack}
          size="sm"
          icon={<ChevronDown size={13} strokeWidth={2} />}
        />
        <IconButton
          label="Delete layer"
          onClick={() => deleteTrack(track.id)}
          disabled={track.locked}
          size="sm"
          icon={<Trash2 size={13} strokeWidth={1.9} />}
        />
      </div>
    </div>
  );
}
