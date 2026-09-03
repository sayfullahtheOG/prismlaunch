"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Grid2X2, Lock, Pause, Pencil, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StoryboardScene } from "@/components/storyboard/StoryboardScene";
import { BoardComposer } from "@/components/storyboard/BoardComposer";
import { select } from "@/lib/studio/actions";
import { currentStage, STAGE_LABELS, timingLocked } from "@/lib/studio/process";
import { boardAtFrame, boardMoments, boardStarts } from "@/lib/studio/storyboard";
import { selectedIdOf } from "@/lib/studio/selection";
import { useStudioStore } from "@/lib/studio/store";
import { timecode } from "@/lib/studio/timing";
import type { ProjectFile, StoryboardPanel } from "@/types/prism";
import { StageDecision } from "./panels/StageDecision";
import { ReviewBar } from "./ReviewBar";

/** A visual contact sheet, an exact-frame shot viewer, and a rough cut player. */
export function StoryboardBoard({ file }: { file: ProjectFile }) {
  const panels = file.process.storyboard.panels;
  const selected = useStudioStore((state) => selectedIdOf(state.project, "panel"));
  const assets = useStudioStore((state) => state.assets);
  const [view, setView] = useState<"sheet" | "shot" | "sequence">("sheet");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const playFrame = useRef(0);
  const selectedIndex = Math.max(0, panels.findIndex((panel) => panel.id === selected));
  const total = panels.reduce((sum, panel) => sum + panel.durationInFrames, 0);
  const starts = boardStarts(panels);
  const active = view === "sequence" ? boardAtFrame(panels, frame) : panels[selectedIndex] ? { panel: panels[selectedIndex]!, index: selectedIndex, from: starts[selectedIndex]!, localFrame: Math.min(frame, panels[selectedIndex]!.durationInFrames - 1) } : null;
  const length = view === "sequence" ? total : active?.panel.durationInFrames ?? 1;
  const missing = panels.filter((panel) => !panel.visual).length;

  function seek(next: number) {
    setPlaying(false);
    setFrame(next);
    playFrame.current = next;
  }
  function open(index: number) {
    const panel = panels[index];
    if (!panel) return;
    select(panel.id);
    setView("shot");
    seek(0);
  }
  // Explicit playback uses film fps and never mutates the real timeline.
  useEffect(() => {
    if (!playing || view === "sheet") return;
    const startFrame = playFrame.current;
    const start = performance.now();
    let request = 0;
    function tick(now: number) {
      const next = Math.min(length - 1, startFrame + Math.floor((now - start) * file.fps / 1000));
      playFrame.current = next;
      setFrame(next);
      if (next >= length - 1) setPlaying(false);
      else request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, view, length, file.fps]);

  if (!panels.length) return <EmptyBoard file={file} />;

  return (
    <section aria-label="Storyboard" className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <ReviewBar>
        <h2 className="truncate text-xs font-medium text-ink">{file.name}</h2>
        <span className="shrink-0 font-mono text-2xs text-muted">{panels.length} shots · {timecode(total / file.fps)}</span>
        {timingLocked(file.process) ? <Lock size={12} aria-label="Timing locked" /> : null}
      </ReviewBar>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
        <div><h3 className="text-sm font-medium text-ink">See the film take shape</h3><p className="mt-0.5 text-xs text-muted">Composition and movement · rough visuals, before the final look</p></div>
        <div className="flex gap-2">
          <Button aria-pressed={view === "sheet"} variant={view === "sheet" ? "primary" : "quiet"} onClick={() => { setView("sheet"); seek(0); }} icon={<Grid2X2 size={13} aria-hidden />}>Contact sheet</Button>
          <Button onClick={() => { setView("sequence"); setEditing(false); seek(0); setPlaying(true); }} icon={<Play size={13} aria-hidden />}>Play sequence</Button>
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {missing ? <p role="status" className="mx-5 mt-4 rounded-sm bg-warning-soft px-3 py-2 text-xs text-warning">{missing} {missing === 1 ? "shot needs" : "shots need"} a visual layout. These older boards contain notes only. Open a shot to add visuals, or ask your agent to redraw them.</p> : null}
        {view === "sheet" ? (
          <ol className="grid content-start gap-x-5 gap-y-7 p-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
            {panels.map((panel, index) => (
              <li key={panel.id}>
                <button type="button" aria-label={`Open shot ${index + 1}: ${panel.label}`} className="ds-focus group w-full rounded-sm text-left" onClick={() => open(index)}>
                  <div className="mb-2 flex items-baseline justify-between gap-3"><span className="text-xs font-medium text-ink"><span className="mr-2 font-mono text-muted">{String(index + 1).padStart(2, "0")}</span>{panel.label}</span><span className="shrink-0 font-mono text-2xs text-muted">{(panel.durationInFrames / file.fps).toFixed(1)}s</span></div>
                  <div className="overflow-hidden rounded-sm border border-line-soft group-hover:border-line">
                    <Frame panel={panel} frame={Math.floor((panel.durationInFrames - 1) * .5)} file={file} assets={assets} />
                    <div className="grid grid-cols-2 border-t border-line-soft">
                      <div className="border-r border-line-soft"><Frame panel={panel} frame={0} file={file} assets={assets} /><p className="bg-surface px-2 py-1 font-mono text-2xs text-muted">In · {timecode(starts[index]! / file.fps)}</p></div>
                      <div><Frame panel={panel} frame={panel.durationInFrames - 1} file={file} assets={assets} /><p className="bg-surface px-2 py-1 font-mono text-2xs text-muted">Out · {timecode((starts[index]! + panel.durationInFrames) / file.fps)}</p></div>
                    </div>
                  </div>
                  {panel.handoff ? <p className="mt-2 flex gap-2 text-xs leading-relaxed text-muted"><ArrowRight size={13} className="mt-0.5 shrink-0" aria-hidden /><span className="line-clamp-2">{panel.handoff}</span></p> : null}
                </button>
              </li>
            ))}
          </ol>
        ) : active ? (
          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant="quiet" size="sm" disabled={active.index === 0} onClick={() => open(active.index - 1)} aria-label="Previous shot" icon={<ArrowLeft size={14} aria-hidden />} />
              <h3 className="min-w-0 flex-1 text-sm font-medium text-ink">{String(active.index + 1).padStart(2, "0")} / {panels.length} · {active.panel.label}</h3>
              <Button variant="quiet" size="sm" disabled={active.index === panels.length - 1} onClick={() => open(active.index + 1)} aria-label="Next shot" icon={<ArrowRight size={14} aria-hidden />} />
              <Button size="sm" aria-pressed={editing} onClick={() => { open(active.index); setEditing(!editing); }} icon={<Pencil size={12} aria-hidden />}>{editing ? "Close layout editor" : "Edit layout"}</Button>
            </div>
            <div className={editing ? "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]" : "mx-auto max-w-[1000px]"}>
              <div className="min-w-0">
                <div className="overflow-hidden rounded-sm border border-line-soft"><Frame panel={active.panel} frame={active.localFrame} file={file} assets={assets} constrained /></div>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="primary" aria-label={playing ? "Pause boards" : "Play boards"} onClick={() => { if (frame >= length - 1) { setFrame(0); playFrame.current = 0; } setPlaying(!playing); }} icon={playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} />
                  <input className="ds-focus min-w-0 flex-1 accent-[var(--ds-color-accent)]" aria-label={view === "sequence" ? "Sequence frame" : "Shot frame"} type="range" min={0} max={length - 1} value={Math.min(frame, length - 1)} onChange={(event) => seek(Number(event.target.value))} />
                  <span className="min-w-24 text-right font-mono text-2xs text-muted">f{active.localFrame} · {timecode((view === "sequence" ? frame : active.from + frame) / file.fps)}</span>
                </div>
                {view === "shot" ? <div className="mt-2 flex flex-wrap gap-1" aria-label="Shot moments">{boardMoments(active.panel).map((moment) => <Button key={moment} size="sm" variant={active.localFrame === moment ? "secondary" : "quiet"} onClick={() => seek(moment)}>{moment === 0 ? "Opening" : moment === active.panel.durationInFrames - 1 ? "Closing" : `f${moment}`}</Button>)}</div> : <p className="mt-2 text-xs text-muted">Rough sequence · {timecode(total / file.fps)} · sound is planned below and added at the animatic</p>}
                <dl className="mt-5 grid gap-3 border-t border-line-soft pt-4 text-xs leading-relaxed">
                  {[ ["In the frame", active.panel.frame], ["Action", active.panel.action], ["Into the next shot", active.panel.handoff], ["Sound", active.panel.sound] ].map(([title, text]) => text ? <div key={title} className="grid gap-1 sm:grid-cols-[120px_1fr]"><dt className="font-medium text-ink">{title}</dt><dd className="max-w-[70ch] text-muted">{text}</dd></div> : null)}
                </dl>
              </div>
              {editing ? <BoardComposer key={active.panel.id} panel={active.panel} frame={active.localFrame} seek={seek} file={file} /> : null}
            </div>
            <nav aria-label="Storyboard shots" className="mt-6 flex gap-3 overflow-x-auto border-t border-line-soft pt-4">
              {panels.map((panel, index) => <button key={panel.id} type="button" aria-label={`Go to shot ${index + 1}`} aria-current={index === active.index ? "true" : undefined} onClick={() => open(index)} className={`ds-focus w-32 shrink-0 overflow-hidden rounded-sm border text-left ${index === active.index ? "border-accent" : "border-line-soft"}`}><Frame panel={panel} frame={Math.floor(panel.durationInFrames / 2)} file={file} assets={assets} /><span className="block truncate px-2 py-1.5 text-2xs text-muted">{index + 1} · {panel.label}</span></button>)}
            </nav>
          </div>
        ) : null}
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

function Frame({ panel, frame, file, assets, constrained = false }: { panel: StoryboardPanel; frame: number; file: ProjectFile; assets: Readonly<Record<string, string>>; constrained?: boolean }) {
  return <div style={{ aspectRatio: `${file.width} / ${file.height}`, ...(constrained ? { maxWidth: `calc(max(140px, calc(100dvh - 420px)) * ${file.width / file.height})` } : {}) }} className="mx-auto w-full overflow-hidden bg-sunken">
    {panel.visual ? <StoryboardScene visual={panel.visual} frame={frame} width={file.width} height={file.height} assets={assets} label={`${panel.label}, frame ${frame}`} /> : <div className="flex h-full items-center justify-center p-5 text-center"><div><Grid2X2 size={22} className="mx-auto mb-2 text-subtle" aria-hidden /><p className="text-xs font-medium text-muted">Visual layout needed</p><p className="mt-1 text-2xs text-muted">Open this shot to draw the composition</p></div></div>}
  </div>;
}

function EmptyBoard({ file }: { file: ProjectFile }) {
  const stage = currentStage(file.process);
  const before = stage === "brief" || stage === "concept" || stage === "script";
  return <section aria-label="Storyboard" className="flex min-h-0 flex-1 flex-col bg-canvas"><ReviewBar><h2 className="text-xs font-medium text-ink">{file.name}</h2></ReviewBar><div className="flex flex-1 items-center justify-center p-6"><div className="max-w-[360px] text-center"><Grid2X2 size={26} className="mx-auto mb-3 text-muted" aria-hidden /><p className="text-sm font-medium text-ink">See the shots before you build them</p><p className="mt-2 text-xs leading-relaxed text-muted">{before && stage ? `Your agent draws the storyboard once the script is approved. The process is at ${STAGE_LABELS[stage]}.` : "Your agent draws each shot with visual layers, images and movement, then opens the sequence here for your review."}</p></div></div></section>;
}
