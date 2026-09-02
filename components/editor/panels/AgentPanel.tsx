"use client";

import { FolderOpen, Lock, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { linkFolder } from "@/lib/studio/actions";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
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
  /** The open composition's folder under `.prismlaunch`, or null. */
  slug: string | null;
};

const CONNECTION: Record<
  Props["kind"],
  { title: string; detail: (n: number) => string; tone: string }
> = {
  native: {
    title: "Agent tools available",
    detail: (n) => `${n} WebMCP tools registered on this page`,
    tone: "ds-level bg-accent-soft",
  },
  fallback: {
    title: "In-page tools only",
    detail: (n) =>
      `${n} tools registered, but this browser has no WebMCP — external agents cannot see them`,
    tone: "ds-level bg-warning-soft",
  },
  absent: {
    title: "Use direct controls",
    detail: () => "No WebMCP in this browser — every control still works",
    tone: "ds-inset bg-sunken",
  },
};

/**
 * The two connections, and everything that came through them.
 *
 * A film here is made by an agent and a person over one folder, so this is
 * the panel about how those three are joined: which folder, which agent, and
 * the log of what each of them did. The folder used to have a section of its
 * own; it is one path and one button, and it belongs with the other
 * connection rather than beside the process.
 */
export function AgentPanel({ activity, kind, toolCount, slug }: Props) {
  const connection = CONNECTION[kind];
  return (
    <PanelShell
      title="Agent"
      hint="What your agent can reach, and everything it has done, in order."
    >
      <PanelSection label="Folder">
        <div className="ds-inset rounded-sm bg-sunken p-3">
          <p className="flex items-center gap-2 font-mono text-xs break-all text-ink">
            <FolderOpen size={13} strokeWidth={1.8} className="shrink-0 text-subtle" aria-hidden />
            {WORKSPACE_DIR}/{slug ?? ""}
          </p>
          <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">
            Read and written on this machine. Nothing here is uploaded.
          </p>
        </div>
        <Button
          variant="quiet"
          className="mt-2"
          onClick={() => void linkFolder()}
          icon={<FolderOpen size={14} strokeWidth={1.9} aria-hidden />}
        >
          Link a different folder
        </Button>
      </PanelSection>

      <PanelSection label="Connection">
        <div className={`flex items-center gap-2.5 rounded-sm p-3.5 ${connection.tone}`}>
          <span
            className={`size-2 shrink-0 rounded-pill ${
              kind === "native" ? "bg-accent" : kind === "fallback" ? "bg-warning" : "bg-faint"
            }`}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block text-xs font-semibold ${
                kind === "native" ? "text-accent" : kind === "fallback" ? "text-warning" : "text-muted"
              }`}
            >
              {connection.title}
            </span>
            <span className="mt-0.5 block text-xs leading-[var(--ds-leading-body)] text-muted">
              {connection.detail(toolCount)}
            </span>
          </span>
        </div>
      </PanelSection>

      <PanelSection label="Activity">
        {activity.length === 0 ? (
          <p className="ds-inset rounded-sm bg-sunken p-3 text-xs leading-[var(--ds-leading-body)] text-subtle">
            Nothing yet. Every edit — yours or your agent&rsquo;s — is recorded
            here as it happens.
          </p>
        ) : null}

        <ol className="flex flex-col">
          {activity.map((event, index) => {
            const isLast = index === activity.length - 1;
            return (
              <li key={event.id} className="flex gap-3">
                <span className="flex w-4 shrink-0 flex-col items-center">
                  <span
                    className={`mt-1.5 grid size-4 shrink-0 place-items-center rounded-pill ${
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
                  {!isLast ? <span className="w-px flex-1 bg-line" /> : null}
                </span>

                <span className="min-w-0 flex-1 pb-4">
                  <span
                    className={`block break-all ${
                      event.origin === "agent"
                        ? "font-mono text-2xs"
                        : "text-xs font-semibold"
                    } ${event.blocked ? "text-warning" : event.origin === "agent" ? "text-accent" : "text-ink"}`}
                  >
                    {event.label}
                  </span>
                  <span className="mt-1 block text-xs leading-[var(--ds-leading-body)] text-muted">
                    {event.detail}
                  </span>
                  <span className="mt-0.5 block font-mono text-2xs text-subtle tabular-nums">
                    {event.at}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </PanelSection>

      {/* The render gate, stated where the agent's work is reviewed. */}
      <p className="ds-level flex items-start gap-2.5 rounded-sm p-3 text-xs leading-[var(--ds-leading-body)] text-muted">
        <Lock size={13} strokeWidth={1.8} className="mt-px shrink-0 text-subtle" aria-hidden />
        Your agent can propose a render but cannot start one. Exporting always
        takes a confirmation from you.
      </p>
    </PanelShell>
  );
}
