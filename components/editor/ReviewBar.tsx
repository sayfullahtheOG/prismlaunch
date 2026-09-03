"use client";

import { Film } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { showEditor } from "@/lib/studio/actions";

/**
 * The strip along the top of anything that replaces the editor.
 *
 * A review page or the boards take the middle of the screen, and the
 * canvas and timeline are the main section of the tool, so the way back
 * has to be in the same place every time: one button, top right.
 */
export function ReviewBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line-soft bg-canvas px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => showEditor()}
        icon={<Film size={12} strokeWidth={2} aria-hidden />}
      >
        Back to editor
      </Button>
    </div>
  );
}
