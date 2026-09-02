"use client";

import { FolderOpen, RefreshCw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  closeProject,
  openProject,
  refreshProjects,
  unlinkFolder,
} from "@/lib/studio/actions";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";
import { PanelShell, PanelSection } from "./PanelShell";

/**
 * The folder, from inside the editor.
 *
 * Replaces the old Source panel, which listed components scraped out of a
 * repository. Nothing is scraped now: what this shows is the one thing that is
 * actually true about where the film lives — the folder, the films in it, and
 * which one is open.
 */
export function FolderPanel() {
  const workspace = useStudioStore((state) => state.workspace);
  const project = useStudioStore((state) => state.project);
  const loadError = useStudioStore((state) => state.loadError);

  const projects = workspace.kind === "linked" ? workspace.projects : [];

  return (
    <PanelShell
      title="Folder"
      hint="The film is a file on your machine. Your agent edits it; this page follows along."
    >
      <PanelSection label="Location">
        <div className="ds-inset rounded-sm bg-sunken p-3">
          <p className="flex items-center gap-2 font-mono text-xs break-all text-ink">
            <FolderOpen size={13} strokeWidth={1.8} className="shrink-0 text-subtle" aria-hidden />
            {WORKSPACE_DIR}/{project?.slug ?? ""}
          </p>
          <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">
            Read and written locally. Nothing here is uploaded.
          </p>
        </div>
      </PanelSection>

      {loadError ? (
        <PanelSection label="File problem">
          <p
            role="alert"
            className="ds-level flex items-start gap-2 rounded-sm bg-warning-soft p-3 text-xs leading-[var(--ds-leading-body)] text-warning"
          >
            <TriangleAlert size={13} strokeWidth={2.2} className="mt-px shrink-0" aria-hidden />
            {loadError}
          </p>
        </PanelSection>
      ) : null}

      <PanelSection label={`Films (${projects.length})`}>
        <ul className="flex flex-col gap-2">
          {projects.map((entry) => {
            const open = entry.slug === project?.slug;
            return (
              <li key={entry.slug}>
                <button
                  type="button"
                  disabled={entry.name === null || open}
                  onClick={() => void openProject(entry.slug)}
                  aria-current={open ? "true" : undefined}
                  className={`ds-focus flex w-full flex-col items-start gap-0.5 rounded-sm p-2.5 text-left transition-[background-color,box-shadow] duration-140 ease-[var(--ease-standard)] ${
                    open
                      ? "ds-inset bg-sunken"
                      : entry.name === null
                        ? "ds-inset cursor-not-allowed bg-sunken opacity-60"
                        : "ds-raised bg-raised hover:bg-strong"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${open ? "text-accent" : "text-ink"}`}
                  >
                    {entry.name ?? entry.slug}
                  </span>
                  <span className="font-mono text-2xs text-subtle">
                    {entry.slug}
                  </span>
                  {entry.problem ? (
                    <span className="mt-1 text-2xs leading-[var(--ds-leading-body)] text-warning">
                      {entry.problem}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="quiet"
            onClick={() => void refreshProjects()}
            icon={<RefreshCw size={14} strokeWidth={1.9} aria-hidden />}
          >
            Rescan folder
          </Button>
          <Button
            variant="quiet"
            onClick={() => closeProject()}
            icon={<X size={14} strokeWidth={1.9} aria-hidden />}
          >
            Close film
          </Button>
          <Button variant="quiet" onClick={() => void unlinkFolder()}>
            Unlink folder
          </Button>
        </div>
      </PanelSection>
    </PanelShell>
  );
}
