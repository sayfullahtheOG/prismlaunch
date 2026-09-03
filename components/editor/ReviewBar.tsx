"use client";

import type { ReactNode } from "react";

/** File context. The navigation rail already provides access to the editor. */
export function ReviewBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line-soft bg-canvas px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </div>
  );
}
