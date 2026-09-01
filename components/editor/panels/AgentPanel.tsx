"use client";

import { Lock, Sparkles, User } from "lucide-react";
import type { ActivityEvent } from "@/types/prism";
import { PanelShell, PanelSection } from "./PanelShell";

type Props = {
  activity: ActivityEvent[];
  /**
   * Never collapse this to a boolean. A fallback registry is invisible to
   * external agents, so reporting it as connected would claim reach the
   * product does not have.
   */
  kind: "native" | "fallback" | "absent";
  toolCount: number;
};

const CONNECTION: Record<
  Props["kind"],
  { title: string; detail: (n: number) => string; tone: string }
> = {
  native: {
    title: "Agent tools available",
    detail: (n) => `${n} WebMCP tools registered on this page`,
    tone: "border-brand/30 bg-brand-soft",
  },
  fallback: {
    title: "In-page tools only",
    detail: (n) =>
      `${n} tools registered, but this browser has no WebMCP — external agents cannot see them`,
    tone: "border-draft-line bg-draft-soft",
  },
  absent: {
    title: "Use direct controls",
    detail: () => "No WebMCP in this browser — every control still works",
    tone: "border-line bg-sunken",
  },
};

export function AgentPanel({ activity, kind, toolCount }: Props) {
  const connection = CONNECTION[kind];
  return (
    <PanelShell
      title="Agent"
      hint="Everything your agent has done, in the order it happened."
    >
      <PanelSection label="Connection">
        <div className={`flex items-center gap-2 rounded-card border p-3 ${connection.tone}`}>
          <span
            className={`size-2 shrink-0 rounded-full ${
              kind === "native" ? "bg-brand" : kind === "fallback" ? "bg-draft" : "bg-faint"
            }`}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block text-xs font-semibold ${
                kind === "native" ? "text-brand" : kind === "fallback" ? "text-draft" : "text-muted"
              }`}
            >
              {connection.title}
            </span>
            <span className="block text-[11px] text-muted">
              {connection.detail(toolCount)}
            </span>
          </span>
        </div>
      </PanelSection>

      <PanelSection label="Activity">
        <ol className="flex flex-col">
          {activity.map((event, index) => {
            const isLast = index === activity.length - 1;
            return (
              <li key={event.id} className="flex gap-3">
                <span className="flex w-4 shrink-0 flex-col items-center">
                  <span
                    className={`mt-1.5 grid size-4 shrink-0 place-items-center rounded-full ${
                      event.blocked
                        ? "bg-draft/15 text-draft"
                        : event.origin === "agent"
                          ? "bg-brand-soft text-brand"
                          : "bg-sunken text-faint"
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
                  {!isLast ? <span className="w-px flex-1 bg-line" /> : null}
                </span>

                <span className="min-w-0 flex-1 pb-4">
                  <span
                    className={`block break-all ${
                      event.origin === "agent"
                        ? "font-mono text-[11.5px]"
                        : "text-xs font-semibold"
                    } ${event.blocked ? "text-draft" : event.origin === "agent" ? "text-brand" : "text-ink"}`}
                  >
                    {event.label}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    {event.detail}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-faint tabular-nums">
                    {event.at}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </PanelSection>

      {/* The render gate, stated where the agent's work is reviewed. */}
      <p className="flex items-start gap-2 rounded-card border border-line bg-sunken p-3 text-[11.5px] text-muted">
        <Lock size={13} strokeWidth={1.8} className="mt-px shrink-0 text-faint" aria-hidden />
        Your agent can propose a render but cannot start one. Exporting always
        takes a confirmation from you.
      </p>
    </PanelShell>
  );
}
