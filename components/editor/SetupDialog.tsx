"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  FolderOpen,
  FolderPlus,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  createBlankProject,
  linkFolder,
  openProject,
  regrantWorkspace,
} from "@/lib/studio/actions";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
import { useStudioStore } from "@/lib/studio/store";

/**
 * The setup, over the editor.
 *
 * The editor is the page. It renders behind this, blank and inert, so the
 * first thing a person sees is the tool they are about to use — the timeline,
 * the layers, the process — rather than a landing page standing in for it.
 * This dialog is the one thing between them and it: the line to give an
 * agent, and the folder to link. It closes itself the moment a composition is
 * open, because that is the only thing it was waiting for.
 *
 * Not dismissable while nothing is open. There is nothing behind it to go back
 * to yet; an inert editor is not a place to leave someone.
 */

const SKILL_URL = "https://prismlaunch-doddlesoft.vercel.app/SKILL.md";
const SKILL_COMMAND = `set up ${SKILL_URL}`;

export function SetupDialog() {
  const workspace = useStudioStore((state) => state.workspace);
  const loadError = useStudioStore((state) => state.loadError);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * What the last click did, in the action's own words. Shown even on
   * success, because a link that succeeds without landing anywhere — the
   * picker returned nothing, every composition was unreadable — used to leave
   * the dialog exactly as it was, and a person cannot tell "nothing happened"
   * from "something happened and I cannot see it". The first version was
   * silent here, and in an agent browser it read as broken.
   */
  const [outcome, setOutcome] = useState<string | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  // Focus lands in the dialog on open. There is no trigger to return to.
  useEffect(() => {
    surface.current
      ?.querySelector<HTMLElement>("button:not([disabled])")
      ?.focus();
  }, []);

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const result = await action();
      if (result.ok) setOutcome(result.message);
      else setError(result.message);
    } catch (thrown) {
      // A rejection here is a bug, but a bug the person should be able to
      // read and report rather than a dialog that quietly does nothing.
      setError(`Something failed inside the app: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-canvas/45 p-6 backdrop-blur-[2px]"
      aria-hidden={false}
    >
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        className="ds-floating thin-scroll flex max-h-full w-full max-w-[600px] flex-col gap-7 overflow-y-auto rounded-md bg-raised p-8"
      >
        <header>
          <h1
            id="setup-title"
            className="text-center text-xl font-bold tracking-[var(--ds-tracking-tight)]"
          >
            Give this to your agent
          </h1>
          <p className="mt-2 text-center text-sm leading-[var(--ds-leading-body)] text-muted">
            A video canvas with a layer timeline, driven by your agent. It
            writes the layers; this page renders them, and you decide what
            ships.
          </p>
        </header>

        <CopyCommand />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line-soft" />
          <span className="text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-subtle uppercase">
            then
          </span>
          <span className="h-px flex-1 bg-line-soft" />
        </div>

        {workspace.kind === "checking" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-subtle">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Looking for a linked folder…
          </p>
        ) : null}

        {workspace.kind === "unsupported" ? <Unsupported /> : null}

        {workspace.kind === "unlinked" ? (
          <LinkPrompt busy={busy} onLink={() => void run(linkFolder)} />
        ) : null}

        {workspace.kind === "needs-permission" ? (
          <Regrant busy={busy} onRegrant={() => void run(regrantWorkspace)} />
        ) : null}

        {workspace.kind === "linked" ? (
          <Linked
            busy={busy}
            projects={workspace.projects}
            onOpen={(slug) => void run(() => openProject(slug))}
            onCreate={() => void run(createBlankProject)}
            onRelink={() => void run(linkFolder)}
          />
        ) : null}

        {outcome && !error ? (
          <p role="status" className="text-center text-xs leading-[var(--ds-leading-body)] text-muted">
            {outcome}
          </p>
        ) : null}

        {error || loadError ? (
          <p
            role="alert"
            className="ds-level flex items-start gap-2.5 rounded-sm bg-warning-soft px-3 py-2.5 text-xs leading-[var(--ds-leading-body)] text-warning"
          >
            <TriangleAlert size={14} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
            {error ?? loadError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The command, and a button that copies it.
 *
 * Rendered as a terminal line because that is where it is going: `set up <url>`
 * is how a coding agent is handed a skill. The copy button confirms in place
 * rather than silently succeeding.
 */
function CopyCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SKILL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked. The text is right there and selectable.
    }
  }

  return (
    <div className="ds-raised flex items-center gap-2.5 rounded-sm bg-ink py-2.5 pr-2.5 pl-3.5">
      <span aria-hidden className="font-mono text-xs text-inverse opacity-50">
        $
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-inverse">
        {SKILL_COMMAND}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy command"}
        className="ds-focus grid size-8 shrink-0 place-items-center rounded-xs text-inverse opacity-60 transition-[background-color,opacity] duration-140 hover:bg-inverse/10 hover:opacity-100"
      >
        {copied ? (
          <Check size={14} strokeWidth={2.4} aria-hidden />
        ) : (
          <Copy size={14} strokeWidth={1.9} aria-hidden />
        )}
      </button>
    </div>
  );
}

function Unsupported() {
  return (
    <div className="ds-level rounded-sm bg-warning-soft p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-warning">
        <TriangleAlert size={14} strokeWidth={2.2} aria-hidden />
        This browser cannot open a folder
      </p>
      <p className="mt-2 text-xs leading-[var(--ds-leading-body)] text-muted">
        PrismLaunch reads and writes a folder on your own machine, which needs
        the File System Access API — Chrome, Edge, Arc, or another Chromium
        browser. Safari and Firefox do not have it. Nothing is uploaded, so
        there is no server-side fallback to offer you.
      </p>
    </div>
  );
}

function LinkPrompt({ busy, onLink }: { busy: boolean; onLink: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        onClick={onLink}
        loading={busy}
        icon={<FolderPlus size={15} strokeWidth={1.9} aria-hidden />}
      >
        Link project folder
      </Button>
      <p className="text-center text-xs leading-[var(--ds-leading-body)] text-subtle">
        Choose the repository you and your agent are working in. Compositions
        are kept in <code className="font-mono">{WORKSPACE_DIR}/</code> inside
        it, one folder per video. Your agent cannot open this picker — browsers
        only show it for a real click.
      </p>
    </div>
  );
}

function Regrant({ busy, onRegrant }: { busy: boolean; onRegrant: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        onClick={onRegrant}
        loading={busy}
        icon={<FolderOpen size={15} strokeWidth={1.9} aria-hidden />}
      >
        Re-open folder
      </Button>
      <p className="text-center text-xs leading-[var(--ds-leading-body)] text-subtle">
        We remember which folder you linked, but the browser drops its
        permission every time the page loads. One click restores it.
      </p>
    </div>
  );
}

type ProjectEntry = { slug: string; name: string | null; problem: string | null };

function Linked({
  busy,
  projects,
  onOpen,
  onCreate,
  onRelink,
}: {
  busy: boolean;
  projects: ProjectEntry[];
  onOpen: (slug: string) => void;
  onCreate: () => void;
  onRelink: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        Only reached when the folder linked but nothing could be opened —
        every composition in it is unreadable and a blank one could not be
        written. Normally landing happens on its own and this never shows.
      */}
      {projects.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {projects.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                disabled={entry.name === null}
                onClick={() => onOpen(entry.slug)}
                className={`ds-focus flex w-full flex-col items-start gap-1 rounded-sm p-3 text-left transition-[background-color,box-shadow] duration-140 ease-[var(--ease-standard)] ${
                  entry.name === null
                    ? "ds-inset cursor-not-allowed bg-sunken"
                    : "ds-raised bg-raised hover:bg-strong"
                }`}
              >
                <span className="text-sm font-semibold text-ink">
                  {entry.name ?? entry.slug}
                </span>
                <span className="font-mono text-2xs text-subtle">
                  {WORKSPACE_DIR}/{entry.slug}/project.json
                </span>
                {entry.problem ? (
                  <span className="mt-1 flex items-start gap-1.5 text-2xs leading-[var(--ds-leading-body)] text-warning">
                    <TriangleAlert size={11} strokeWidth={2.2} className="mt-px shrink-0" aria-hidden />
                    {entry.problem}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        variant={projects.length === 0 ? "primary" : "secondary"}
        onClick={onCreate}
        loading={busy}
        icon={<Plus size={15} strokeWidth={2} aria-hidden />}
      >
        New composition
      </Button>

      <button
        type="button"
        onClick={onRelink}
        className="ds-focus self-center rounded-xs px-2 py-1 text-xs text-subtle underline-offset-2 hover:text-ink hover:underline"
      >
        Link a different folder
      </button>
    </div>
  );
}
