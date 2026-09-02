"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Icon-only control.
 *
 * `aria-label` is required by the type, not optional — an unlabelled icon
 * button is invisible to a screen reader, and the system requires screen-reader
 * naming on every interactive element. The 44px minimum target is enforced
 * here rather than left to each call site.
 */
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  /** Raised reads as an object you can press; quiet suits dense toolbars. */
  tone?: "quiet" | "raised";
  pressed?: boolean;
  /**
   * `sm` is 28px, below the system's 44px minimum, and is only for editor
   * chrome where the control belongs to a row that is itself 56px tall — a
   * timeline layer header, a clip inspector. Making those 44px would mean
   * fewer layers on screen, which is a worse outcome for the same person the
   * rule protects. Every primary and standalone control stays at `md`.
   */
  size?: "sm" | "md";
};

export function IconButton({
  label,
  icon,
  tone = "quiet",
  pressed,
  size = "md",
  className = "",
  ...rest
}: Props) {
  const base =
    tone === "raised"
      ? "bg-raised text-ink ds-raised hover:bg-strong"
      : "text-muted hover:bg-sunken hover:text-ink";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`ds-focus grid shrink-0 place-items-center ${size === "sm" ? "size-7 rounded-xs" : "size-11 rounded-sm"} transition-[background-color,box-shadow,color] duration-140 ease-[var(--ease-standard)] active:ds-pressed disabled:pointer-events-none disabled:opacity-45 ${pressed ? "ds-inset bg-sunken text-accent" : base} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
