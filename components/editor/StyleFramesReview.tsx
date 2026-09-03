"use client";

import dynamic from "next/dynamic";
import { Shapes } from "lucide-react";
import { htmlElementPreview, styleSamples } from "@/lib/studio/style-review";
import { timecode } from "@/lib/studio/timing";
import type { Element, ProjectFile } from "@/types/prism";
import { StageDecision, StageStatusChip } from "./panels/StageDecision";

// Film fonts and previews need a document; keep their imports out of SSR.
const FrameThumbnail = dynamic(() => import("./StyleFrameThumbnail").then((mod) => mod.StyleFrameThumbnail), { ssr: false });
const ElementPreview = dynamic(() => import("./panels/PiecePreview").then((mod) => mod.Preview), { ssr: false });

export function StyleFramesReview({ file }: { file: ProjectFile }) {
  const state = file.process.style;
  const samples = styleSamples(file);

  return (
    <section aria-label="Style frames review" className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-7 p-6">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3"><h1 className="text-xl font-semibold text-ink">Style frames</h1><StageStatusChip status={state.status} /></div>
            <p className="text-sm text-muted">The elements and sample frames your agent is preparing for the animatic.</p>
            {state.look ? <p className="text-xs text-muted">Look: <span className="capitalize text-ink">{state.look}</span></p> : null}
          </header>

          <section aria-label="Elements for the animatic">
            <h2 className="mb-3 text-sm font-medium text-ink">Elements <span className="ml-1 font-mono text-xs text-muted">{file.elements.length}</span></h2>
            {file.elements.length ? (
              <ul className="grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}>
                {file.elements.map((element) => <ElementCard key={element.id} element={element} file={file} />)}
              </ul>
            ) : (
              <div className="flex items-start gap-3 rounded-sm border border-line-soft p-5 text-sm text-muted"><Shapes size={18} className="shrink-0" aria-hidden /><p>Elements appear here as your agent adds them: type, colours, media and motion.</p></div>
            )}
          </section>

          {samples.length ? (
            <section aria-label="Sample frames">
              <h2 className="mb-3 text-sm font-medium text-ink">Sample frames</h2>
              <ul className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
                {samples.map((sample) => <li key={sample.id} className="min-w-0"><FrameThumbnail file={file} frame={sample.frame} /><p className="mt-2 flex items-baseline justify-between gap-3 text-xs text-ink"><span>{sample.label}</span><span className="shrink-0 font-mono text-muted">{timecode(sample.frame / file.fps)}</span></p></li>)}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="max-h-[40%] shrink-0 overflow-y-auto border-t border-line-soft bg-canvas px-6 py-4">
        <div className="mx-auto flex max-w-[800px] flex-col gap-2">
          {state.summary ? <p className="text-xs leading-relaxed text-muted"><span className="font-medium text-ink">Your agent: </span>{state.summary}</p> : null}
          {state.note ? <p className="text-xs leading-relaxed text-warning"><span className="font-medium">You said: </span>{state.note}</p> : null}
          <StageDecision stage="style" state={state} process={file.process} />
        </div>
      </footer>
    </section>
  );
}

function ElementCard({ element, file }: { element: Element; file: ProjectFile }) {
  const preview = element.kind === "html" ? htmlElementPreview(file, element) : null;
  return (
    <li className="min-w-0">
      {preview ? <FrameThumbnail file={preview} frame={Math.floor(preview.durationInFrames / 2)} /> : <ElementPreview draft={element} large />}
      <h3 className="mt-2 break-words text-xs font-medium text-ink">{element.name}</h3>
      <p className="mt-0.5 text-2xs capitalize text-muted">{element.kind}{element.role ? ` · ${element.role}` : ""}</p>
    </li>
  );
}
