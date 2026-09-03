"use client";

import { Lock, Sparkles, User } from "lucide-react";
import { useStudioStore } from "@/lib/studio/store";
import type { ActivityEvent } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

type Props = {
  activity: ActivityEvent[];
};

/**
 * What happened, newest first.
 *
 * Both parties' edits are here, the person's and the agent's, so the panel
 * is Activity rather than the agent's. The record is the panel; where the
 * work lives and how the agent reaches it are facts about the folder, and
 * sit in the Files section. Newest at the top, because the question is
 * "what just happened", and the answer should not be at the bottom of a
 * scroll.
 */
export function AgentPanel({ activity }: Props) {
  const lastCapture = useStudioStore((state) => state.lastCapture);

  return (
    <PanelShell title="Activity">
      {lastCapture ? (
        <PanelSection label="What your agent saw">
          <div className="flex flex-col gap-2">
            {lastCapture.pages.map((page, index) => (
              // A plain img: the sheet is a data URL the agent already has.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={page}
                alt={`Sheet ${index + 1} of ${lastCapture.pages.length} your agent captured: ${lastCapture.label}`}
                className="w-full rounded-xs shadow-[0_0_0_1px_var(--ds-color-line-soft)]"
              />
            ))}
          </div>
          <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">
            {lastCapture.label}
            <span className="ml-2 font-mono text-2xs text-subtle tabular-nums">{lastCapture.at}</span>
          </p>
        </PanelSection>
      ) : null}

      {activity.length === 0 ? (
        <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
          Nothing yet. Every edit, yours or your agent&rsquo;s, is recorded here as it happens.
        </p>
      ) : null}

      <ol className="flex flex-col">
        {[...activity].reverse().map((event, index) => {
          const isLast = index === activity.length - 1;
          return (
            <li key={event.id} className="flex gap-2.5">
              <span className="flex w-4 shrink-0 flex-col items-center">
                <span
                  className={`mt-1 grid size-4 shrink-0 place-items-center rounded-pill ${
                    event.blocked
                      ? "bg-warning/15 text-warning"
                      : event.origin === "agent"
                        ? "bg-accent-soft text-accent"
                        : "bg-sunken text-subtle"
                  }`}
                >
                  {event.blocked ? (
                    <Lock size={9} strokeWidth={2.6} aria-hidden />
                  ) : event.origin === "agent" ? (
                    <Sparkles size={9} strokeWidth={2.6} aria-hidden />
                  ) : (
                    <User size={9} strokeWidth={2.6} aria-hidden />
                  )}
                </span>
                {!isLast ? <span className="w-px flex-1 bg-line-soft" /> : null}
              </span>

              <span className="min-w-0 flex-1 pb-3.5">
                <span
                  className={`block break-all ${
                    event.origin === "agent" ? "font-mono text-2xs" : "text-xs font-medium"
                  } ${event.blocked ? "text-warning" : event.origin === "agent" ? "text-accent" : "text-ink"}`}
                >
                  {event.label}
                </span>
                <span className="mt-0.5 block text-xs leading-[var(--ds-leading-body)] text-muted">
                  {event.detail}
                </span>
                <span className="mt-0.5 block font-mono text-2xs text-subtle tabular-nums">
                  {event.at.includes("T") && !Number.isNaN(Date.parse(event.at))
                    ? new Date(event.at).toLocaleString()
                    : event.at}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </PanelShell>
  );
}
