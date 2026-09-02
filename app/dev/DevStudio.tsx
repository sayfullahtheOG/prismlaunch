"use client";

import { useEffect } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { useStudioStore } from "@/lib/studio/store";
import { devFilm, type DevState } from "./fixture";

/**
 * Seeds the store, then renders the editor.
 *
 * `?state=` picks the moment in the process to look at; the default is the
 * storyboard waiting for review. The seed goes straight into the store
 * rather than through an action because no action can conjure a composition
 * without a folder, which is the invariant this harness exists to sidestep
 * — and it is the one place in the codebase allowed to. The setup dialog
 * shows for the one frame before the seed lands, which is the honest order
 * of events and not worth a loading state.
 */
export function DevStudio() {
  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get("state");
    useStudioStore.getState().setProject(devFilm(asState(state)), 0);
  }, []);

  return <EditorShell />;
}

function asState(value: string | null): DevState {
  return value === "build" || value === "boards" || value === "brief"
    ? value
    : "boards";
}
