"use client";

import { useState } from "react";
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
 * What a first-time visitor sees.
 *
 * PrismLaunch has no model. It cannot look at a repository, and it does not
 * try — the agent already knows the product, and it is sitting in the person's
 * editor with file tools. So the first screen is not an input box asking for a
 * repo URL. It is a handoff: here is the one line that teaches your agent to
 * use this, and here is the folder we will both work in.
 *
 * The command is the primary object on the page for that reason. Everything
 * else follows from someone having pasted it.
 */

const SKILL_URL = "https://prismlaunch-doddlesoft.vercel.app/SKILL.md";
const SKILL_COMMAND = `set up ${SKILL_URL}`;

export function StartScreen() {
  const workspace = useStudioStore((state) => state.workspace);
  const loadError = useStudioStore((state) => state.loadError);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-sunken px-8 py-12">
      <div className="flex w-full max-w-[520px] flex-col gap-7">
        <header>
          <h1 className="text-center text-xl font-bold tracking-[var(--ds-tracking-tight)]">
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
 * is how a coding agent is handed a skill. Selecting it by hand from a page is
 * the kind of small friction that stops people trying something, so the copy
 * button confirms in place rather than silently succeeding.
 */
function CopyCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SKILL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked. The text is right there and selectable, so there is
      // nothing useful to say — a failure toast would be noise.
    }
  }

  return (
    <div className="ds-raised flex items-center gap-3 rounded-sm bg-ink p-3.5">
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

      {/*
        One click, no form. Naming a thing before making it is the wrong order —
        you find out what it is by building it — so this creates and opens
        straight away, and the title is editable in the top bar afterwards.
      */}
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
