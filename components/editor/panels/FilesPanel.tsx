"use client";

import { ChevronRight, File as FileIcon, Folder, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { deleteProject, openFile } from "@/lib/studio/actions";
import { WORKSPACE_DIR } from "@/lib/studio/schema";
import { COMPOSITIONS_DIR } from "@/lib/workspace/fs";
import { useStudioStore } from "@/lib/studio/store";
import { listDirectory, LIST_LIMIT, type DirEntry } from "@/lib/workspace/fs";
import { Connection, type ConnectionProps } from "./Connection";
import { PanelShell } from "./PanelShell";

/**
 * The folder, as a tree.
 *
 * What the film is made of is files: `project.json`, which the agent writes
 * and the app reads, and whatever sits beside it. This is the folder the
 * person linked, read one level at a time as it is opened, so a whole
 * repository costs nothing until someone looks inside it. node_modules and
 * its kind are shown but stay shut. A browser workspace has no folder and
 * is drawn as one, so the two look the same. Clicking a file shows it in
 * the middle. Where the folder is, how the agent reaches it, and the way
 * to link a different one sit behind the button beside the title.
 */

type Listing =
  | { state: "ready"; entries: DirEntry[] }
  | { state: "failed"; message: string };

export function FilesPanel(connection: ConnectionProps) {
  const linked = useStudioStore((state) => state.workspace);
  const workspace = linked.kind === "linked" ? linked.workspace : null;
  const selected = useStudioStore((state) => state.filePath);

  const [listings, setListings] = useState<Record<string, Listing>>({});
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([""]));
  const [generation, setGeneration] = useState(0);
  /** The composition folder whose delete is asking, and the last outcome. */
  const [asking, setAsking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * The one folder kind this panel may delete: a composition, under
   * .prismlaunch on disk or compositions/ in a browser workspace. Nothing
   * else in a person's repository is this app's to remove.
   */
  function compositionSlug(path: string): string | null {
    const parts = path.split("/");
    if (parts.length !== 2) return null;
    const root = workspace?.kind === "disk" ? WORKSPACE_DIR : COMPOSITIONS_DIR;
    return parts[0] === root ? (parts[1] ?? null) : null;
  }

  async function removeComposition(path: string, slug: string) {
    if (asking !== path) {
      setAsking(path);
      setNote(null);
      return;
    }
    setAsking(null);
    const result = await deleteProject(slug);
    setNote(result.message);
    if (result.ok) {
      if (selected?.startsWith(`${path}/`) || selected === path) openFile(null);
      refresh();
    }
  }

  // A path with no listing yet is one being read; nothing is set until the
  // read comes back, so opening the panel is one render, not two.
  const load = useCallback(
    (path: string) => {
      if (!workspace) return;
      void listDirectory(workspace, path).then((result) => {
        setListings((current) => ({
          ...current,
          [path]: result.ok
            ? { state: "ready", entries: result.value }
            : { state: "failed", message: result.message },
        }));
      });
    },
    [workspace],
  );

  // The root, when the panel opens and on every refresh.
  useEffect(() => {
    load("");
  }, [load, generation]);

  // A delete left asking goes back to being a button. No timer survives a re-ask.
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(null), 4000);
    return () => clearTimeout(timer);
  }, [asking]);

  function refresh() {
    setListings({});
    setOpen(new Set([""]));
    setGeneration((n) => n + 1);
  }

  function toggle(entry: DirEntry) {
    if (entry.sealed) return;
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
    if (!listings[entry.path]) load(entry.path);
  }

  const rootName =
    workspace?.kind === "disk" ? workspace.root.name : workspace ? "This browser" : null;
  const hint =
    workspace?.kind === "disk"
      ? `${rootName}, the folder you linked. project.json is the film.`
      : workspace
        ? "Compositions kept in this browser, drawn as a folder."
        : null;

  return (
    <PanelShell
      title="Files"
      {...(hint ? { hint } : {})}
      action={
        <>
          {workspace ? (
            <IconButton
              label="Read the folder again"
              size="sm"
              onClick={refresh}
              icon={<RefreshCw size={13} strokeWidth={2} aria-hidden />}
            />
          ) : null}
          <Connection {...connection} />
        </>
      }
    >
      {note ? (
        <p role="status" className="mb-2 text-xs leading-[var(--ds-leading-body)] text-muted">
          {note}
        </p>
      ) : null}

      {workspace ? (
        <ul role="tree" aria-label={rootName ?? "Files"} className="-mx-2 flex flex-col">
          <Rows
            path=""
            depth={0}
            listings={listings}
            open={open}
            selected={selected}
            onToggle={toggle}
            asking={asking}
            slugFor={compositionSlug}
            onRemove={removeComposition}
          />
        </ul>
      ) : (
        <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">
          Nothing is linked yet.
        </p>
      )}
    </PanelShell>
  );
}

