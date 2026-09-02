"use client";

import { ChevronDown, Download, Redo2, Undo2, Zap } from "lucide-react";

type Props = {
  productName: string;
  duration: string;
  /** Render is blocked while any scene is still a draft. */
  renderBlockedReason: string | null;
  onRender: () => void;
  /** Last render outcome. Shown inline so failures are never silent. */
  note?: string | null;
};

export function TopBar({
  productName,
  duration,
  renderBlockedReason,
  onRender,
  note,
}: Props) {
  const blocked = renderBlockedReason !== null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <span className="grid size-6 place-items-center rounded-[5px] bg-brand text-surface">
          <Zap size={13} strokeWidth={2.4} aria-hidden />
        </span>
        PrismLaunch
      </span>

      <span className="h-5 w-px bg-line" aria-hidden />

      <button
        type="button"
        className="flex items-center gap-1.5 rounded-ctl px-2 py-1 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      >
        {productName} — launch film
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
      </button>

      <span className="font-mono text-xs text-faint tabular-nums">{duration}</span>

      {note ? (
        <span className="max-w-[38ch] truncate text-[11.5px] text-muted" title={note}>
          {note}
        </span>
      ) : null}

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Undo"
          className="grid size-8 place-items-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <Undo2 size={16} strokeWidth={1.7} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Redo"
          className="grid size-8 place-items-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <Redo2 size={16} strokeWidth={1.7} aria-hidden />
        </button>
      </div>

      <span className="h-5 w-px bg-line" aria-hidden />

      {/* Disabled with an honest reason rather than hidden — no non-functional
          controls ship (context/architecture.md invariant 16). */}
      <button
        type="button"
        onClick={onRender}
        disabled={blocked}
        title={renderBlockedReason ?? "Render a 960×540 MP4 from the accepted scenes"}
        className="flex items-center gap-2 rounded-ctl bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-faint"
      >
        <Download size={14} strokeWidth={2} aria-hidden />
        Export
      </button>
    </header>
  );
}
