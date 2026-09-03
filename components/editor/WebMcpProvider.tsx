"use client";

import { useEffect, useState } from "react";
import { acquirePrismTools, releasePrismTools } from "@/lib/webmcp/register";
import type { ContextKind } from "@/lib/webmcp/fallback";

export type WebMcpState = {
  kind: ContextKind;
  registered: number;
  /** Tools this browser refused to register, by name. */
  failed: readonly string[];
};

/**
 * The page's tool registration, observed.
 *
 * Any number of components may call this — the setup dialog and the editor
 * both do — and they all share ONE registration (see register.ts). The
 * tools live as long as anything is mounted that asked about them.
 */
export function useWebMcp(): WebMcpState {
  const [state, setState] = useState<WebMcpState>({
    kind: "absent",
    registered: 0,
    failed: [],
  });

  useEffect(() => {
    let cancelled = false;

    void acquirePrismTools().then((result) => {
      if (!result || cancelled) return;
      setState({ kind: result.kind, registered: result.registered, failed: result.failed });
    });

    return () => {
      cancelled = true;
      releasePrismTools();
    };
  }, []);

  return state;
}
