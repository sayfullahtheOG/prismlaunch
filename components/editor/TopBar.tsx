"use client";

import { ChevronDown, Download, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  productName: string;
  duration: string;
  /** Render is blocked while any scene is still a draft. */
  renderBlockedReason: string | null;
  onRender: () => void;
  /** Last render outcome. Shown inline so failures are never silent. */
  note?: string | null;
  busy?: boolean;
};

export function TopBar({
  productName,
  duration,
  renderBlockedReason,
  onRender,
  note,
  busy = false,
}: Props) {
  const blocked = renderBlockedReason !== null;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-4">
      <span className="flex items-center gap-2.5 text-md font-bold tracking-[var(--ds-tracking-tight)]">
        <Mark />
        PrismLaunch
      </span>

      <span className="h-6 w-px bg-line-soft" aria-hidden />

      <button
        type="button"
        className="ds-focus flex min-h-11 items-center gap-1.5 rounded-sm px-2.5 text-sm text-muted transition-colors duration-140 hover:bg-sunken hover:text-ink"
      >
        {productName}
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
      </button>

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

      <div className="flex items-center gap-0.5">
        <IconButton
          label="Undo"
          icon={<Undo2 size={17} strokeWidth={1.7} aria-hidden />}
        />
        <IconButton
          label="Redo"
          icon={<Redo2 size={17} strokeWidth={1.7} aria-hidden />}
        />
      </div>

      <span className="h-6 w-px bg-line-soft" aria-hidden />

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
        title={
          renderBlockedReason ??
          "Render a 960×540 MP4 from the accepted scenes"
        }
        icon={<Download size={15} strokeWidth={2} aria-hidden />}
      >
        Export
      </Button>
    </header>
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
