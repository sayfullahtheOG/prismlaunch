"use client";

import { Clapperboard, Lock, Sparkles } from "lucide-react";
import { SourceIntake } from "./panels/SourceIntake";

/**
 * What a first-time visitor sees.
 *
 * Deliberately an *empty editor* rather than a marketing page: the chrome is
 * already there, so the shape of the tool is legible before you have anything
 * in it. The four slots below are drawn empty for the same reason — the film's
 * structure is fixed, and showing that up front is more honest than revealing
 * it after someone has committed.
 *
 * There is no preloaded demo film. Landing inside somebody else's finished
 * project makes it unclear what is yours and what is a sample; the demo is
 * offered as one of three ways to start instead.
 */
export function EmptyStudio() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-sunken p-8">
      <div className="w-full max-w-[420px]">
        <span className="ds-raised mb-5 grid size-12 place-items-center rounded-md bg-raised">
          <Clapperboard size={22} strokeWidth={1.6} className="text-muted" aria-hidden />
        </span>

        <h1 className="text-xl font-bold tracking-[var(--ds-tracking-tight)]">
          Start a launch film
        </h1>
        <p className="mt-2 text-sm leading-[var(--ds-leading-body)] text-muted">
          PrismLaunch reads a product&rsquo;s source and builds a four-scene,
          eighteen-second launch film you and your agent direct together.
        </p>

        <div className="mt-6">
          <SourceIntake />
        </div>

        <ul className="mt-6 flex flex-col gap-2.5">
          <Hint icon={<Sparkles size={14} strokeWidth={1.8} aria-hidden />}>
            Your agent can do this too — ask it to inspect a repository and it
            will build the board in front of you.
          </Hint>
          <Hint icon={<Lock size={14} strokeWidth={1.8} aria-hidden />}>
            Source is read, never run. The film is encoded on this device and
            nothing is uploaded.
          </Hint>
        </ul>
      </div>
    </div>
  );
}

function Hint({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-xs leading-[var(--ds-leading-body)] text-subtle">
      <span className="mt-0.5 shrink-0">{icon}</span>
      {children}
    </li>
  );
}

/**
 * The timeline's resting state: the four slots that always exist, drawn empty.
 * Teaches the fixed structure without a tooltip.
 */
export function EmptyTimeline() {
  const SLOTS = ["Hook", "Reveal", "Proof", "Resolve"] as const;

  return (
    <section
      aria-label="Storyboard timeline"
      className="flex h-[200px] shrink-0 flex-col border-t border-line-soft bg-surface"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <h2 className="text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
          Storyboard
        </h2>
        <span className="ds-level flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs text-muted">
          <Lock size={11} strokeWidth={2} aria-hidden />
          Fixed 4-scene structure
        </span>
      </div>

      <div className="flex flex-1 items-stretch gap-1.5 px-4 pt-3 pb-4">
        {SLOTS.map((slot, index) => (
          <div
            key={slot}
            className="ds-inset flex flex-1 flex-col justify-between rounded-sm bg-sunken p-2.5"
          >
            <span className="tabular font-mono text-2xs text-subtle">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs font-semibold text-subtle">{slot}</span>
            <span className="text-2xs text-subtle">Empty</span>
          </div>
        ))}
      </div>
    </section>
  );
}
