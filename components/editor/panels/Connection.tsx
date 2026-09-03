"use client";

import { FolderOpen, Globe, Lock, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { linkFolder } from "@/lib/studio/actions";
import { hostedByAgent } from "@/lib/studio/hosted";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";

/**
 * Where the work lives and how the agent reaches it, behind one button
 * beside the Files title: facts about the folder, checked once.
 */

export type ConnectionProps = {
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
  ConnectionProps["kind"],
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

export function Connection({ kind, toolCount, slug }: ConnectionProps) {
  const connection = CONNECTION[kind];
  const inBrowser = useStudioStore(
    (state) => state.workspace.kind === "linked" && state.workspace.workspace.kind === "browser",
  );

  return (
    <Popover label="Folder and connection" icon={<Settings2 size={15} strokeWidth={1.9} aria-hidden />}>
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
              ? "Kept in this browser's storage. Nothing is uploaded."
              : "Read and written on this machine. Nothing is uploaded."}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 size-2 shrink-0 rounded-pill ${connection.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${connection.tone}`}>{connection.title}</p>
          <p className="mt-0.5 text-xs leading-[var(--ds-leading-body)] text-muted">
            {connection.detail(toolCount)}
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-[var(--ds-leading-body)] text-muted">
        <Lock size={12} strokeWidth={1.8} className="mt-px shrink-0 text-subtle" aria-hidden />
        Your agent can propose a render but cannot start one.
      </p>

      {hostedByAgent(kind, navigator.userAgent) ? null : (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => void linkFolder()}
          icon={<FolderOpen size={12} strokeWidth={1.9} aria-hidden />}
        >
          {inBrowser ? "Link a folder instead" : "Link a different folder"}
        </Button>
      )}
    </Popover>
  );
}
