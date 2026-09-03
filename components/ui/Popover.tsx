"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./IconButton";

/**
 * A small floating panel behind an icon button.
 *
 * For a few facts and one action that belong to a whole panel but do not
 * deserve a permanent box in it: which folder, which connection, the way to
 * change them. Not a menu (it runs no commands from a list) and not a
 * dialog (it takes nothing over). Outside click or Escape closes it.
 */
export function Popover({
  label,
  icon,
  width = 288,
  children,
}: {
  /** Accessible name of the trigger. */
  label: string;
  icon: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton
        label={label}
        icon={icon}
        pressed={open}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
      />
      {open ? (
        <div
          id={id}
          role="group"
          aria-label={label}
          style={{ width }}
          className="ds-floating absolute top-full right-0 z-[var(--ds-z-dropdown)] mt-1 flex flex-col gap-3 rounded-sm bg-raised p-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
