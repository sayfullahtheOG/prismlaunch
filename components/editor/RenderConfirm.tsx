"use client";

import { Check, Lock, X } from "lucide-react";
import { useState } from "react";
import {
  approveRender,
  confirmRender,
  dismissRenderRequest,
} from "@/lib/studio/actions";
import { useStudioStore } from "@/lib/studio/store";

/**
 * The confirm sheet an agent's `prism.request_render` raises.
 *
 * This is the click the whole render gate turns on. `approveRender` marks the
 * server-held confirmation approved, and only then will `confirmRender`
 * succeed — the agent holding the token is not permission by itself.
 *
 * Deliberately modal-ish and unmissable: on a recorded demo this is the moment
 * that proves the human is still in charge.
 */
export function RenderConfirm() {
  const pending = useStudioStore((state) => state.pendingRender);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) return null;

  async function approveAndStart() {
    if (!pending) return;
    setBusy(true);
    setError(null);

    const approved = await approveRender(pending.confirmationId);
    if (!approved.ok) {
      setBusy(false);
      setError(approved.message);
      return;
    }

    const started = await confirmRender(pending.confirmationId);
    setBusy(false);
    if (!started.ok) setError(started.message);
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/25 p-6">
      <div className="w-full max-w-md rounded-sm border border-line bg-surface p-5 shadow-lg">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-warning uppercase">
          <Lock size={12} strokeWidth={2.4} aria-hidden />
          Your agent is asking
        </p>

        <h2 className="mt-2 text-[15px] font-semibold tracking-tight">
          {pending.summary}
        </h2>

        {pending.reason ? (
          <p className="mt-2 rounded-xs bg-sunken p-2.5 text-[12.5px] text-muted">
            “{pending.reason}”
          </p>
        ) : null}

        <p className="mt-3 text-[12.5px] text-muted">
          Nothing has been rendered yet. Your agent recorded what it would
          export and stopped — starting it needs you.
        </p>

        {!pending.available ? (
          <p className="mt-3 rounded-xs border border-warning/40 bg-warning-soft px-2.5 py-2 text-[11.5px] text-warning">
            Rendering is not configured in this environment, so this will fail
            honestly rather than silently. The live preview still reflects every
            edit.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xs border border-warning/40 bg-warning-soft px-2.5 py-2 text-[11.5px] text-warning"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void approveAndStart()}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xs bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover ds-focus disabled:bg-line-strong disabled:text-subtle"
          >
            <Check size={14} strokeWidth={2.4} aria-hidden />
            {busy ? "Starting…" : "Approve and render"}
          </button>
          <button
            type="button"
            onClick={() => dismissRenderRequest()}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xs border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink ds-focus"
          >
            <X size={14} strokeWidth={2.4} aria-hidden />
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
