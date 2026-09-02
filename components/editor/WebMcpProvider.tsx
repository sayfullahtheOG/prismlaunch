"use client";

import { useEffect, useState } from "react";
import { registerPrismTools } from "@/lib/webmcp/register";
import type { ContextKind } from "@/lib/webmcp/fallback";

export type WebMcpState = { kind: ContextKind; registered: number };

/**
 * Registers the tools for the lifetime of the studio.
 *
 * Renders nothing — it exists purely for the effect, so the tools live exactly
 * as long as the page and disappear on unmount.
 */
export function useWebMcp(): WebMcpState {
  const [state, setState] = useState<WebMcpState>({
    kind: "absent",
    registered: 0,
  });

  useEffect(() => {
    let teardown: (() => void) | null = null;
    let cancelled = false;

    void registerPrismTools().then((result) => {
      if (!result) return;
      if (cancelled) {
        // Unmounted while registering — clean up rather than leaking tools.
        result.teardown();
        return;
      }
      teardown = result.teardown;
      setState({ kind: result.kind, registered: result.registered });
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return state;
}
