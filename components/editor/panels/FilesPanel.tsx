"use client";

import { ChevronRight, File as FileIcon, Folder, FolderOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { openFile } from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";
import { listDirectory, LIST_LIMIT, type DirEntry } from "@/lib/workspace/fs";
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
 * the middle.
 */

type Listing =
  | { state: "ready"; entries: DirEntry[] }
  | { state: "failed"; message: string };

export function FilesPanel() {
  const linked = useStudioStore((state) => state.workspace);
  const workspace = linked.kind === "linked" ? linked.workspace : null;
  const selected = useStudioStore((state) => state.filePath);

  const [listings, setListings] = useState<Record<string, Listing>>({});
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([""]));
  const [generation, setGeneration] = useState(0);

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
        workspace ? (
          <IconButton
            label="Read the folder again"
            size="sm"
            onClick={refresh}
            icon={<RefreshCw size={13} strokeWidth={2} aria-hidden />}
          />
        ) : undefined
      }
    >
      {workspace ? (
        <ul role="tree" aria-label={rootName ?? "Files"} className="-mx-2 flex flex-col">
          <Rows path="" depth={0} listings={listings} open={open} selected={selected} onToggle={toggle} />
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
}: {
  path: string;
  depth: number;
  listings: Record<string, Listing>;
  open: ReadonlySet<string>;
  selected: string | null;
  onToggle: (entry: DirEntry) => void;
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
        return (
          <li key={entry.path} role="treeitem" aria-expanded={isDirectory ? expanded : undefined} aria-selected={current}>
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
            </button>
            {expanded ? (
              <ul role="group">
                <Rows
                  path={entry.path}
                  depth={depth + 1}
                  listings={listings}
                  open={open}
                  selected={selected}
                  onToggle={onToggle}
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
