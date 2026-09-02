"use client";

import { useEffect } from "react";
import { checkForDiskChanges, restoreWorkspace } from "@/lib/studio/actions";

/**
 * Keeps the page honest about the folder.
 *
 * Two jobs, both of which have to happen in a component because they are
 * effects: restore a previously linked folder on mount, and poll the open
 * project's `project.json` for changes made outside the app.
 *
 * Polling rather than watching because the File System Access API has no
 * change notification — there is no `watch()`, and the community proposals for
 * one are not shipped anywhere. A second is fast enough to feel live while an
 * agent is writing, and the check itself is one `getFile()` and an integer
 * compare, so leaving it running costs nothing worth measuring.
 *
 * Paused while the tab is hidden. Nobody is watching a preview they cannot
 * see, and a background tab polling someone's disk is rude.
 */

const POLL_MS = 1000;

export function useDiskSync(): void {
  useEffect(() => {
    void restoreWorkspace();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        // Swallowed deliberately: a failed poll is not an event worth telling
        // anyone about, and the next one is a second away. A file that has
        // genuinely gone wrong surfaces through `loadError` instead.
        await checkForDiskChanges().catch(() => false);
      }
      if (!cancelled) timer = setTimeout(() => void tick(), POLL_MS);
    }

    timer = setTimeout(() => void tick(), POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
}
