"use client";

import { Check, Sparkles, X } from "lucide-react";
import { STAGE_LABELS, STAGE_PURPOSE, stageIndex } from "@/lib/studio/process";
import type { Process, ProjectFile, StageId } from "@/types/prism";
import { StageDecision, StageStatusChip } from "./panels/StageDecision";
import { ReviewBar } from "./ReviewBar";

/**
 * A stage's output, at reading size.
 *
 * The brief, the directions, the script, the sound plan and the checklist
 * are documents, and a document is reviewed the way it is read: one column,
 * generous type, the decision at the end where a signature goes. The
 * Process panel keeps the list and the same two buttons; this is where the
 * person actually reads what the agent wrote before pressing either.
 */
export function StageReview({ stage, file }: { stage: StageId; file: ProjectFile }) {
  const process = file.process;
  const state = process[stage];
  const submitted = state.status !== "pending";

  return (
    <section
      aria-label={`${STAGE_LABELS[stage]} review`}
      className="flex min-h-0 flex-1 flex-col bg-canvas"
    >
      <ReviewBar>
        <span className="text-xs text-subtle">Process</span>
        <span className="text-xs text-subtle" aria-hidden>/</span>
        <span className="text-xs font-medium text-ink">{STAGE_LABELS[stage]}</span>
      </ReviewBar>
      <article className="thin-scroll mx-auto w-full max-w-[720px] min-h-0 flex-1 overflow-y-auto px-10 py-10">
        <header className="flex flex-col gap-2">
          <p className="flex items-center gap-3 font-mono text-xs text-subtle">
            <span className="tabular">{String(stageIndex(stage) + 1).padStart(2, "0")}</span>
            <StageStatusChip status={state.status} />
          </p>
          <h1 className="text-xl font-semibold tracking-[var(--ds-tracking-tight)] text-ink">
            {STAGE_LABELS[stage]}
          </h1>
          <p className="text-sm leading-[var(--ds-leading-body)] text-muted">
            {STAGE_PURPOSE[stage]}
          </p>
        </header>

        {state.summary ? (
          <p className="mt-6 flex items-start gap-2 text-sm leading-[var(--ds-leading-body)] text-muted">
            <Sparkles size={13} strokeWidth={2.2} className="mt-1 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="font-medium text-ink">Your agent: </span>
              {state.summary}
            </span>
          </p>
        ) : null}

        <div className="mt-8">
          {submitted ? <Body stage={stage} process={process} /> : <Empty stage={stage} />}
        </div>

        {state.note ? (
          <p className="mt-8 border-t border-line-soft pt-6 text-sm leading-[var(--ds-leading-body)] text-warning">
            <span className="font-medium">You said: </span>
            {state.note}
          </p>
        ) : null}

        <footer className="mt-10 border-t border-line-soft pt-6">
          <StageDecision stage={stage} state={state} process={process} />
        </footer>
      </article>
    </section>
  );
}

function Body({ stage, process }: { stage: StageId; process: Process }) {
  switch (stage) {
    case "brief":
      return <Brief brief={process.brief} />;
    case "concept":
      return <Concepts concept={process.concept} />;
    case "script":
      return <Script script={process.script} lengthSeconds={process.brief.lengthSeconds} />;
    case "sound":
      return <Sound plan={process.sound.plan} />;
    case "polish":
      return <Polish checklist={process.polish.checklist} />;
    default:
      return null;
  }
}

