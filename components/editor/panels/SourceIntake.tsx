"use client";

import { Cloud, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { inspectSource, type InspectKind } from "@/lib/studio/actions";

const TABS: ReadonlyArray<{
  id: InspectKind;
  label: string;
  Icon: typeof Cloud;
  placeholder: string;
  hint: string;
}> = [
  {
    id: "github",
    label: "GitHub",
    Icon: Cloud,
    placeholder: "https://github.com/owner/repo",
    hint: "Public repositories only. Read, never run.",
  },
  {
    id: "local",
    label: "Folder",
    Icon: FolderOpen,
    placeholder: "/Users/you/code/my-app",
    hint: "Reads from this machine. Development only.",
  },
  {
    id: "demo",
    label: "Demo",
    Icon: Sparkles,
    placeholder: "",
    hint: "The built-in demo product. Always works offline.",
  },
];

/**
 * Intake for the three source kinds.
 *
 * Failures are shown in place with the message the API returned, because every
 * one of them has a real next action — a rate limit says when it resets, a
 * private repo says private repos are out of scope. Swallowing them into
 * "something went wrong" would waste the work the error paths do.
 */
export function SourceIntake() {
  const [kind, setKind] = useState<InspectKind>("github");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const active = TABS.find((tab) => tab.id === kind)!;

  async function run() {
    setBusy(true);
    setError(null);
    setDone(null);

    const result = await inspectSource(kind, ref.trim());

    setBusy(false);
    if (result.ok) setDone(result.message);
    else setError(result.message);
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-line bg-sunken p-3">
      <div className="flex gap-1 rounded-xs border border-line bg-surface p-0.5">
        {TABS.map((tab) => {
          const isActive = tab.id === kind;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setKind(tab.id);
                setError(null);
                setDone(null);
              }}
              aria-pressed={isActive}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-1 py-1.5 text-[11.5px] transition-colors ds-focus ${
                isActive
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              <tab.Icon size={12} strokeWidth={1.9} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {kind !== "demo" ? (
        <input
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) void run();
          }}
          placeholder={active.placeholder}
          spellCheck={false}
          aria-label={`${active.label} source`}
          className="w-full rounded-xs border border-line bg-surface px-2.5 py-2 font-mono text-[11.5px] text-ink placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none"
        />
      ) : null}

      <p className="text-[11px] text-subtle">{active.hint}</p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || (kind !== "demo" && ref.trim().length === 0)}
        className="flex items-center justify-center gap-2 rounded-xs bg-accent px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover ds-focus disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-subtle"
      >
        {busy ? (
          <>
            <Loader2 size={13} strokeWidth={2.2} className="animate-spin" aria-hidden />
            Reading source…
          </>
        ) : (
          "Inspect and rebuild board"
        )}
      </button>

      {error ? (
        <p
          role="alert"
          className="rounded-xs border border-warning/40 bg-warning-soft px-2.5 py-2 text-[11.5px] text-warning"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="rounded-xs border border-success/40 bg-success/10 px-2.5 py-2 text-[11.5px] text-success">
          {done}
        </p>
      ) : null}
    </div>
  );
}
