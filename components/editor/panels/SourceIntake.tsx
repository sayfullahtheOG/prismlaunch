"use client";


import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { inspectSource, type InspectKind } from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";

const TABS: ReadonlyArray<{
  id: InspectKind;
  label: string;
  placeholder: string;
  hint: string;
}> = [
  {
    id: "github",
    label: "GitHub",
    placeholder: "https://github.com/owner/repo",
    hint: "Public repositories only. Read, never run.",
  },
  {
    id: "local",
    label: "Folder",
    placeholder: "/Users/you/code/my-app",
    hint: "Reads from this machine. Development only.",
  },
  {
    id: "demo",
    label: "Demo",
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

  // The same control does two jobs, and saying so matters: on an empty studio
  // it creates the film, afterwards it replaces the one that is there.
  const hasFilm = useStudioStore((state) => state.project !== null);

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
    <div className="ds-level flex flex-col gap-3 rounded-sm p-3.5">
      <Segmented
        label="Source kind"
        options={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setError(null);
          setDone(null);
        }}
      />

      {kind !== "demo" ? (
        <TextInput
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) void run();
          }}
          placeholder={active.placeholder}
          spellCheck={false}
          aria-label={`${active.label} source`}
          className="font-mono text-xs"
        />
      ) : null}

      <p className="text-xs leading-[var(--ds-leading-body)] text-subtle">{active.hint}</p>

      <Button
        variant="primary"
        onClick={() => void run()}
        loading={busy}
        disabled={kind !== "demo" && ref.trim().length === 0}
      >
        {busy
          ? "Reading source…"
          : hasFilm
            ? "Inspect and rebuild board"
            : "Read the source and build the film"}
      </Button>

      {error ? (
        <p
          role="alert"
          className="ds-level rounded-sm bg-warning-soft px-3 py-2.5 text-xs leading-[var(--ds-leading-body)] text-warning"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="ds-level rounded-sm bg-success-soft px-3 py-2.5 text-xs leading-[var(--ds-leading-body)] text-success">
          {done}
        </p>
      ) : null}
    </div>
  );
}
