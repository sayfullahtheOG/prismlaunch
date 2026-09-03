"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { memo, useEffect, useMemo, useRef } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { Film } from "@/remotion/Film";
import type { ProjectFile } from "@/types/prism";

/**
 * The in-browser preview.
 *
 * Mounts the *same* `Film` component the WebCodecs renderer does, with the same
 * props, so preview and export cannot drift. Moving a clip updates the file,
 * the Player re-renders from it, and the exported MP4 shows the same frames.
 *
 * Playhead sync goes both ways, which is the fiddly part. The store is the
 * source of truth — the timeline scrubs it, and a WebMCP `prism.seek` moves it
 * — but the Player advances its own frame while playing, and that has to come
 * back or the playhead would sit still through playback. The guard below is
 * what stops those two chasing each other in a loop.
 */
export const FilmPreview = memo(function FilmPreview({ file }: { file: ProjectFile }) {
  const player = useRef<PlayerRef>(null);
  const playing = useStudioStore((state) => state.playing);
  const assets = useStudioStore((state) => state.assets);
  const inputProps = useMemo(() => ({ file, assets }), [file, assets]);

  /** The last frame we heard from the Player, so we do not seek it back there. */
  const fromPlayer = useRef(-1);

  useEffect(() => {
    const current = player.current;
    if (!current) return;

    const onFrame = (event: { detail: { frame: number } }) => {
      fromPlayer.current = event.detail.frame;
      useStudioStore.getState().setPlayhead(event.detail.frame);
    };
    const onPause = () => useStudioStore.getState().setPlaying(false);
    const onEnded = () => useStudioStore.getState().setPlaying(false);

    current.addEventListener("frameupdate", onFrame);
    current.addEventListener("pause", onPause);
    current.addEventListener("ended", onEnded);

    current.seekTo(useStudioStore.getState().playhead);
    // Subscribe without rendering the entire composition on every frame.
    // Handle an external seek synchronously, so a newer Player frame cannot
    // turn a delayed React effect into a seek backwards during playback.
    const unsubscribe = useStudioStore.subscribe((state, previous) => {
      if (state.playhead !== previous.playhead && state.playhead !== fromPlayer.current) {
        current.seekTo(state.playhead);
      }
    });

    return () => {
      current.removeEventListener("frameupdate", onFrame);
      current.removeEventListener("pause", onPause);
      current.removeEventListener("ended", onEnded);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const current = player.current;
    if (!current) return;
    if (playing) current.play();
    else current.pause();
  }, [playing]);

  return (
    <Player
      ref={player}
      component={Film}
      inputProps={inputProps}
      durationInFrames={file.durationInFrames}
      fps={file.fps}
      compositionWidth={file.width}
      compositionHeight={file.height}
      style={{ width: "100%", height: "100%" }}
      acknowledgeRemotionLicense
    />
  );
});
