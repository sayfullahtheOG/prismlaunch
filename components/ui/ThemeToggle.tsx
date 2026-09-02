"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { IconButton } from "./IconButton";

type Theme = "light" | "dark";

/**
 * Both themes are first-class and independently tuned, so the user must be
 * able to choose. The choice persists, and the root attribute is set before
 * paint by an inline script in the layout so there is no flash.
 *
 * The current theme is read from the DOM through `useSyncExternalStore` rather
 * than mirrored into component state: `data-theme` on `<html>` is already the
 * single source of truth, and a second copy could disagree with it. This also
 * keeps the button correct if anything else changes the theme.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The server has no DOM; the inline script corrects this before paint. */
function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("prism-theme", next);
    } catch {
      // Private browsing can refuse storage — the theme still applies.
    }
  }

  return (
    <IconButton
      label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      icon={
        theme === "dark" ? (
          <Sun size={17} strokeWidth={1.8} aria-hidden />
        ) : (
          <Moon size={17} strokeWidth={1.8} aria-hidden />
        )
      }
    />
  );
}
