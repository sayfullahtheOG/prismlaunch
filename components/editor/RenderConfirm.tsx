"use client";

import { Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
  const [progress, setProgress] = useState(0);

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

    const started = await confirmRender(pending.confirmationId, (fraction) =>
      setProgress(Math.round(fraction * 100)),
    );

    setBusy(false);
    if (!started.ok) setError(started.message);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-confirm-title"
      className="absolute inset-0 z-[var(--ds-z-modal)] flex items-center justify-center p-6"
      style={{ background: "var(--ds-overlay)" }}
    >
      <div className="ds-floating w-full max-w-md rounded-md bg-raised p-6">
        <p className="flex items-center gap-2 text-2xs font-semibold tracking-[var(--ds-tracking-label)] text-warning uppercase">
          <Lock size={12} strokeWidth={2.4} aria-hidden />
          Your agent is asking
        </p>

        <h2
          id="render-confirm-title"
          className="mt-2.5 text-lg font-bold tracking-[var(--ds-tracking-tight)]"
        >
          {pending.summary}
        </h2>

        {pending.reason ? (
          <p className="ds-inset mt-3 rounded-sm bg-sunken p-3 text-xs leading-[var(--ds-leading-body)] text-muted">
            “{pending.reason}”
          </p>
        ) : null}

        <p className="mt-3 text-xs leading-[var(--ds-leading-body)] text-muted">
          Nothing has been rendered yet. Your agent recorded what it would
          export and stopped — starting it needs you.
        </p>

        <p className="ds-level mt-3 rounded-sm bg-sunken px-3 py-2.5 text-xs leading-[var(--ds-leading-body)] text-muted">
          The film is encoded on this device — nothing is uploaded, and the file
          downloads straight to you.
        </p>

        {error ? (
          <p
            role="alert"
            className="ds-level mt-3 rounded-sm bg-warning-soft px-3 py-2.5 text-xs text-warning"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button
            variant="primary"
            onClick={() => void approveAndStart()}
            loading={busy}
            className="flex-1"
            icon={<Check size={15} strokeWidth={2.4} aria-hidden />}
          >
            {busy
              ? progress > 0
                ? `Encoding… ${progress}%`
                : "Starting…"
              : "Approve and render"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => dismissRenderRequest()}
            disabled={busy}
            icon={<X size={15} strokeWidth={2.4} aria-hidden />}
          >
            Not yet
          </Button>
        </div>
      </div>
    </div>
  );
}
