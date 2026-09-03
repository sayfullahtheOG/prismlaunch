"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { readFileAt } from "@/lib/workspace/fs";
import { ReviewBar } from "./ReviewBar";
import { formatSize } from "./panels/FilesPanel";

/**
 * One file from the folder, in the middle of the editor.
 *
 * Text is shown as text, JSON pretty-printed; an image, a sound or a video
 * is shown as itself; anything else is named and sized. This is a window
 * onto the folder, not an editor: the agent writes these files, and the
 * app's own edits go through the actions, so nothing here writes back.
 */

const TEXT_LIMIT = 200_000;

const TEXT = new Set([
  "json", "jsonc", "md", "mdx", "txt", "ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "html",
  "yml", "yaml", "toml", "xml", "csv", "env", "gitignore", "sh", "py", "rb", "go", "rs", "svg",
]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]);
const AUDIO = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);
const VIDEO = new Set(["mp4", "webm", "mov"]);

type Kind = "text" | "image" | "audio" | "video" | "binary";

function kindOf(name: string): Kind {
  const dot = name.lastIndexOf(".");
  const extension = (dot === -1 ? name : name.slice(dot + 1)).toLowerCase();
  if (IMAGE.has(extension)) return "image";
  if (AUDIO.has(extension)) return "audio";
  if (VIDEO.has(extension)) return "video";
  if (TEXT.has(extension) || dot === -1) return "text";
  return "binary";
}

function pretty(name: string, text: string): string {
  if (!name.endsWith(".json")) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

type Loaded =
  | { path: string; failed: string }
  | { path: string; name: string; size: number; kind: "text"; text: string; truncated: boolean }
  | { path: string; name: string; size: number; kind: "image" | "audio" | "video"; url: string }
  | { path: string; name: string; size: number; kind: "binary" };

export function FileView({ path }: { path: string | null }) {
  const linked = useStudioStore((state) => state.workspace);
  const workspace = linked.kind === "linked" ? linked.workspace : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!workspace || !path) return;
    let live = true;
    let url: string | null = null;
    void readFileAt(workspace, path).then(async (result) => {
      if (!live) return;
      if (!result.ok) {
        setLoaded({ path, failed: result.message });
        return;
      }
      const file = result.value;
      const base = { path, name: file.name, size: file.size };
      const kind = kindOf(file.name);
      if (kind === "text") {
        const text = await file.slice(0, TEXT_LIMIT).text();
        if (!live) return;
        setLoaded({ ...base, kind, text: pretty(file.name, text), truncated: file.size > TEXT_LIMIT });
      } else if (kind === "binary") {
        setLoaded({ ...base, kind });
      } else {
        url = URL.createObjectURL(file);
        setLoaded({ ...base, kind, url });
      }
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [workspace, path]);

  const current = loaded && loaded.path === path ? loaded : null;

  return (
    <section aria-label="File" className="flex min-h-0 flex-1 flex-col bg-canvas">
      <ReviewBar>
        <span className="text-xs text-subtle">Files</span>
        <span className="text-xs text-subtle" aria-hidden>/</span>
        <span className="min-w-0 truncate font-mono text-xs font-medium text-ink">
          {path ?? "Nothing open"}
        </span>
        {current && !("failed" in current) ? (
          <span className="tabular shrink-0 font-mono text-2xs text-subtle">{formatSize(current.size)}</span>
        ) : null}
      </ReviewBar>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto">
        {!path ? (
          <Empty>Pick a file on the left. project.json is the film: what your agent writes and what this app reads.</Empty>
        ) : !current ? (
          <Empty>Reading…</Empty>
        ) : "failed" in current ? (
          <Empty>{current.failed}</Empty>
        ) : current.kind === "text" ? (
          <pre className="px-8 py-6 font-mono text-xs leading-[1.6] whitespace-pre-wrap break-words text-ink">
            {current.text}
            {current.truncated ? `\n\n… ${formatSize(current.size - TEXT_LIMIT)} more not shown.` : ""}
          </pre>
        ) : current.kind === "image" ? (
          <div className="flex min-h-full items-center justify-center p-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- a file from the person's own folder, not a site image */}
            <img
              src={current.url}
              alt={current.name}
              className="max-h-[80vh] max-w-full rounded-xs bg-[#0A0A0C] shadow-[inset_0_0_0_1px_var(--ds-color-line-soft)]"
            />
          </div>
        ) : current.kind === "audio" ? (
          <div className="flex min-h-full items-center justify-center p-8">
            <audio controls src={current.url} className="w-full max-w-[560px]" />
          </div>
        ) : current.kind === "video" ? (
          <div className="flex min-h-full items-center justify-center p-8">
            <video controls src={current.url} className="max-h-[80vh] max-w-full rounded-xs bg-[#0A0A0C]" />
          </div>
        ) : (
          <Empty>
            {current.name}, {formatSize(current.size)}. Not a kind of file this shows.
          </Empty>
        )}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <p className="max-w-[420px] text-center text-sm leading-[var(--ds-leading-body)] text-muted">
        {children}
      </p>
    </div>
  );
}