/** The one message, large, and the facts that shaped it under it. */
function Brief({ brief }: { brief: Process["brief"] }) {
  if (!brief.message && !brief.audience) return <Empty stage="brief" />;
  return (
    <div className="flex flex-col gap-8">
      {brief.message ? (
        <p className="text-2xl leading-[var(--ds-leading-heading)] font-semibold tracking-[var(--ds-tracking-tight)] text-ink [text-wrap:balance]">
          {brief.message}
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <Fact label="Audience" value={brief.audience} />
        <Fact label="Feeling" value={brief.feeling} />
        <Fact label="Length" value={brief.lengthSeconds ? `${brief.lengthSeconds} seconds` : undefined} />
        <Fact label="Demo moment" value={brief.demoMoment} />
        <Fact label="The truth" value={brief.truth} wide />
      </dl>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string | undefined; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm leading-[var(--ds-leading-body)] text-ink">{value}</dd>
    </div>
  );
}

/** Three directions side by side, the recommended one marked, the chosen one settled. */
function Concepts({ concept }: { concept: Process["concept"] }) {
  if (concept.directions.length === 0) return <Empty stage="concept" />;
  return (
    <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {concept.directions.map((direction, index) => {
        const chosen = direction.id === concept.chosen;
        const recommended = direction.id === concept.recommended;
        const marked = chosen || (recommended && !concept.chosen);
        return (
          <li
            key={direction.id}
            className={`flex flex-col gap-3 rounded-sm bg-surface p-5 ${
              marked
                ? "shadow-[0_0_0_1px_var(--ds-color-accent)]"
                : "shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
            }`}
          >
            <p className="flex items-center gap-2 font-mono text-2xs text-subtle">
              <span className="tabular">{String(index + 1).padStart(2, "0")}</span>
              {chosen ? (
                <span className="font-sans font-medium text-success">Chosen</span>
              ) : recommended ? (
                <span className="font-sans font-medium text-accent">Recommended</span>
              ) : null}
              {direction.score !== undefined ? (
                <span className="tabular ml-auto">{direction.score}/12</span>
              ) : null}
            </p>
            <p className="text-sm font-semibold text-ink">{direction.title}</p>
            <p className="text-md leading-[var(--ds-leading-body)] text-ink">{direction.line}</p>
            {direction.angle || direction.feel ? (
              <p className="mt-auto text-xs leading-[var(--ds-leading-body)] text-muted">
                {[direction.angle, direction.feel].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The beats as a script page: words large enough to read aloud, timed. */
function Script({
  script,
  lengthSeconds,
}: {
  script: Process["script"];
  lengthSeconds: number | undefined;
}) {
  if (script.beats.length === 0) return <Empty stage="script" />;
  const total = script.beats.reduce((n, beat) => n + beat.seconds, 0);
  return (
    <div className="flex flex-col gap-8">
      <ol className="flex flex-col divide-y divide-line-soft">
        {script.beats.map((beat, index) => (
          <li key={beat.id} className="grid grid-cols-[3rem_1fr_4rem] gap-4 py-5 first:pt-0">
            <span className="tabular pt-1 font-mono text-xs text-subtle">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">{beat.label}</p>
              {beat.words ? (
                <p className="mt-1.5 text-lg leading-[var(--ds-leading-heading)] text-ink [text-wrap:pretty]">
                  {beat.words}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-subtle italic">No words on screen.</p>
              )}
              {beat.sound ? (
                <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">♪ {beat.sound}</p>
              ) : null}
            </div>
            <span className="tabular pt-1 text-right font-mono text-xs text-subtle">
              {beat.seconds.toFixed(1)}s
            </span>
          </li>
        ))}
      </ol>
      <p className="tabular font-mono text-xs text-subtle">
        {script.beats.length} beats · {total.toFixed(1)}s
        {lengthSeconds ? ` of ${lengthSeconds}s` : ""}
      </p>
      {script.voiceover ? (
        <div>
          <p className="text-xs font-medium text-muted">Voiceover</p>
          <p className="mt-1.5 text-sm leading-[var(--ds-leading-body)] text-ink">{script.voiceover}</p>
        </div>
      ) : null}
    </div>
  );
}

function Sound({ plan }: { plan: string | undefined }) {
  if (!plan) return <Empty stage="sound" />;
  return (
    <pre className="font-sans text-sm leading-[var(--ds-leading-body)] whitespace-pre-wrap text-ink">
      {plan}
    </pre>
  );
}

/** The checklist, each line with its verdict. */
function Polish({ checklist }: { checklist: readonly string[] }) {
  if (checklist.length === 0) return <Empty stage="polish" />;
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {checklist.map((line, index) => {
        const failed = /^[✗x✕]/i.test(line.trim());
        const text = line.replace(/^[✓✔✗x✕]\s*/i, "");
        return (
          <li key={index} className="flex items-start gap-3 py-3 first:pt-0">
            {failed ? (
              <X size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-warning" aria-label="Failed" />
            ) : (
              <Check size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-success" aria-label="Passed" />
            )}
            <span className={`text-sm leading-[var(--ds-leading-body)] ${failed ? "text-warning" : "text-ink"}`}>
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Nothing here yet: say what will arrive, and by which call. */
function Empty({ stage }: { stage: StageId }) {
  const tool: Record<StageId, string> = {
    brief: "prism.submit_brief",
    concept: "prism.submit_concepts",
    script: "prism.submit_script",
    storyboard: "prism.submit_storyboard",
    animatic: "prism.submit_animatic",
    style: "prism.submit_style_frames",
    build: "prism.submit_build",
    sound: "prism.submit_sound",
    polish: "prism.submit_polish",
  };
  return (
    <p className="text-sm leading-[var(--ds-leading-body)] text-subtle">
      Nothing submitted yet. Your agent writes this with{" "}
      <code className="font-mono text-xs text-muted">{tool[stage]}</code>, and it appears here for
      you to read.
    </p>
  );
}
