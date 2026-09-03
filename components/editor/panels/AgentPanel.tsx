"use client";

import { FolderOpen, Globe, Lock, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { linkFolder } from "@/lib/studio/actions";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";
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
  { title: string; detail: (n: number) => string; dot: string; tone: string }
> = {
  native: {
    title: "Agent tools available",
    detail: (n) => `${n} WebMCP tools registered on this page`,
    dot: "bg-accent",
    tone: "text-ink",
  },
  fallback: {
    title: "In-page tools only",
    detail: (n) =>
      `${n} tools registered, but this browser has no WebMCP, so external agents cannot see them`,
    dot: "bg-warning",
    tone: "text-warning",
  },
  absent: {
    title: "Use direct controls",
    detail: () => "No WebMCP in this browser. Every control still works.",
    dot: "bg-faint",
    tone: "text-muted",
  },
};

/**
 * The two connections, and everything that came through them.
 *
 * A film here is made by an agent and a person over one folder, so this is
 * the panel about how those three are joined: where the work lives, which
 * agent, and the log of what each of them did. Each is a row, not a card —
 * a panel that is a stack of boxes is a panel nobody reads.
 */
export function AgentPanel({ activity, kind, toolCount, slug }: Props) {
  const connection = CONNECTION[kind];
  const inBrowser = useStudioStore(
    (state) => state.workspace.kind === "linked" && state.workspace.workspace.kind === "browser",
  );
  const lastCapture = useStudioStore((state) => state.lastCapture);

  return (
    <PanelShell
      title="Agent"
      hint="What your agent can reach, and everything it has done, in order."
    >
      <PanelSection label={inBrowser ? "Where the work lives" : "Folder"}>
        <div className="flex items-start gap-2.5">
          {inBrowser ? (
            <Globe size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
          ) : (
            <FolderOpen size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs break-all text-ink">
              {inBrowser ? `this browser · ${slug ?? ""}` : `${WORKSPACE_DIR}/${slug ?? ""}`}
            </p>
            <p className="mt-0.5 text-xs leading-[var(--ds-leading-body)] text-muted">
              {inBrowser
                ? "Kept in this browser's storage. Your agent reads it back whole through the tools, and nothing is uploaded."
                : "Read and written on this machine. Nothing here is uploaded."}
            </p>
          </div>
        </div>
        <Button
          variant="quiet"
          size="sm"
          className="mt-2 -ml-2.5"
          onClick={() => void linkFolder()}
          icon={<FolderOpen size={12} strokeWidth={1.9} aria-hidden />}
        >
          {inBrowser ? "Link a folder instead" : "Link a different folder"}
        </Button>
      </PanelSection>

      <PanelSection label="Connection">
        <div className="flex items-start gap-2.5">
          <span className={`mt-1.5 size-2 shrink-0 rounded-pill ${connection.dot}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium ${connection.tone}`}>{connection.title}</p>
            <p className="mt-0.5 text-xs leading-[var(--ds-leading-body)] text-muted">
              {connection.detail(toolCount)}
            </p>
          </div>
        </div>
      </PanelSection>

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

      <PanelSection label="Activity">
        {activity.length === 0 ? (
          <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
            Nothing yet. Every edit, yours or your agent&rsquo;s, is recorded here as it
            happens.
          </p>
        ) : null}

        <ol className="flex flex-col">
          {activity.map((event, index) => {
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
                    {event.at}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </PanelSection>

      {/* The render gate, stated where the agent's work is reviewed. */}
      <p className="flex items-start gap-2 border-t border-line-soft pt-4 text-xs leading-[var(--ds-leading-body)] text-muted">
        <Lock size={12} strokeWidth={1.8} className="mt-px shrink-0 text-subtle" aria-hidden />
        Your agent can propose a render but cannot start one. Exporting always
        takes a confirmation from you.
      </p>
    </PanelShell>
  );
}
