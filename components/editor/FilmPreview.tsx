"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";
import { FPS } from "@/lib/studio/schema";
import { elapsedThrough, totalFrames } from "@/lib/studio/timing";
import { LaunchFilm } from "@/remotion/LaunchFilm";
import type { ArtDirection, Scene, SceneId } from "@/types/prism";

type Props = {
  scenes: Scene[];
  artDirection: ArtDirection;
  /** Which scene the editor is focused on. */
  activeSceneId: SceneId;
  /** Bumped by actions to replay from the start of the active scene. */
  playToken: number;
};

/**
 * The in-browser preview.
 *
 * Mounts the *same* `LaunchFilm` component the server renderer does, with the
 * same props, so preview and export cannot drift. Editing a headline updates
 * the graph, the Player re-renders from it, and the exported MP4 shows the
 * same frames.
 */
export function FilmPreview({
  scenes,
  artDirection,
  activeSceneId,
  playToken,
}: Props) {
  const player = useRef<PlayerRef>(null);
  const duration = totalFrames(scenes);

  // Seek to the start of the focused scene and play. Runs on playToken so the
  // action layer decides when playback restarts — the Player is a view, and
  // nothing here reaches back into the store.
  useEffect(() => {
    const current = player.current;
    if (!current) return;

    const endOfScene = elapsedThrough(scenes, activeSceneId) * FPS;
    const scene = scenes.find((s) => s.id === activeSceneId);
    const start = Math.max(0, Math.round(endOfScene - (scene?.durationFrames ?? 0)));

    current.seekTo(start);
    current.play();
  }, [playToken, activeSceneId, scenes]);

  return (
    <Player
      ref={player}
      component={LaunchFilm}
      inputProps={{ scenes, artDirection }}
      durationInFrames={duration}
      fps={FPS}
      compositionWidth={960}
      compositionHeight={540}
      style={{ width: "100%", height: "100%" }}
      acknowledgeRemotionLicense
    />
  );
}
