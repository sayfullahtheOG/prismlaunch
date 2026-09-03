"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Grid2X2, Pause, Play, Sparkles } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StoryboardScene } from "@/components/storyboard/StoryboardScene";
import { currentStage, STAGE_LABELS } from "@/lib/studio/process";
import { useStudioStore } from "@/lib/studio/store";
import type { ProjectFile, StoryboardPanel } from "@/types/prism";
import { StageDecision } from "./panels/StageDecision";

/** One read-only preview per shot, with playback local to that board. */
export function StoryboardBoard({ file }: { file: ProjectFile }) {
  const panels = file.process.storyboard.panels;
  const assets = useStudioStore((state) => state.assets);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const missing = panels.filter((panel) => !panel.visual).length;

  if (!panels.length) return <EmptyBoard file={file} />;

  return (
    <section aria-label="Storyboard" className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {missing ? <p role="status" className="mx-5 mt-4 rounded-sm bg-warning-soft px-3 py-2 text-xs text-warning">{missing} {missing === 1 ? "shot needs" : "shots need"} a visual layout. These older boards contain notes only. Ask your agent to redraw them.</p> : null}
        <ol aria-label="Storyboard shots" className="grid content-start gap-x-5 gap-y-7 p-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
          {panels.map((panel, index) => (
            <Board key={panel.id} panel={panel} index={index} file={file} assets={assets}
              playing={playingId === panel.id}
              onPlay={(playing) => setPlayingId(playing ? panel.id : null)} />
          ))}
        </ol>
      </div>

      <footer className="max-h-[32%] shrink-0 overflow-y-auto border-t border-line-soft bg-canvas px-5 py-3">
        <div className="mx-auto flex max-w-[800px] flex-col gap-2">
          {file.process.storyboard.summary ? <p className="flex items-start gap-2 text-xs leading-relaxed text-muted"><Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span><span className="font-medium text-ink">Your agent: </span>{file.process.storyboard.summary}</span></p> : null}
          {file.process.storyboard.note ? <p className="text-xs leading-relaxed text-warning"><span className="font-medium">You said: </span>{file.process.storyboard.note}</p> : null}
          <StageDecision stage="storyboard" state={file.process.storyboard} process={file.process} />
        </div>
      </footer>
    </section>
  );
}

function Board({ panel, index, file, assets, playing, onPlay }: {
  panel: StoryboardPanel; index: number; file: ProjectFile; assets: Readonly<Record<string, string>>;
  playing: boolean; onPlay: (playing: boolean) => void;
}) {
  const length = panel.durationInFrames;
  const [frame, setFrame] = useState(() => Math.floor((length - 1) / 2));
  const playFrame = useRef(0);
  // Keep the animation local: the other boards do not rerender on every tick.
  useEffect(() => {
    if (!playing) return;
    const startFrame = Math.min(playFrame.current, length - 1);
    const start = performance.now();
    let request = 0;
    function tick(now: number) {
      const next = Math.min(length - 1, startFrame + Math.floor((now - start) * file.fps / 1000));
      playFrame.current = next;
      setFrame(next);
      if (next < length - 1) request = requestAnimationFrame(tick);
      else onPlay(false);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, length, file.fps, onPlay]);

  const localFrame = Math.min(frame, length - 1);
  const atEnd = localFrame === length - 1;
  const isPlaying = playing && !atEnd;
  function togglePlay() {
    if (isPlaying) { onPlay(false); return; }
    if (atEnd) playFrame.current = 0;
    setFrame(playFrame.current);
    onPlay(true);
  }

  return (
    <li className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-xs font-medium text-ink"><span className="mr-2 font-mono text-muted">{String(index + 1).padStart(2, "0")}</span>{panel.label}</h3>
        <span className="shrink-0 font-mono text-2xs text-muted">{(length / file.fps).toFixed(1)}s</span>
      </div>
      <div>
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-sm border border-line-soft">
            <Frame panel={panel} frame={localFrame} file={file} assets={assets} />
            {panel.visual ? <IconButton tone="raised" className="absolute right-2 bottom-2" label={`${isPlaying ? "Pause" : "Play"} shot ${index + 1}: ${panel.label}`} icon={isPlaying ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} onClick={togglePlay} /> : null}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            {panel.handoff ? <p className="flex min-w-0 gap-2 text-xs leading-relaxed text-muted"><ArrowRight size={13} className="mt-0.5 shrink-0" aria-hidden /><span className="line-clamp-2">{panel.handoff}</span></p> : <span />}
          </div>

        </div>
      </div>
    </li>
  );
}

function Frame({ panel, frame, file, assets }: { panel: StoryboardPanel; frame: number; file: ProjectFile; assets: Readonly<Record<string, string>> }) {
  return <div style={{ aspectRatio: `${file.width} / ${file.height}` }} className="w-full overflow-hidden bg-sunken">
    {panel.visual ? <StoryboardScene visual={panel.visual} frame={frame} width={file.width} height={file.height} assets={assets} label={`${panel.label}, frame ${frame}`} /> : <div className="flex h-full items-center justify-center p-5 text-center"><div><Grid2X2 size={22} className="mx-auto mb-2 text-subtle" aria-hidden /><p className="text-xs font-medium text-muted">Visual layout needed</p><p className="mt-1 text-2xs text-muted">Ask your agent to draw the composition</p></div></div>}
  </div>;
}

function EmptyBoard({ file }: { file: ProjectFile }) {
  const stage = currentStage(file.process);
  const before = stage === "brief" || stage === "concept" || stage === "script";
  return <section aria-label="Storyboard" className="flex min-h-0 flex-1 flex-col bg-canvas"><div className="flex flex-1 items-center justify-center p-6"><div className="max-w-[360px] text-center"><Grid2X2 size={26} className="mx-auto mb-3 text-muted" aria-hidden /><p className="text-sm font-medium text-ink">See the shots before you build them</p><p className="mt-2 text-xs leading-relaxed text-muted">{before && stage ? `Your agent draws the storyboard once the script is approved. The process is at ${STAGE_LABELS[stage]}.` : "Your agent draws each shot with visual layers, images and movement. Play each board here to review it."}</p></div></div></section>;
}