function Rows({
  path,
  depth,
  listings,
  open,
  selected,
  onToggle,
  asking,
  slugFor,
  onRemove,
}: {
  path: string;
  depth: number;
  listings: Record<string, Listing>;
  open: ReadonlySet<string>;
  selected: string | null;
  onToggle: (entry: DirEntry) => void;
  asking: string | null;
  slugFor: (path: string) => string | null;
  onRemove: (path: string, slug: string) => void;
}) {
  const listing = listings[path];
  const note = (text: string) => (
    <li className="h-7 truncate text-2xs leading-7 text-subtle" style={{ paddingLeft: 12 + depth * 14 }}>
      {text}
    </li>
  );
  if (!listing) return note("Reading…");
  if (listing.state === "failed") return note(listing.message);
  if (listing.entries.length === 0) return note("Empty");

  return (
    <>
      {listing.entries.map((entry) => {
        const isDirectory = entry.kind === "directory";
        const expanded = isDirectory && open.has(entry.path);
        const current = entry.path === selected;
        const slug = isDirectory ? slugFor(entry.path) : null;
        return (
          <li
            key={entry.path}
            role="treeitem"
            aria-expanded={isDirectory ? expanded : undefined}
            aria-selected={current}
            className={slug ? "group relative" : undefined}
          >
            <button
              type="button"
              onClick={() => (isDirectory ? onToggle(entry) : openFile(entry.path))}
              aria-current={current ? "true" : undefined}
              title={entry.sealed ? "Not listed: too many files to be worth it" : entry.path}
              style={{ paddingLeft: 8 + depth * 14 }}
              className={`ds-focus flex h-7 w-full items-center gap-1.5 rounded-xs pr-2 text-left text-xs transition-[background-color,color] duration-140 ${
                current ? "bg-sunken text-ink" : "text-muted hover:bg-sunken hover:text-ink"
              } ${entry.sealed ? "opacity-50" : ""}`}
            >
              {isDirectory ? (
                <ChevronRight
                  size={12}
                  strokeWidth={2}
                  aria-hidden
                  className={`shrink-0 transition-transform duration-140 ${expanded ? "rotate-90" : ""} ${entry.sealed ? "invisible" : ""}`}
                />
              ) : (
                <span className="w-3 shrink-0" aria-hidden />
              )}
              {isDirectory ? (
                expanded ? (
                  <FolderOpen size={13} strokeWidth={1.8} aria-hidden className="shrink-0 text-subtle" />
                ) : (
                  <Folder size={13} strokeWidth={1.8} aria-hidden className="shrink-0 text-subtle" />
                )
              ) : (
                <FileIcon size={13} strokeWidth={1.8} aria-hidden className="shrink-0 text-subtle" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
              {!isDirectory && entry.size !== undefined ? (
                <span className="tabular shrink-0 font-mono text-2xs text-subtle">{formatSize(entry.size)}</span>
              ) : null}
              {slug ? <span className="w-5 shrink-0" aria-hidden /> : null}
            </button>

            {/*
              A composition folder can be deleted from here — the whole film,
              permanently, so the first press asks and the second does it.
              A sibling of the row's button, because a button cannot hold one.
            */}
            {slug ? (
              asking === entry.path ? (
                <button
                  type="button"
                  onClick={() => onRemove(entry.path, slug)}
                  className="ds-focus absolute top-1/2 right-1 -translate-y-1/2 rounded-xs bg-danger px-1.5 py-0.5 text-2xs font-medium text-inverse"
                >
                  Delete film?
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete the composition ${slug} and everything in it`}
                  title="Delete the composition, permanently"
                  onClick={() => onRemove(entry.path, slug)}
                  className="ds-focus absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded-xs text-subtle opacity-0 transition-opacity duration-140 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-sunken hover:text-danger"
                >
                  <Trash2 size={12} strokeWidth={2} aria-hidden />
                </button>
              )
            ) : null}
            {expanded ? (
              <ul role="group">
                <Rows
                  path={entry.path}
                  depth={depth + 1}
                  listings={listings}
                  open={open}
                  selected={selected}
                  onToggle={onToggle}
                  asking={asking}
                  slugFor={slugFor}
                  onRemove={onRemove}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
      {listing.entries.length >= LIST_LIMIT ? note(`Only the first ${LIST_LIMIT} are listed.`) : null}
    </>
  );
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
