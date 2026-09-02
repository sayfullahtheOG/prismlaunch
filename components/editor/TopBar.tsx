"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  productName: string;
  duration: string;
  /** Render is blocked while any clip is still a draft. */
  renderBlockedReason: string | null;
  onRender: () => void;
  /** Last render outcome. Shown inline so failures are never silent. */
  note?: string | null;
  busy?: boolean;
  /** Absent when nothing is open, which is also when there is nothing to name. */
  onRename?: ((name: string) => void) | undefined;
};

export function TopBar({
  productName,
  duration,
  renderBlockedReason,
  onRender,
  note,
  busy = false,
  onRename,
}: Props) {
  const blocked = renderBlockedReason !== null;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-4">
      <span className="flex items-center gap-2.5 text-md font-bold tracking-[var(--ds-tracking-tight)]">
        <Mark />
        PrismLaunch
      </span>

      <span className="h-6 w-px bg-line-soft" aria-hidden />

      {onRename ? (
        <Title name={productName} onRename={onRename} />
      ) : (
        <span className="px-2.5 text-sm text-muted">{productName}</span>
      )}

      <span className="tabular font-mono text-xs text-subtle">{duration}</span>

      {note ? (
        <span
          className="max-w-[34ch] truncate text-xs text-muted"
          title={note}
          role="status"
        >
          {note}
        </span>
      ) : null}

      <div className="flex-1" />

      {/*
        Monochrome, not cobalt. Export is the primary action, and the system's
        default for a primary action is an ink fill — accent has to be earned
        by state, not spent on the biggest button on screen.

        Disabled with an honest reason rather than hidden.
      */}
      <Button
        variant="primary"
        onClick={onRender}
        disabled={blocked}
        loading={busy}
        title={renderBlockedReason ?? "Render an MP4 from the accepted clips"}
        icon={<Download size={15} strokeWidth={2} aria-hidden />}
      >
        Export
      </Button>
    </header>
  );
}

/**
 * The composition's name, edited in place.
 *
 * Compositions are created without being named — you find out what a thing is
 * by building it — so this is where the name eventually happens. Click to
 * edit, Enter or blur to keep, Escape to abandon.
 *
 * `draft` is null when nobody is editing, which is also what "not editing"
 * means: the two were separate pieces of state in the first version, kept in
 * step by an effect that copied the prop down. That is the shape React warns
 * about, and it was wrong for a better reason than performance — the agent can
 * rename the composition in the file while this is open, and a mirrored copy
 * has to decide whether to clobber what someone is typing. With one piece of
 * state there is no question: while you are editing, your text wins.
 */
function Title({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    const next = (draft ?? "").trim();
    setDraft(null);
    if (next && next !== name) onRename(next);
  }

  if (draft !== null) {
    return (
      <input
        value={draft}
        autoFocus
        maxLength={80}
        aria-label="Composition name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
        className="ds-focus ds-inset min-h-11 w-56 rounded-sm bg-sunken px-2.5 text-sm text-ink"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(name)}
      title="Rename"
      className="ds-focus flex min-h-11 items-center rounded-sm px-2.5 text-sm text-muted transition-colors duration-140 hover:bg-sunken hover:text-ink"
    >
      {name}
    </button>
  );
}

/** Prism mark: a split beam. Monochrome, inherits ink. */
function Mark() {
  return (
    <span
      aria-hidden
      className="ds-raised grid size-7 place-items-center rounded-xs bg-ink"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2 13.5 12.5H2.5L8 2Z"
          stroke="var(--ds-color-inverse)"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M8 2v10.5"
          stroke="var(--ds-color-inverse)"
          strokeWidth="1.3"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}
